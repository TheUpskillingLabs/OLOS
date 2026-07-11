import type { SupabaseClient } from "@supabase/supabase-js";
import { one } from "@/lib/supabase/embed";

/**
 * The social layer on community feed updates (profile_updates): likes + comments
 * (migration 00073). Reads run through the service client (the feed already does,
 * with a poster allowlist); these helpers keep the shaping in one place so the
 * feed component and the API routes agree on the view model.
 */

/** A poster's public-safe identity — the only participant columns that travel. */
interface Poster {
  handle: string | null;
  preferred_name: string | null;
  first_name: string | null;
  last_name: string | null;
  profile_image_url: string | null;
}

/** A comment as the feed + composer render it (no PII beyond the allowlist). */
export interface CommentView {
  id: number;
  updateId: number;
  participantId: number;
  body: string;
  createdAt: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
  handle: string | null;
}

/** The like/comment bundle for a page of updates. */
export interface UpdateSocial {
  likeCount: Map<number, number>;
  likedByViewer: Set<number>;
  comments: Map<number, CommentView[]>;
}

interface LikeRow {
  update_id: number;
  participant_id: number;
}

interface CommentRow {
  id: number;
  update_id: number;
  participant_id: number;
  body: string;
  created_at: string;
  participants: Poster | Poster[] | null;
}

const COMMENT_SELECT =
  "id, update_id, participant_id, body, created_at, participants:participant_id!inner(handle, preferred_name, first_name, last_name, profile_image_url)";

function posterName(p: Poster | null): string {
  return (
    p?.preferred_name ||
    [p?.first_name, p?.last_name].filter(Boolean).join(" ") ||
    "A member"
  );
}

function posterInitials(p: Poster | null): string {
  return (
    `${p?.first_name?.[0] ?? ""}${p?.last_name?.[0] ?? ""}`.toUpperCase() || "•"
  );
}

/** Raw comment row → view model (pure; used by the feed batch + the POST route). */
export function shapeComment(row: CommentRow): CommentView {
  const p = one<Poster>(row.participants);
  return {
    id: row.id,
    updateId: row.update_id,
    participantId: row.participant_id,
    body: row.body,
    createdAt: row.created_at,
    name: posterName(p),
    initials: posterInitials(p),
    avatarUrl: p?.profile_image_url ?? null,
    handle: p?.handle ?? null,
  };
}

/** Like rows → per-update counts + which updates the viewer has liked (pure). */
export function tallyLikes(
  rows: LikeRow[],
  viewerId: number | null
): { likeCount: Map<number, number>; likedByViewer: Set<number> } {
  const likeCount = new Map<number, number>();
  const likedByViewer = new Set<number>();
  for (const r of rows) {
    likeCount.set(r.update_id, (likeCount.get(r.update_id) ?? 0) + 1);
    if (viewerId != null && r.participant_id === viewerId) {
      likedByViewer.add(r.update_id);
    }
  }
  return { likeCount, likedByViewer };
}

/** Group shaped comments by update id (pure). */
export function groupComments(rows: CommentRow[]): Map<number, CommentView[]> {
  const comments = new Map<number, CommentView[]>();
  for (const row of rows) {
    const view = shapeComment(row);
    const bucket = comments.get(view.updateId);
    if (bucket) bucket.push(view);
    else comments.set(view.updateId, [view]);
  }
  return comments;
}

/** Fetch likes + comments for a page of update ids (service-role). */
export async function fetchSocialForUpdates(
  service: SupabaseClient,
  updateIds: number[],
  viewerId: number | null
): Promise<UpdateSocial> {
  if (updateIds.length === 0) {
    return {
      likeCount: new Map(),
      likedByViewer: new Set(),
      comments: new Map(),
    };
  }

  const [likesRes, commentsRes] = await Promise.all([
    service
      .from("profile_update_likes")
      .select("update_id, participant_id")
      .in("update_id", updateIds),
    service
      .from("profile_update_comments")
      .select(COMMENT_SELECT)
      .in("update_id", updateIds)
      .order("created_at", { ascending: true }),
  ]);

  if (likesRes.error) {
    console.error("[updates-social] likes query failed:", likesRes.error.message);
  }
  if (commentsRes.error) {
    console.error(
      "[updates-social] comments query failed:",
      commentsRes.error.message
    );
  }

  const { likeCount, likedByViewer } = tallyLikes(
    (likesRes.data ?? []) as LikeRow[],
    viewerId
  );
  const comments = groupComments(
    (commentsRes.data ?? []) as unknown as CommentRow[]
  );
  return { likeCount, likedByViewer, comments };
}

/**
 * The update, if it is visible to this viewer (labs-wide, or the viewer's own
 * private post) — else null. Gates a like/comment write to something the member
 * can actually see, mirroring profile_updates_select.
 */
export async function getVisibleUpdate(
  service: SupabaseClient,
  updateId: number,
  viewerId: number
): Promise<{ id: number; participant_id: number; visibility: string } | null> {
  const { data } = await service
    .from("profile_updates")
    .select("id, participant_id, visibility")
    .eq("id", updateId)
    .maybeSingle();
  if (!data) return null;
  const visible =
    data.visibility === "labs" ||
    (data.visibility === "private" && data.participant_id === viewerId);
  return visible ? data : null;
}

/** Current like count for one update (service-role, head count). */
export async function countLikes(
  service: SupabaseClient,
  updateId: number
): Promise<number> {
  const { count } = await service
    .from("profile_update_likes")
    .select("id", { head: true, count: "exact" })
    .eq("update_id", updateId);
  return count ?? 0;
}

/** The comment view-model builder, exported for the POST route's response. */
export { COMMENT_SELECT };
