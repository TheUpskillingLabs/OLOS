import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { EmptyState } from "@/app/components/ui";
import UpdateSocial from "./update-social";
import { fetchSocialForUpdates } from "@/lib/updates/social";
import { getFollowedParticipantIds, getFollowedPages } from "@/lib/follows/data";
import { resolveUserRoles } from "@/lib/auth/roles";
import {
  pagesUserCanPostAs,
  pageNames,
  pageTypeLabel,
  type PageType,
} from "@/lib/pages/authz";

/**
 * Community updates — the feed reader. Rows are `profile_updates` authored either
 * by a member (a person) or by a PAGE (a lab/sector/workstream/pod/project, 00076).
 * Read through the service client with a poster allowlist (name/handle/avatar
 * only) so no PII column is ever in reach.
 *
 * Three modes:
 *   - Following feed (default): updates from the users AND pages you follow, plus
 *     your own and the pages you admin. On /dashboard and /directory.
 *   - Member-scoped (`participantId`): one member's own shared updates (/profile, /u/[handle]).
 *   - Page-scoped (`pageType`+`pageId`): one page's own updates (its detail page).
 */

const PAGE = 30;

export interface UpdatesFeedProps {
  /** Scope to a single member (their shared updates). Omit for the full feed. */
  participantId?: number;
  /** Scope to a single page's own updates (its detail page). */
  pageType?: PageType;
  pageId?: number;
  /** Global-feed only: also fold in THIS viewer's own private posts. */
  viewerParticipantId?: number;
  title?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Owner mode: render a per-row retract control. */
  renderRetract?: (updateId: number) => React.ReactNode;
}

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

type Author =
  | {
      kind: "user";
      name: string;
      initials: string;
      avatarUrl: string | null;
      link: string | null;
    }
  | { kind: "page"; type: PageType; name: string; initials: string; link: string };

interface FeedItem {
  id: number;
  body: string;
  createdAt: string;
  visibility: string;
  author: Author;
}

const USER_SELECT =
  "id, participant_id, body, created_at, visibility, participants:participant_id!inner(handle, preferred_name, first_name, last_name, profile_image_url)";
const PAGE_SELECT =
  "id, body, created_at, author_page_type, author_page_id";

function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.max(0, Math.round((now - then) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function userAuthor(embed: Poster | Poster[] | null): Author {
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

/** Fetch page-authored updates for a set of (type,id) refs, one query per type. */
async function fetchPagePosts(
  service: ReturnType<typeof createServiceClient>,
  refs: { type: PageType; id: number }[]
): Promise<PageRow[]> {
  if (refs.length === 0) return [];
  const byType = new Map<PageType, number[]>();
  for (const r of refs) byType.set(r.type, [...(byType.get(r.type) ?? []), r.id]);
  const results = await Promise.all(
    [...byType.entries()].map(([type, ids]) =>
      service
        .from("profile_updates")
        .select(PAGE_SELECT)
        .eq("visibility", "labs")
        .eq("author_page_type", type)
        .in("author_page_id", [...new Set(ids)])
        .order("created_at", { ascending: false })
        .limit(PAGE)
    )
  );
  return results.flatMap((r) => (r.data ?? []) as unknown as PageRow[]);
}

export default async function UpdatesFeed({
  participantId,
  pageType,
  pageId,
  viewerParticipantId,
  title = "Community updates",
  emptyTitle = "No updates yet",
  emptyDescription = "When members share a Learning Log to the community, it shows up here.",
  renderRetract,
}: UpdatesFeedProps) {
  const service = createServiceClient();
  const pageScoped = pageType != null && pageId != null;

  // Resolve the viewer once (for liked-by-me, the composer avatar, private-post
  // folding, and the pages they admin).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let viewer: { id: number; initials: string; avatarUrl: string | null } | null =
    null;
  if (user) {
    const { data: me } = await service
      .from("participants")
      .select("id, first_name, last_name, profile_image_url")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (me) {
      const initials =
        `${me.first_name?.[0] ?? ""}${me.last_name?.[0] ?? ""}`.toUpperCase() ||
        "•";
      viewer = { id: me.id, initials, avatarUrl: me.profile_image_url };
    }
  }
  const viewerId = viewer?.id ?? viewerParticipantId ?? null;

  const userRows: UserRow[] = [];
  const pageRows: PageRow[] = [];
  let noSources = false;

  if (pageScoped) {
    // A page's own feed — just that page's authored updates.
    pageRows.push(...(await fetchPagePosts(service, [{ type: pageType!, id: pageId! }])));
  } else if (participantId != null) {
    // Member-scoped — that member's own shares (access-controlled by the page).
    const { data } = await service
      .from("profile_updates")
      .select(USER_SELECT)
      .eq("visibility", "labs")
      .eq("participant_id", participantId)
      .order("created_at", { ascending: false })
      .limit(PAGE);
    userRows.push(...((data ?? []) as unknown as UserRow[]));
  } else {
    // The Following feed — users you follow (+ self), pages you follow (+ admin).
    const followedIds =
      viewerId != null ? await getFollowedParticipantIds(service, viewerId) : [];
    const followedPages =
      viewerId != null ? await getFollowedPages(service, viewerId) : [];
    const adminPages =
      user != null
        ? await pagesUserCanPostAs(service, await resolveUserRoles(supabase, user.id))
        : [];
    noSources =
      followedIds.length === 0 &&
      followedPages.length === 0 &&
      adminPages.length === 0;

    const authorIds =
      viewerId != null ? [...followedIds, viewerId] : followedIds;
    const { data: uData, error } = await service
      .from("profile_updates")
      .select(USER_SELECT)
      .eq("visibility", "labs")
      .eq("participants.is_test", false)
      .eq("participants.is_staff", false)
      .in("participant_id", authorIds.length > 0 ? authorIds : [-1])
      .order("created_at", { ascending: false })
      .limit(PAGE);
    if (error) {
      console.error("[updates-feed] user query failed:", error.message);
    }
    userRows.push(...((uData ?? []) as unknown as UserRow[]));

    // Fold in the viewer's own private posts (author-only).
    if (viewerId != null) {
      const { data: mine } = await service
        .from("profile_updates")
        .select(USER_SELECT)
        .eq("participant_id", viewerId)
        .eq("visibility", "private")
        .order("created_at", { ascending: false })
        .limit(PAGE);
      userRows.push(...((mine ?? []) as unknown as UserRow[]));
    }

    // Merge followed + admin page refs (dedup) and pull their updates.
    const refMap = new Map<string, { type: PageType; id: number }>();
    for (const p of followedPages) refMap.set(`${p.type}:${p.id}`, p);
    for (const p of adminPages) refMap.set(`${p.type}:${p.id}`, { type: p.type, id: p.id });
    pageRows.push(...(await fetchPagePosts(service, [...refMap.values()])));
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

  // Build a unified, time-sorted item list.
  const items: FeedItem[] = [
    ...userRows.map((u) => ({
      id: u.id,
      body: u.body,
      createdAt: u.created_at,
      visibility: u.visibility,
      author: userAuthor(u.participants),
    })),
    ...pageRows.map((r): FeedItem => {
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
          type,
          name,
          initials: pageInitials(name),
          link: meta?.href ?? "#",
        },
      };
    }),
  ]
    // De-dup by id (a page you both follow and admin can't double up).
    .filter((it, i, arr) => arr.findIndex((x) => x.id === it.id) === i)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, PAGE);

  const social = await fetchSocialForUpdates(
    service,
    items.map((it) => it.id),
    viewerId
  );

  return (
    <section>
      <h2 className="section-head mb-3">{title}</h2>
      {items.length === 0 ? (
        !pageScoped && participantId == null && noSources ? (
          <EmptyState
            title="Your feed is quiet"
            description="Follow members and pages to see their updates here."
            action={
              <Link href="/directory" className="btn btn-teal px-4 py-2 text-sm">
                Find people to follow
              </Link>
            }
          />
        ) : (
          <EmptyState title={emptyTitle} description={emptyDescription} />
        )
      ) : (
        <ul className="space-y-3">
          {items.map((it) => {
            const a = it.author;
            return (
              <li
                key={it.id}
                className="rounded-card border border-ink/10 bg-white p-4 shadow-card"
              >
                <div className="flex items-start gap-3">
                  {a.kind === "user" ? (
                    a.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.avatarUrl}
                        alt={a.name}
                        className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-ink/10"
                      />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-deep text-xs font-bold text-white">
                        {a.initials}
                      </div>
                    )
                  ) : (
                    // Pages get a squared tile so they read as an org, not a person.
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-ink text-xs font-bold text-white">
                      {a.initials}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0">
                        {a.kind === "page" || a.link ? (
                          <Link
                            href={a.link ?? "#"}
                            className="block truncate text-sm font-semibold text-ink transition-colors duration-150 hover:text-teal-deep"
                          >
                            {a.name}
                          </Link>
                        ) : (
                          <span className="block truncate text-sm font-semibold text-ink">
                            {a.name}
                          </span>
                        )}
                        {a.kind === "page" && (
                          <span className="text-[11px] font-medium uppercase tracking-wide text-meta">
                            {pageTypeLabel(a.type)}
                          </span>
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5 text-xs text-meta tabular-nums">
                        {it.visibility === "private" && (
                          <span className="rounded-full bg-ink/[0.06] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-meta">
                            Only you
                          </span>
                        )}
                        {relTime(it.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-charcoal">
                      {it.body}
                    </p>
                    {renderRetract && (
                      <div className="mt-2">{renderRetract(it.id)}</div>
                    )}
                  </div>
                </div>
                <UpdateSocial
                  updateId={it.id}
                  initialLikeCount={social.likeCount.get(it.id) ?? 0}
                  initialLiked={social.likedByViewer.has(it.id)}
                  initialComments={social.comments.get(it.id) ?? []}
                  viewerParticipantId={viewerId}
                  viewerAvatarUrl={viewer?.avatarUrl ?? null}
                  viewerInitials={viewer?.initials ?? "•"}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
