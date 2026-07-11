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
  lab_id: number | null;
};

/** Shared column set for both cycle sections (P-1) — the headcount column's
    header ("Participants" vs. "Core contributors") and cell noun ("enrolled" vs. "core contributors")
    differ per section. labNameById (non-null once any lab cycle exists) adds
    a Lab column so the global list stays legible across streams. */
function cycleColumns(
  countsByCycle: Map<number, { total: number; active: number }>,
  countHeader: string,
  countNoun = "enrolled",
  labNameById: Map<number, string> | null = null
): Column<CycleListRow>[] {
  const labColumn: Column<CycleListRow>[] = labNameById
    ? [
        {
          key: "lab",
          header: "Lab",
          className: "text-meta",
          cell: (cycle) =>
            cycle.lab_id === null
              ? "HQ"
              : (labNameById.get(cycle.lab_id) ?? `Lab ${cycle.lab_id}`),
        },
      ]
    : [];
  return [
    {
      key: "cycle",
      header: "Cycle",
      className: "font-medium text-ink",
      cell: (cycle) => cycle.name,
    },
    ...labColumn,
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
          className="text-sm font-semibold tracking-tight text-teal-deep transition-colors duration-150 hover:text-ink"
        >
          Manage &rarr;
        </Link>
      ),
    },
  ];
}

export default async function AdminPage() {
  const { serviceClient } = await requireAdmin();

  const [{ data: cycles }, { data: enrollmentRows }, { data: metroRows }] = await Promise.all([
    serviceClient.from("cycles").select("id, name, start_date, end_date, status, mode, lab_id").order("start_date", { ascending: false }),
    serviceClient.from("cycle_enrollments").select("cycle_id, status"),
    serviceClient.from("metros").select("id, name"),
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

  // The Lab column only appears once a lab cycle exists — before that the
  // list is single-stream and the column would be all "HQ" noise.
  const labNameById = allCycles.some((c) => c.lab_id !== null)
    ? new Map((metroRows ?? []).map((m) => [m.id, m.name] as [number, string]))
    : null;

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
          columns={cycleColumns(countsByCycle, "Participants", "enrolled", labNameById)}
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
            columns={cycleColumns(countsByCycle, "Core contributors", "core contributors", labNameById)}
          />
        </section>
      )}
    </div>
  );
}
