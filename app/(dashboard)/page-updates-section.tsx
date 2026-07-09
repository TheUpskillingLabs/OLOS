import UpdatesFeed from "./directory/updates-feed";
import PageUpdateComposer from "./page-update-composer";
import PageAdminsManager from "./page-admins-manager";
import type { PageType } from "@/lib/pages/authz";
import type { PageContext } from "@/lib/pages/server";

/**
 * A page's "Updates" section — the composer + admin manager (for admins) atop
 * the page's own feed. Dropped into each entity's detail page (lab, sector,
 * workstream, pod, project). Announcements stay separate; this is the page's
 * social feed.
 */
export default function PageUpdatesSection({
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
  return (
    <div className="flex flex-col gap-4">
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
