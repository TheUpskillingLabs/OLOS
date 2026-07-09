import Link from "next/link";
import { StatusBadge } from "@/app/components/ui";
import { podNoun } from "@/lib/cycle/labels";
import {
  hasAnyMembership,
  type ParticipantMemberships,
  type MembershipEntity,
} from "@/lib/participants/memberships";

/**
 * The left-rail "pages/groups" list — the entities a member belongs to (org
 * unit, local lab, cycle, pods, projects), LinkedIn-style. Each row deep-links
 * when it has a route; the org unit (sector/workstream) has no public page, so
 * it renders as a plain chip.
 */

function badgeVariant(
  status: string
): "active" | "forming" | "inactive" {
  if (status === "active") return "active";
  if (status === "forming") return "forming";
  return "inactive";
}

function Row({ entity }: { entity: MembershipEntity }) {
  const inner = (
    <div className="flex items-center justify-between gap-2">
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-ink">
          {entity.name}
        </span>
        {entity.sublabel && (
          <span className="block truncate text-xs text-meta">
            {entity.sublabel}
          </span>
        )}
      </span>
      {entity.status && (
        <StatusBadge variant={badgeVariant(entity.status)}>
          {entity.status}
        </StatusBadge>
      )}
    </div>
  );

  if (!entity.href) {
    return <div className="px-3 py-2">{inner}</div>;
  }
  return (
    <Link
      href={entity.href}
      className="block rounded-card px-3 py-2 transition-colors duration-150 ease-out hover:bg-ink/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
    >
      {inner}
    </Link>
  );
}

export default function MembershipsPanel({
  memberships,
  mode,
}: {
  memberships: ParticipantMemberships;
  mode: string | null;
}) {
  if (!hasAnyMembership(memberships)) {
    return (
      <section className="rounded-card border border-ink/10 bg-white p-5 shadow-card">
        <h2 className="lbl lbl-teal mb-2">Your groups</h2>
        <p className="text-sm text-meta">You&apos;re not in any groups yet.</p>
      </section>
    );
  }

  const pods = memberships.pods;
  const projects = memberships.projects;
  const sections: [string, MembershipEntity[]][] = [
    ["Org unit", memberships.orgUnit ? [memberships.orgUnit] : []],
    ["Local lab", memberships.lab ? [memberships.lab] : []],
    [memberships.cycles.length === 1 ? "Cycle" : "Cycles", memberships.cycles],
    [podNoun(mode, pods.length !== 1), pods],
    [projects.length === 1 ? "Project" : "Projects", projects],
  ];

  return (
    <section className="rounded-card border border-ink/10 bg-white p-5 shadow-card">
      <h2 className="lbl lbl-teal mb-3">Your groups</h2>
      <div className="space-y-4">
        {sections
          .filter(([, items]) => items.length > 0)
          .map(([label, items]) => (
            <div key={label}>
              <div className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wide text-meta">
                {label}
              </div>
              <div className="space-y-0.5">
                {items.map((e) => (
                  <Row key={`${e.kind}-${e.id}`} entity={e} />
                ))}
              </div>
            </div>
          ))}
      </div>
    </section>
  );
}
