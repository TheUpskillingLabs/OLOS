import Link from "next/link";
import { requireLabLead } from "@/lib/auth/guards";
import { isAdmin } from "@/lib/auth/roles";
import { StatusBadge } from "@/app/components/ui";

/**
 * The lab-lead workspace shell (docs/LOCAL_LABS.md) at /lab/[slug] — NOT
 * /labs (that's a cached-permanent redirect to the public /local-labs
 * cities pages, next.config.ts). A separate route group
 * from /admin on purpose — the admin layout's requireAdmin() is the only
 * gate over service-role reads there, so it is never relaxed. This tree has
 * its own fail-closed gate: requireLabLead(slug) admits admins (HQ can
 * always drill in) and active leads of THIS lab; everyone else is
 * redirected. Pages below read with the service client under that gate.
 */
export default async function LabWorkspaceLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}) {
  const { slug } = await params;
  const { lab, userRoles } = await requireLabLead(slug);

  return (
    <div>
      <div className="mb-8">
        <div className="lbl mb-1.5">Local Lab workspace</div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="t-h1 text-ink">
            {lab.name}
            {lab.st ? <span className="text-meta"> ({lab.st})</span> : null}
          </h1>
          <StatusBadge variant={lab.status === "active" ? "active" : "forming"}>
            {lab.status}
          </StatusBadge>
        </div>
        {isAdmin(userRoles) && (
          <p className="mt-1 text-sm text-meta">
            <Link
              href={`/admin/labs/${lab.slug}`}
              className="font-semibold text-teal-deep hover:underline"
            >
              HQ view &rarr;
            </Link>
          </p>
        )}
      </div>
      {children}
    </div>
  );
}
