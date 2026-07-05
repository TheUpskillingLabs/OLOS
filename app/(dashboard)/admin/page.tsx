import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { resolveUserRoles, isAdmin } from "@/lib/auth/roles";
import { StatusBadge } from "@/app/components/ui";
// The one nav link into the Entity Explorer (DESIGN.md §4). Behind the same flag
// as the route; removing the feature = delete this block + the two folders.
import { ENTITY_EXPLORER_ENABLED } from "@/lib/entity-explorer/flag";
import CreateCycleForm from "./cycles/create-cycle-form";
import SyncEventsButton from "./sync-events-button";

type CycleStatus = "active" | "closed" | "draft";

const CYCLE_STATUS_VARIANT: Record<CycleStatus, "active" | "inactive" | "draft"> = {
  active: "active",
  closed: "inactive",
  draft: "draft",
};

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const serviceClient = createServiceClient();

  const [userRoles, { data: cycles }, { data: enrollmentRows }] = await Promise.all([
    resolveUserRoles(serviceClient, user.id),
    serviceClient.from("cycles").select("id, name, start_date, end_date, status").order("start_date", { ascending: false }),
    serviceClient.from("cycle_enrollments").select("cycle_id, status"),
  ]);

  if (!isAdmin(userRoles)) redirect("/cycles");

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

      <div className="overflow-hidden rounded-card border border-ink/10 bg-white shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-ink/[0.02]">
            <tr>
              <th className="lbl px-4 py-3 text-left">
                Cycle
              </th>
              <th className="lbl px-4 py-3 text-left">
                Status
              </th>
              <th className="lbl px-4 py-3 text-left">
                Dates
              </th>
              <th className="lbl px-4 py-3 text-left">
                Participants
              </th>
              <th className="lbl px-4 py-3 text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {(cycles ?? []).map((cycle) => {
              const counts = countsByCycle.get(cycle.id) ?? {
                total: 0,
                active: 0,
              };
              const variant =
                CYCLE_STATUS_VARIANT[cycle.status as CycleStatus] ?? "inactive";
              return (
                <tr
                  key={cycle.id}
                  className="transition-colors duration-150 hover:bg-ink/[0.02]"
                >
                  <td className="px-4 py-3 font-medium text-ink">
                    {cycle.name}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge variant={variant}>{cycle.status}</StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-meta tabular-nums">
                    {new Date(cycle.start_date).toLocaleDateString()} &ndash;{" "}
                    {new Date(cycle.end_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-meta tabular-nums">
                    {counts.active} active / {counts.total} enrolled
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/cycles/${cycle.id}`}
                      className="text-sm font-semibold tracking-tight text-teal-deep transition-colors duration-150 hover:text-ink focus-visible:outline-none focus-visible:text-ink"
                    >
                      Manage &rarr;
                    </Link>
                  </td>
                </tr>
              );
            })}
            {(!cycles || cycles.length === 0) && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-sm text-meta"
                >
                  No cycles yet. Create one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
