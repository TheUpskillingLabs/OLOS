import { createServiceClient } from "@/lib/supabase/server";
import { one } from "@/lib/supabase/embed";

/**
 * The org-announcements feed reader — the dashboard right rail.
 *
 * Security posture mirrors the directory / updates-feed: read through the
 * SERVICE client with an author-name allowlist (never a widened participants
 * RLS), select only display columns, and log-on-error instead of silently
 * rendering an empty rail (a 400 from a drifted column reads identically to
 * "no news" otherwise). Members only ever get published rows; lab-scoping is
 * applied here in the query (global rows always show; the viewer's own lab
 * adds to them), not in RLS.
 */

export interface AnnouncementCard {
  id: number;
  title: string;
  body: string;
  publishedAt: string | null;
  pinned: boolean;
  labId: number | null;
  authorName: string | null;
}

interface Author {
  preferred_name: string | null;
  first_name: string | null;
  last_name: string | null;
}

/** The scope chip shown on an announcement: org-wide vs. a named lab. */
export function announcementScopeLabel(
  labId: number | null,
  labName: string | null
): string {
  if (labId == null) return "Org-wide";
  return labName ?? "Your lab";
}

function authorDisplayName(a: Author | null): string | null {
  if (!a) return null;
  const name =
    a.preferred_name ||
    [a.first_name, a.last_name].filter(Boolean).join(" ").trim();
  return name || null;
}

export async function fetchAnnouncements(
  opts: { labId?: number | null; limit?: number } = {}
): Promise<AnnouncementCard[]> {
  const service = createServiceClient();
  const limit = opts.limit ?? 10;

  let query = service
    .from("announcements")
    .select(
      "id, title, body, pinned, published_at, lab_id, author:author_participant_id(preferred_name, first_name, last_name)"
    )
    .eq("status", "published")
    .order("pinned", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(limit);

  // Global rows (lab_id IS NULL) always show; a member's own lab adds to them.
  if (opts.labId != null) {
    query = query.or(`lab_id.is.null,lab_id.eq.${opts.labId}`);
  } else {
    query = query.is("lab_id", null);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[announcements] feed query failed:", error.message);
    return [];
  }

  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    publishedAt: r.published_at,
    pinned: r.pinned,
    labId: r.lab_id,
    authorName: authorDisplayName(one(r.author as Author | Author[] | null)),
  }));
}
