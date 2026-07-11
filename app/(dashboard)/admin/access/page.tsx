import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { isOwner } from "@/lib/auth/roles";
import { StatusBadge, DataTable, type Column } from "@/app/components/ui";
import { formatDate } from "@/lib/format/date";
import { one } from "@/lib/supabase/embed";
import {
  GrantRoleForm,
  RoleRevokeButton,
  type ParticipantOption,
} from "./access-controls";

/**
 * The Access console (docs auth unification): the whole authority tree in one
 * owner-rooted place, read from participant_roles — the single source of truth
 * the app and DB RLS both read. Every grant shows its provenance (who granted
 * it, when), so any person's power traces back up to the HQ owner.
 *
 * v1 is read/visualization: it surfaces "who can do what, and why," and links
 * to the existing edit surfaces (People & Access for global roles, the lab
 * drill-in for leads, project pages for contributors). Inline editing lands
 * once granular capabilities move onto roles (a later commit).
 */

type Embedded = {
  id?: number;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  email?: string;
};

type RoleRow = {
  id: number;
  role: string;
  granted_at: string;
  note: string | null;
  lab_id: number | null;
  pod_id: number | null;
  subject: Embedded | Embedded[] | null;
  granter: Embedded | Embedded[] | null;
  lab: { name: string } | { name: string }[] | null;
  pod: { name: string } | { name: string }[] | null;
};

type Node = {
  id: number; // participant_roles row id
  participantId: number | null;
  name: string;
  email: string;
  grantedBy: string | null; // null = the root
  grantedAt: string;
  note: string | null;
  labName: string | null;
  podName: string | null;
};

function personName(p: Embedded | null): string {
  if (!p) return "—";
  return `${p.preferred_name || p.first_name} ${p.last_name}`.trim();
}

const AUTHORITY_ROLES = new Set([
  "owner",
  "admin",
  "developer",
  "observer",
  "lab_lead",
  "poderator",
  "staff",
  "tester",
  "dri",
  "contributor",
]);

export default async function AccessConsolePage() {
  const { serviceClient, userRoles } = await requireAdmin();
  const canGrantOwner = isOwner(userRoles);

  const [{ data }, { data: peopleRows }] = await Promise.all([
    serviceClient
      .from("participant_roles")
      .select(
        `id, role, granted_at, note, lab_id, pod_id,
         subject:participants!participant_roles_participant_id_fkey(id, first_name, last_name, preferred_name, email),
         granter:participants!participant_roles_granted_by_fkey(first_name, last_name, preferred_name),
         lab:metros(name),
         pod:pods(name)`
      )
      .is("revoked_at", null)
      .order("granted_at", { ascending: true }),
    serviceClient
      .from("participants")
      .select("id, first_name, last_name, preferred_name, email")
      .order("first_name"),
  ]);

  const rows = (data ?? []) as RoleRow[];
  const participantOptions: ParticipantOption[] = (peopleRows ?? []).map((p) => ({
    id: p.id,
    name: `${personName(p as Embedded)}${p.email ? ` (${p.email})` : ""}`,
  }));

  const byRole: Record<string, Node[]> = {};
  for (const r of rows) {
    if (!AUTHORITY_ROLES.has(r.role)) continue;
    const subject = one(r.subject as Embedded | Embedded[] | null);
    const granter = one(r.granter as Embedded | Embedded[] | null);
    (byRole[r.role] ??= []).push({
      id: r.id,
      participantId: subject?.id ?? null,
      name: personName(subject),
      email: subject?.email ?? "",
      // The root (granted_by NULL) has no granter; everyone else records one.
      grantedBy: granter ? personName(granter) : null,
      grantedAt: r.granted_at,
      note: r.note,
      labName: one(r.lab as { name: string } | { name: string }[] | null)?.name ?? null,
      podName: one(r.pod as { name: string } | { name: string }[] | null)?.name ?? null,
    });
  }

  const owners = byRole["owner"] ?? [];
  const root = owners.find((o) => o.grantedBy === null);
  const coOwners = owners.filter((o) => o.grantedBy !== null);

  const provenanceCol: Column<Node> = {
    key: "prov",
    header: "Granted by",
    className: "text-meta",
    // Non-owner rows with no granter are pre-unification grants without
    // provenance (e.g. poderators synced from moderator_assignments, which
    // never recorded who assigned) — labelled honestly, not as the root.
    cell: (n) => (n.grantedBy === null ? <span className="italic">unrecorded</span> : n.grantedBy),
  };
  const whenCol: Column<Node> = {
    key: "when",
    header: "Since",
    className: "text-meta tabular-nums",
    cell: (n) => formatDate(n.grantedAt),
  };
  const nameCol: Column<Node> = {
    key: "name",
    header: "Person",
    className: "font-medium text-ink",
    cell: (n) => (
      <span>
        {n.name}
        {n.email ? <span className="ml-2 text-xs font-normal text-meta">{n.email}</span> : null}
      </span>
    ),
  };

  function section(
    title: string,
    nodes: Node[],
    opts: {
      empty: string;
      extraCols?: Column<Node>[];
      manageHref?: string;
      manageLabel?: string;
      revokeRole?: string;
    } = { empty: "None." }
  ) {
    const revokeCol: Column<Node>[] = opts.revokeRole
      ? [
          {
            key: "actions",
            header: "",
            align: "right",
            cell: (n) =>
              n.participantId != null ? (
                <RoleRevokeButton
                  participantId={n.participantId}
                  role={opts.revokeRole as string}
                  name={n.name}
                />
              ) : null,
          },
        ]
      : [];
    return (
      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="t-h3 text-ink">
            {title} <span className="text-meta">({nodes.length})</span>
          </h2>
          {opts.manageHref && (
            <Link
              href={opts.manageHref}
              className="text-sm font-semibold tracking-tight text-teal-deep transition-colors duration-150 hover:text-ink"
            >
              {opts.manageLabel ?? "Manage"} &rarr;
            </Link>
          )}
        </div>
        <DataTable<Node>
          rows={nodes}
          rowKey={(n) => n.id}
          empty={opts.empty}
          columns={[nameCol, ...(opts.extraCols ?? []), provenanceCol, whenCol, ...revokeCol]}
        />
      </section>
    );
  }

  const labCol: Column<Node> = {
    key: "lab",
    header: "Lab",
    className: "text-meta",
    cell: (n) => n.labName ?? "—",
  };
  const podCol: Column<Node> = {
    key: "pod",
    header: "Pod",
    className: "text-meta",
    cell: (n) => n.podName ?? "—",
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="t-h1 text-ink">Access</h1>
        <p className="mt-1 max-w-2xl text-sm text-meta">
          Every role in the org, rooted at the HQ owner, with the provenance of
          each grant. Authority resolves from one source of truth
          (<code className="text-xs">participant_roles</code>) that both the app
          and the database read. Grant or revoke a global role below; scoped
          roles (lab leads, poderators, contributors) are managed on their own
          surfaces, linked from each section.
        </p>
      </div>

      <GrantRoleForm participants={participantOptions} canGrantOwner={canGrantOwner} />

      {/* Ownership — the root of the tree */}
      <section className="mb-10">
        <h2 className="mb-4 t-h3 text-ink">Ownership</h2>
        <div className="rounded-card border border-ink/10 bg-white p-5 shadow-card">
          {root ? (
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <StatusBadge variant="active">Primary owner</StatusBadge>
              <span className="font-semibold text-ink">{root.name}</span>
              <span className="text-sm text-meta">{root.email}</span>
              <span className="text-xs text-meta">the root — all authority stems from here</span>
            </div>
          ) : (
            <p className="mb-4 text-sm text-red">No primary (rooted) owner found.</p>
          )}
          {coOwners.length > 0 && (
            <div className="border-t border-ink/10 pt-4">
              <div className="lbl mb-2">Co-owners</div>
              <ul className="space-y-1.5">
                {coOwners.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium text-ink">{o.name}</span>
                    <span className="text-meta">{o.email}</span>
                    <span className="text-xs text-meta">
                      granted by {o.grantedBy} · {formatDate(o.grantedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {section("Administrators", byRole["admin"] ?? [], {
        empty: "No admins.",
        manageHref: "/admin/people",
        manageLabel: "People & Access",
        revokeRole: "admin",
      })}
      {(byRole["developer"]?.length ?? 0) > 0 &&
        section("Developers", byRole["developer"] ?? [], {
          empty: "None.",
          revokeRole: "developer",
        })}
      {section("Observers", byRole["observer"] ?? [], {
        empty: "No observers.",
        revokeRole: "observer",
      })}

      {section("Lab leads", byRole["lab_lead"] ?? [], {
        empty: "No lab leads.",
        extraCols: [labCol],
        manageHref: "/admin/labs",
        manageLabel: "Local Labs",
      })}

      {section("Poderators & co-leads", byRole["poderator"] ?? [], {
        empty: "No poderators.",
        extraCols: [podCol],
      })}

      {((byRole["staff"]?.length ?? 0) + (byRole["tester"]?.length ?? 0)) > 0 &&
        section("Core contributors & testers", [...(byRole["staff"] ?? []), ...(byRole["tester"] ?? [])], {
          empty: "None.",
        })}

      {((byRole["dri"]?.length ?? 0) + (byRole["contributor"]?.length ?? 0)) > 0 &&
        section("Project roles", [...(byRole["dri"] ?? []), ...(byRole["contributor"] ?? [])], {
          empty: "None.",
        })}
    </div>
  );
}
