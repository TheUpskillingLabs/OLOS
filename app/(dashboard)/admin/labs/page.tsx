import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { StatusBadge, DataTable } from "@/app/components/ui";
import { one } from "@/lib/supabase/embed";

/**
 * The Local Labs directory (docs/LOCAL_LABS.md): every metro as an
 * organizational tenant — status, member count, leads, current cycle
 * streams — with drill-in to /admin/labs/[slug]. HQ-only surface; the
 * lab-lead workspace itself is /labs/[slug] (Phase 3).
 */

type MetroRow = {
  id: number;
  slug: string;
  name: string;
  st: string | null;
  status: string;
  is_default: boolean;
};

type LabListRow = MetroRow & {
  member_count: number;
  lead_names: string[];
  cycle_summary: string;
};

type EmbeddedName = {
  first_name: string;
  last_name: string;
  preferred_name: string | null;
};

export default async function AdminLabsPage() {
  const { serviceClient } = await requireAdmin();

  const [{ data: metros }, { data: memberRows }, { data: leadRows }, { data: cycleRows }] =
    await Promise.all([
      serviceClient
        .from("metros")
        .select("id, slug, name, st, status, is_default")
        .order("status")
        .order("name"),
      serviceClient
        .from("participants")
        .select("metro_id")
        .not("metro_id", "is", null),
      serviceClient
        .from("lab_leads")
        .select(
          "lab_id, participants!lab_leads_participant_id_fkey(first_name, last_name, preferred_name)"
        )
        .is("removed_at", null),
      serviceClient
        .from("cycles")
        .select("lab_id, status, mode")
        .not("lab_id", "is", null)
        .in("status", ["draft", "upcoming", "active", "closing"]),
    ]);

  const membersByMetro: Record<number, number> = {};
  for (const row of memberRows ?? []) {
    if (row.metro_id == null) continue;
    membersByMetro[row.metro_id] = (membersByMetro[row.metro_id] ?? 0) + 1;
  }

  const leadsByLab: Record<number, string[]> = {};
  for (const row of leadRows ?? []) {
    const p = one(row.participants as EmbeddedName | EmbeddedName[] | null);
    if (!p) continue;
    (leadsByLab[row.lab_id] ??= []).push(
      `${p.preferred_name || p.first_name} ${p.last_name}`.trim()
    );
  }

  const cyclesByLab: Record<number, { open: number; org: number }> = {};
  for (const row of cycleRows ?? []) {
    if (row.lab_id == null) continue;
    const entry = (cyclesByLab[row.lab_id] ??= { open: 0, org: 0 });
    if (row.mode === "org") entry.org += 1;
    else entry.open += 1;
  }

  const rows: LabListRow[] = ((metros ?? []) as MetroRow[]).map((m) => {
    const counts = cyclesByLab[m.id];
    const parts: string[] = [];
    if (counts?.open) parts.push(`${counts.open} participant`);
    if (counts?.org) parts.push(`${counts.org} internal`);
    return {
      ...m,
      member_count: membersByMetro[m.id] ?? 0,
      lead_names: leadsByLab[m.id] ?? [],
      cycle_summary: parts.length ? parts.join(" · ") : "—",
    };
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="t-h1 text-ink">Local Labs</h1>
        <p className="mt-1 text-sm text-meta">
          The labs as organizational tenants — leadership, cycle streams, and
          members. Cycles stay centrally coordinated from here; labs manage
          their own pods and rosters.
        </p>
      </div>

      <DataTable<LabListRow>
        rows={rows}
        rowKey={(row) => row.id}
        empty="No local labs yet."
        columns={[
          {
            key: "lab",
            header: "Lab",
            className: "font-medium text-ink",
            cell: (row) => (
              <span>
                {row.name}
                {row.st ? <span className="ml-1 text-meta">({row.st})</span> : null}
                {row.is_default && (
                  <span className="ml-2 inline-flex items-center rounded-sm bg-ink/[0.04] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-meta">
                    default
                  </span>
                )}
              </span>
            ),
          },
          {
            key: "status",
            header: "Status",
            cell: (row) => (
              <StatusBadge variant={row.status === "active" ? "active" : "forming"}>
                {row.status}
              </StatusBadge>
            ),
          },
          {
            key: "members",
            header: "Members",
            className: "text-meta tabular-nums",
            cell: (row) => row.member_count,
          },
          {
            key: "leads",
            header: "Leads",
            className: "text-meta",
            cell: (row) => row.lead_names.join(", ") || "—",
          },
          {
            key: "cycles",
            header: "Current cycles",
            className: "text-meta",
            cell: (row) => row.cycle_summary,
          },
          {
            key: "actions",
            header: "",
            align: "right",
            cell: (row) => (
              <Link
                href={`/admin/labs/${row.slug}`}
                className="text-sm font-semibold tracking-tight text-teal-deep transition-colors duration-150 hover:text-ink"
              >
                Manage &rarr;
              </Link>
            ),
          },
        ]}
      />
    </div>
  );
}
