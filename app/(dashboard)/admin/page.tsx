import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { StatusBadge, DataTable } from "@/app/components/ui";
// The one nav link into the Entity Explorer (DESIGN.md §4). Behind the same flag
// as the route; removing the feature = delete this block + the two folders.
import { ENTITY_EXPLORER_ENABLED } from "@/lib/entity-explorer/flag";
import CreateCycleForm from "./cycles/create-cycle-form";
import SyncEventsButton from "./sync-events-button";

type CycleStatus = "active" | "closed" | "draft";

type CycleListRow = {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
};

const CYCLE_STATUS_VARIANT: Record<CycleStatus, "active" | "inactive" | "draft"> = {
  active: "active",
  closed: "inactive",
  draft: "draft",
};

export default async function AdminPage() {
  const { serviceClient } = await requireAdmin();

  const [{ data: cycles }, { data: enrollmentRows }] = await Promise.all([
    serviceClient.from("cycles").select("id, name, start_date, end_date, status").order("start_date", { ascending: false }),
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

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="t-h1 text-ink">
            Admin
          </h1>
          <p className="mt-1 text-sm text-meta tabular-nums">
            {cycles?.length ?? 0} cycle{cycles?.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/invitations"
            className="btn btn-ghost px-4 py-2 text-sm"
          >
            Invitations
          </Link>
          <Link
            href="/admin/participants"
            className="btn btn-ghost px-4 py-2 text-sm"
          >
            All participants
          </Link>
          <Link
            href="/admin/stories"
            className="btn btn-ghost px-4 py-2 text-sm"
          >
            Stories
          </Link>
          {ENTITY_EXPLORER_ENABLED && (
            <Link
              href="/admin/explore"
              className="btn btn-ghost inline-flex items-center gap-2 px-4 py-2 text-sm"
            >
              Explore
              <span className="rounded-sm bg-teal/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-deep">
                flag
              </span>
            </Link>
          )}
          <SyncEventsButton />
          <CreateCycleForm />
        </div>
      </div>

      <DataTable<CycleListRow>
        rows={(cycles ?? []) as CycleListRow[]}
        rowKey={(cycle) => cycle.id}
        empty="No cycles yet. Create one to get started."
        columns={[
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
              <StatusBadge
                variant={CYCLE_STATUS_VARIANT[cycle.status as CycleStatus] ?? "inactive"}
              >
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
            header: "Participants",
            className: "text-meta tabular-nums",
            cell: (cycle) => {
              const counts = countsByCycle.get(cycle.id) ?? { total: 0, active: 0 };
              return `${counts.active} active / ${counts.total} enrolled`;
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
        ]}
      />
    </div>
  );
}
