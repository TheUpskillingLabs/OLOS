import type { SupabaseClient } from "@supabase/supabase-js";
import { relTime } from "@/lib/format/rel-time";
import { fetchSocialForUpdates, type CommentView } from "@/lib/updates/social";
import { getFollowedParticipantIds, getFollowedPages } from "@/lib/follows/data";
import type { UserRoles } from "@/lib/auth/roles";
import {
  pagesUserCanPostAs,
  pageNames,
  pageTypeLabel,
  isPageAdmin,
  type PageType,
} from "@/lib/pages/authz";

/**
 * The community-feed read pipeline (profile_updates), shared by the
 * server-rendered first page (updates-feed.tsx) and the pagination API
 * (/api/updates/feed) so visibility rules can never drift between them.
 *
 * Pagination is keyset on (created_at DESC, id DESC). The merged multi-source
 * page stays exact under a cursor: each source independently returns its own
 * top-N strictly before the cursor in the same total order, so the global
 * top-N of the union is correct; rows created after the cursor are excluded by
 * construction (no duplicates between pages) and deletions simply vanish.
 */

export const FEED_PAGE_SIZE = 30;

/** A poster's public-safe identity — the only participant columns that travel. */
interface Poster {
  handle: string | null;
  preferred_name: string | null;
  first_name: string | null;
  last_name: string | null;
  profile_image_url: string | null;
}

interface UserRow {
  id: number;
  participant_id: number;
  body: string;
  created_at: string;
  visibility: string;
  participants: Poster | Poster[] | null;
}

interface PageRow {
  id: number;
  body: string;
  created_at: string;
  author_page_type: string;
  author_page_id: number;
}

/** Fully-shaped, JSON-serializable view of one feed post (crosses to clients). */
export interface FeedItemView {
  id: number;
  body: string;
  createdAt: string;
  /** relTime() computed at fetch time — clients render it verbatim. */
  timeLabel: string;
  visibility: string;
  author: {
    kind: "user" | "page";
    name: string;
    initials: string;
    avatarUrl: string | null;
    link: string | null;
    /** Pages only: the "Workstream"/"Lab"/… eyebrow under the author name. */
    typeLabel?: string;
  };
  canDelete: boolean;
  likeCount: number;
  likedByViewer: boolean;
  comments: CommentView[];
}

export interface FeedPage {
  items: FeedItemView[];
  nextCursor: string | null;
}

export interface FeedCursor {
  createdAt: string;
  id: number;
}

/** Feed scope: member-scoped, page-scoped, or (neither) the Following feed. */
export interface FeedScope {
  participantId?: number;
  pageType?: PageType;
  pageId?: number;
}

const USER_SELECT =
  "id, participant_id, body, created_at, visibility, participants:participant_id!inner(handle, preferred_name, first_name, last_name, profile_image_url)";
const PAGE_SELECT = "id, body, created_at, author_page_type, author_page_id";

/* ── Cursor codec ──────────────────────────────────────────────────── */

// The raw Postgres timestamp travels verbatim (never re-parsed into a Date and
// back) so the keyset `eq` arm matches at full microsecond precision. The
// charset check doubles as filter-injection protection: the timestamp is
// interpolated into a PostgREST or() expression below.
const CURSOR_TS = /^[0-9][0-9T:.+ -]*$/;

export function encodeCursor(c: FeedCursor): string {
  return `${c.createdAt}_${c.id}`;
}

export function decodeCursor(raw: string): FeedCursor | null {
  const at = raw.lastIndexOf("_");
  if (at <= 0 || at === raw.length - 1) return null;
  const createdAt = raw.slice(0, at);
  const id = Number(raw.slice(at + 1));
  if (!Number.isInteger(id) || id < 0) return null;
  if (!CURSOR_TS.test(createdAt)) return null;
  if (Number.isNaN(new Date(createdAt).getTime())) return null;
  return { createdAt, id };
}

/** The PostgREST keyset filter for rows strictly after the cursor (older). */
function keysetOr(c: FeedCursor): string {
  return `created_at.lt."${c.createdAt}",and(created_at.eq."${c.createdAt}",id.lt.${c.id})`;
}

/* ── Pure page assembly (unit-tested) ──────────────────────────────── */

/** (created_at, id) descending — the feed's total order. */
export function byCreatedDesc(
  a: { createdAt: string; id: number },
  b: { createdAt: string; id: number }
): number {
  const tb = new Date(b.createdAt).getTime();
  const ta = new Date(a.createdAt).getTime();
  if (tb !== ta) return tb - ta;
  return b.id - a.id;
}

/**
 * Merge raw source rows into one page: dedup by id (a page you both follow and
 * admin can't double up), sort, slice, and derive the next cursor (null when
 * the page came back short — the end of the feed).
 */
export function assemblePage<T extends { id: number; createdAt: string }>(
  rows: T[],
  limit: number
): { items: T[]; nextCursor: string | null } {
  const seen = new Set<number>();
  const uniq = rows.filter((r) =>
    seen.has(r.id) ? false : (seen.add(r.id), true)
  );
  uniq.sort(byCreatedDesc);
  const items = uniq.slice(0, limit);
  const last = items[items.length - 1];
  const nextCursor =
    items.length === limit && last
      ? encodeCursor({ createdAt: last.createdAt, id: last.id })
      : null;
  return { items, nextCursor };
}

/* ── Author shaping ────────────────────────────────────────────────── */

function userAuthor(embed: Poster | Poster[] | null): FeedItemView["author"] {
  const p = Array.isArray(embed) ? embed[0] : embed;
  const name =
    p?.preferred_name ||
    [p?.first_name, p?.last_name].filter(Boolean).join(" ") ||
    "A member";
  const initials =
    `${p?.first_name?.[0] ?? ""}${p?.last_name?.[0] ?? ""}`.toUpperCase() || "•";
  return {
    kind: "user",
    name,
    initials,
    avatarUrl: p?.profile_image_url ?? null,
    link: p?.handle ? `/u/${p.handle}` : null,
  };
}

function pageInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  const two = (words[0]?.[0] ?? "") + (words[1]?.[0] ?? "");
  return (two || name.slice(0, 2)).toUpperCase() || "•";
}

/* ── Source queries ────────────────────────────────────────────────── */

/** Fetch page-authored updates for a set of (type,id) refs, one query per type. */
async function fetchPagePosts(
  service: SupabaseClient,
  refs: { type: PageType; id: number }[],
  cursor: FeedCursor | null,
  limit: number
): Promise<PageRow[]> {
  if (refs.length === 0) return [];
  const byType = new Map<PageType, number[]>();
  for (const r of refs) byType.set(r.type, [...(byType.get(r.type) ?? []), r.id]);
  const results = await Promise.all(
    [...byType.entries()].map(([type, ids]) => {
      let q = service
        .from("profile_updates")
        .select(PAGE_SELECT)
        .eq("visibility", "labs")
        .eq("author_page_type", type)
        .in("author_page_id", [...new Set(ids)]);
      if (cursor) q = q.or(keysetOr(cursor));
      return q
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit);
    })
  );
  return results.flatMap((r) => (r.data ?? []) as unknown as PageRow[]);
}

/* ── The page fetch ────────────────────────────────────────────────── */

export async function fetchFeedPage(opts: {
  service: SupabaseClient;
  scope?: FeedScope;
  viewer: { participantId: number | null; roles: UserRoles | null };
  cursor?: FeedCursor | null;
  limit?: number;
}): Promise<FeedPage> {
  const { service, viewer } = opts;
  const scope = opts.scope ?? {};
  const cursor = opts.cursor ?? null;
  const limit = opts.limit ?? FEED_PAGE_SIZE;
  const viewerId = viewer.participantId;
  const pageScoped = scope.pageType != null && scope.pageId != null;

  const userRows: UserRow[] = [];
  const pageRows: PageRow[] = [];
  // Pages the viewer admins ("type:id") — powers the page-post Delete control.
  const adminKeys = new Set<string>();

  if (pageScoped) {
    // A page's own feed — just that page's authored updates.
    pageRows.push(
      ...(await fetchPagePosts(
        service,
        [{ type: scope.pageType!, id: scope.pageId! }],
        cursor,
        limit
      ))
    );
    if (
      viewer.roles &&
      (await isPageAdmin(service, viewer.roles, scope.pageType!, scope.pageId!))
    ) {
      adminKeys.add(`${scope.pageType}:${scope.pageId}`);
    }
  } else if (scope.participantId != null) {
    // Member-scoped — that member's own shares (access-controlled by the page).
    let q = service
      .from("profile_updates")
      .select(USER_SELECT)
      .eq("visibility", "labs")
      .eq("participant_id", scope.participantId);
    if (cursor) q = q.or(keysetOr(cursor));
    const { data } = await q
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit);
    userRows.push(...((data ?? []) as unknown as UserRow[]));
  } else {
    // The Following feed — users you follow (+ self), pages you follow (+ admin).
    const followedIds =
      viewerId != null ? await getFollowedParticipantIds(service, viewerId) : [];
    const followedPages =
      viewerId != null ? await getFollowedPages(service, viewerId) : [];
    const adminPages = viewer.roles
      ? await pagesUserCanPostAs(service, viewer.roles)
      : [];
    for (const p of adminPages) adminKeys.add(`${p.type}:${p.id}`);

    const authorIds = viewerId != null ? [...followedIds, viewerId] : followedIds;
    let uq = service
      .from("profile_updates")
      .select(USER_SELECT)
      .eq("visibility", "labs")
      .eq("participants.is_test", false)
      .eq("participants.is_staff", false)
      .in("participant_id", authorIds.length > 0 ? authorIds : [-1]);
    if (cursor) uq = uq.or(keysetOr(cursor));
    const { data: uData, error } = await uq
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit);
    if (error) {
      console.error("[updates-feed] user query failed:", error.message);
    }
    userRows.push(...((uData ?? []) as unknown as UserRow[]));

    // Fold in the viewer's own private posts (author-only).
    if (viewerId != null) {
      let mq = service
        .from("profile_updates")
        .select(USER_SELECT)
        .eq("participant_id", viewerId)
        .eq("visibility", "private");
      if (cursor) mq = mq.or(keysetOr(cursor));
      const { data: mine } = await mq
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit);
      userRows.push(...((mine ?? []) as unknown as UserRow[]));
    }

    // Merge followed + admin page refs (dedup) and pull their updates.
    const refMap = new Map<string, { type: PageType; id: number }>();
    for (const p of followedPages) refMap.set(`${p.type}:${p.id}`, p);
    for (const p of adminPages)
      refMap.set(`${p.type}:${p.id}`, { type: p.type, id: p.id });
    pageRows.push(
      ...(await fetchPagePosts(service, [...refMap.values()], cursor, limit))
    );
  }

  // Resolve page display names/links for any page rows.
  const pageMeta = new Map<string, { name: string; href: string }>();
  if (pageRows.length > 0) {
    const idsByType = new Map<PageType, number[]>();
    for (const r of pageRows) {
      const t = r.author_page_type as PageType;
      idsByType.set(t, [...(idsByType.get(t) ?? []), r.author_page_id]);
    }
    for (const [type, ids] of idsByType) {
      const named = await pageNames(service, type, ids);
      for (const [id, meta] of named) pageMeta.set(`${type}:${id}`, meta);
    }
  }

  // Unify sources, then page (dedup → sort → slice → cursor).
  interface RawItem {
    id: number;
    body: string;
    createdAt: string;
    visibility: string;
    author: FeedItemView["author"];
    authorParticipantId: number | null;
    pageKey: string | null;
  }
  const raw: RawItem[] = [
    ...userRows.map(
      (u): RawItem => ({
        id: u.id,
        body: u.body,
        createdAt: u.created_at,
        visibility: u.visibility,
        author: userAuthor(u.participants),
        authorParticipantId: u.participant_id,
        pageKey: null,
      })
    ),
    ...pageRows.map((r): RawItem => {
      const type = r.author_page_type as PageType;
      const meta = pageMeta.get(`${type}:${r.author_page_id}`);
      const name = meta?.name ?? pageTypeLabel(type);
      return {
        id: r.id,
        body: r.body,
        createdAt: r.created_at,
        visibility: "labs",
        author: {
          kind: "page",
          name,
          initials: pageInitials(name),
          avatarUrl: null,
          link: meta?.href ?? "#",
          typeLabel: pageTypeLabel(type),
        },
        authorParticipantId: null,
        pageKey: `${type}:${r.author_page_id}`,
      };
    }),
  ];
  const { items, nextCursor } = assemblePage(raw, limit);

  const social = await fetchSocialForUpdates(
    service,
    items.map((it) => it.id),
    viewerId
  );

  return {
    items: items.map(
      (it): FeedItemView => ({
        id: it.id,
        body: it.body,
        createdAt: it.createdAt,
        timeLabel: relTime(it.createdAt),
        visibility: it.visibility,
        author: it.author,
        canDelete:
          (it.authorParticipantId != null &&
            it.authorParticipantId === viewerId) ||
          (it.pageKey != null && adminKeys.has(it.pageKey)),
        likeCount: social.likeCount.get(it.id) ?? 0,
        likedByViewer: social.likedByViewer.has(it.id),
        comments: social.comments.get(it.id) ?? [],
      })
    ),
    nextCursor,
  };
}
