import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { resolveUserRoles, isAdmin } from "@/lib/auth/roles";
import CreateCycleForm from "./cycles/create-cycle-form";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const serviceClient = createServiceClient();
  const userRoles = await resolveUserRoles(serviceClient, user.id);
  if (!isAdmin(userRoles)) redirect("/cycles");

  const { data: cycles } = await serviceClient
    .from("cycles")
    .select("id, name, start_date, end_date, status")
    .order("start_date", { ascending: false });

  const { data: enrollmentRows } = await serviceClient
    .from("cycle_enrollments")
    .select("cycle_id, status");

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
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin</h1>
          <p className="mt-1 text-sm text-cloud/60">
            {cycles?.length ?? 0} cycle{cycles?.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/invitations"
            className="rounded-md px-4 py-2 text-sm font-medium text-cloud/60 ring-1 ring-whisper hover:bg-white/[0.04] hover:text-cloud"
          >
            Invitations
          </Link>
          <Link
            href="/admin/participants"
            className="rounded-md px-4 py-2 text-sm font-medium text-cloud/60 ring-1 ring-whisper hover:bg-white/[0.04] hover:text-cloud"
          >
            All Participants
          </Link>
          <CreateCycleForm />
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-whisper">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.04]">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-cloud/60">
                Cycle
              </th>
              <th className="px-4 py-3 text-left font-medium text-cloud/60">
                Status
              </th>
              <th className="px-4 py-3 text-left font-medium text-cloud/60">
                Dates
              </th>
              <th className="px-4 py-3 text-left font-medium text-cloud/60">
                Participants
              </th>
              <th className="px-4 py-3 text-right font-medium text-cloud/60" />
            </tr>
          </thead>
          <tbody className="divide-y divide-whisper">
            {(cycles ?? []).map((cycle) => {
              const counts = countsByCycle.get(cycle.id) ?? {
                total: 0,
                active: 0,
              };
              return (
                <tr key={cycle.id}>
                  <td className="px-4 py-3 font-medium text-white">
                    {cycle.name}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        cycle.status === "active"
                          ? "bg-teal/20 text-aqua"
                          : cycle.status === "closed"
                            ? "bg-white/10 text-cloud/60"
                            : "bg-yellow-500/20 text-yellow-300"
                      }`}
                    >
                      {cycle.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-cloud/60">
                    {new Date(cycle.start_date).toLocaleDateString()} &ndash;{" "}
                    {new Date(cycle.end_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-cloud/60">
                    {counts.active} active / {counts.total} enrolled
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/cycles/${cycle.id}`}
                      className="text-sm font-medium text-cloud/60 hover:text-aqua"
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
                  className="px-4 py-8 text-center text-cloud/60"
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
