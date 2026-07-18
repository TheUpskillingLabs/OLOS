import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { EmptyState } from "@/app/components/ui";
import { resolveUserRoles } from "@/lib/auth/roles";
import { fetchFeedPage, type FeedScope } from "@/lib/updates/feed";
import type { PageType } from "@/lib/pages/authz";
import FeedList from "./feed-list";

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
 *
 * This shell only resolves the viewer and server-renders page 1 via
 * lib/updates/feed.ts; FeedList (client) pages the rest through
 * GET /api/updates/feed — the same fetchFeedPage, so visibility can't drift.
 */

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
}

export default async function UpdatesFeed({
  participantId,
  pageType,
  pageId,
  viewerParticipantId,
  title = "Your feed",
  emptyTitle = "No updates yet",
  emptyDescription = "When people and pages you follow post updates, they show up here.",
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

  // Roles power page-admin resolution (Delete on page posts, admined pages in
  // the following feed). The member-scoped feed never consults them — skip the
  // lookup there, as before the extraction.
  const memberScoped = !pageScoped && participantId != null;
  const roles =
    user && !memberScoped ? await resolveUserRoles(supabase, user.id) : null;

  const scope: FeedScope = pageScoped
    ? { pageType, pageId }
    : memberScoped
      ? { participantId }
      : {};

  const { items, nextCursor } = await fetchFeedPage({
    service,
    scope,
    viewer: { participantId: viewerId, roles },
  });

  return (
    <section>
      <h2 className="section-head mb-3">{title}</h2>
      {items.length === 0 ? (
        !pageScoped && participantId == null ? (
          // Feed mode: an empty feed always gets the actionable nudge — the
          // fix is the same whether you follow nobody or quiet accounts.
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
        <FeedList
          initialItems={items}
          initialCursor={nextCursor}
          scope={Object.keys(scope).length > 0 ? scope : undefined}
          viewer={{
            participantId: viewerId,
            avatarUrl: viewer?.avatarUrl ?? null,
            initials: viewer?.initials ?? "•",
          }}
        />
      )}
    </section>
  );
}
