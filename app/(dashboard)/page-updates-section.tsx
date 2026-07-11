import UpdatesFeed from "./directory/updates-feed";
import PageUpdateComposer from "./page-update-composer";
import PageAdminsManager from "./page-admins-manager";
import { createServiceClient } from "@/lib/supabase/server";
import type { PageType } from "@/lib/pages/authz";
import type { PageContext } from "@/lib/pages/server";

/**
 * A page's "Updates" section — the composer + admin manager (for admins) atop
 * the page's own feed, with the page's follower count (the audience its posts
 * reach). Dropped into each entity's detail page (lab, sector, workstream, pod,
 * project). Announcements stay separate; this is the page's social feed.
 */
export default async function PageUpdatesSection({
  type,
  id,
  name,
  ctx,
}: {
  type: PageType;
  id: number;
  name: string;
  ctx: PageContext;
}) {
  const service = createServiceClient();
  const { count: followers } = await service
    .from("follows")
    .select("id", { head: true, count: "exact" })
    .eq("page_type", type)
    .eq("page_id", id);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-meta">
        {followers ?? 0} {followers === 1 ? "follower" : "followers"} — updates
        from this page appear in their feed
      </p>
      {ctx.isAdmin && (
        <>
          <PageUpdateComposer pageType={type} pageId={id} pageName={name} />
          <PageAdminsManager
            pageType={type}
            pageId={id}
            initialAdmins={ctx.admins}
          />
        </>
      )}
      <UpdatesFeed
        pageType={type}
        pageId={id}
        title="Updates"
        emptyTitle="No updates yet"
        emptyDescription={`When ${name} posts an update, it shows up here — and in the feeds of everyone who follows this page.`}
      />
    </div>
  );
}
