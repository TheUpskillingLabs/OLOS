import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { StatusBadge, DataTable, type Column } from "@/app/components/ui";
import { cycleStatusVariant } from "@/lib/cycle/labels";
import CreateCycleForm from "./cycles/create-cycle-form";

type CycleListRow = {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  mode: string | null;
};

/** Shared column set for both cycle sections (P-1) — the headcount column's
    header ("Participants" vs. "Staff") and cell noun ("enrolled" vs. "staff")
    differ per section. */
function cycleColumns(
  countsByCycle: Map<number, { total: number; active: number }>,
  countHeader: string,
  countNoun = "enrolled"
): Column<CycleListRow>[] {
  return [
    {
      key: "cycle",
      header: "Cycle",
      className: "font-medium text-ink",
      cell: (cycle) => cycle.name,
    },
    {
      key: "status",
      header: "Status",
      cell: (cycle) => (
        <StatusBadge variant={cycleStatusVariant(cycle.status)}>
          {cycle.status}
        </StatusBadge>
      ),
    },
    {
      key: "dates",
      header: "Dates",
      className: "text-meta tabular-nums",
      cell: (cycle) => (
        <>
          {new Date(cycle.start_date).toLocaleDateString()} &ndash;{" "}
          {new Date(cycle.end_date).toLocaleDateString()}
        </>
      ),
    },
    {
      key: "participants",
      header: countHeader,
      className: "text-meta tabular-nums",
      cell: (cycle) => {
        const counts = countsByCycle.get(cycle.id) ?? { total: 0, active: 0 };
        return `${counts.active} active / ${counts.total} ${countNoun}`;
      },
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (cycle) => (
        <Link
          href={`/admin/cycles/${cycle.id}`}
          className="text-sm font-semibold tracking-tight text-teal-deep transition-colors duration-150 hover:text-ink focus-visible:outline-none focus-visible:text-ink"
        >
          Manage &rarr;
        </Link>
      ),
    },
  ];
}

export default async function AdminPage() {
  const { serviceClient } = await requireAdmin();

  const [{ data: cycles }, { data: enrollmentRows }] = await Promise.all([
    serviceClient.from("cycles").select("id, name, start_date, end_date, status, mode").order("start_date", { ascending: false }),
    serviceClient.from("cycle_enrollments").select("cycle_id, status"),
  ]);

  const countsByCycle = new Map<number, { total: number; active: number }>();
  for (const e of enrollmentRows || []) {
    const curr = countsByCycle.get(e.cycle_id) ?? { total: 0, active: 0 };
    countsByCycle.set(e.cycle_id, {
      total: curr.total + 1,
      active: curr.active + (e.status === "active" ? 1 : 0),
    });
  }

  const allCycles = (cycles ?? []) as CycleListRow[];
  const participantCycles = allCycles.filter((c) => c.mode !== "org");
  const orgCycles = allCycles.filter((c) => c.mode === "org");

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="t-h1 text-ink">Cycles</h1>
          <p className="mt-1 text-sm text-meta tabular-nums">
            {allCycles.length} cycle{allCycles.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <CreateCycleForm />
      </div>

      <section className={orgCycles.length > 0 ? "mb-10" : undefined}>
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="t-h3 text-ink">Participant cycles</h2>
          <span className="text-sm text-meta tabular-nums">
            {participantCycles.length} cycle{participantCycles.length !== 1 ? "s" : ""}
          </span>
        </div>
        <DataTable<CycleListRow>
          rows={participantCycles}
          rowKey={(cycle) => cycle.id}
          empty="No cycles yet. Create one to get started."
          columns={cycleColumns(countsByCycle, "Participants")}
        />
      </section>

      {orgCycles.length > 0 && (
        <section>
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="t-h3 text-ink">Organization cycles</h2>
            <span className="text-sm text-meta tabular-nums">
              {orgCycles.length} cycle{orgCycles.length !== 1 ? "s" : ""}
            </span>
          </div>
          <DataTable<CycleListRow>
            rows={orgCycles}
            rowKey={(cycle) => cycle.id}
            empty="No organization cycles yet."
            columns={cycleColumns(countsByCycle, "Staff", "staff")}
          />
        </section>
      )}
    </div>
  );
}
