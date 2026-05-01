import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { resolveUserRoles, isAdmin, can } from "@/lib/auth/roles";
import InvitationsTable from "./invitations-table";

export default async function AdminInvitationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const serviceClient = createServiceClient();
  const userRoles = await resolveUserRoles(serviceClient, user.id);
  if (!isAdmin(userRoles)) redirect("/cycles");

  // Fetch invitations
  const { data: invitations } = await serviceClient
    .from("invitations")
    .select("id, email, token, permissions, role_preset, cycle_id, pod_id, status, created_at, expires_at, accepted_at, cycles (name)")
    .order("created_at", { ascending: false });

  // Fetch cycles for the create form dropdown
  const { data: cycles } = await serviceClient
    .from("cycles")
    .select("id, name, status")
    .order("start_date", { ascending: false });

  // Fetch pods for moderator invite
  const { data: pods } = await serviceClient
    .from("pods")
    .select("id, name, cycle_id, cycles (name)")
    .order("created_at", { ascending: false });

  const podOptions = (pods ?? []).map((p) => {
    const cycle = (p.cycles as unknown) as { name: string } | null;
    return {
      id: p.id,
      name: p.name ?? `Pod ${p.id}`,
      cycle_name: cycle?.name ?? "",
    };
  });

  const canManageRoles = can(userRoles, "roles:write");

  const pendingCount = (invitations ?? []).filter((i) => i.status === "pending").length;

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm text-cloud/60 transition-colors duration-150 hover:text-aqua focus-visible:outline-none focus-visible:text-aqua"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Admin
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
          Invitations
        </h1>
        <p className="mt-1 text-sm text-cloud/60 tabular-nums">
          {pendingCount} pending invitation{pendingCount !== 1 ? "s" : ""} &middot;{" "}
          {(invitations ?? []).length} total
        </p>
      </div>

      <InvitationsTable
        invitations={(invitations ?? []).map((inv) => {
          const cycle = (inv.cycles as unknown) as { name: string } | null;
          return {
            id: inv.id,
            email: inv.email,
            token: inv.token,
            permissions: inv.permissions as string[],
            role_preset: inv.role_preset,
            cycle_id: inv.cycle_id,
            cycle_name: cycle?.name ?? null,
            pod_id: inv.pod_id,
            status: inv.status,
            created_at: inv.created_at,
            expires_at: inv.expires_at,
            accepted_at: inv.accepted_at,
          };
        })}
        cycles={(cycles ?? []).map((c) => ({ id: c.id, name: c.name }))}
        pods={podOptions}
        canManageRoles={canManageRoles}
      />
    </div>
  );
}
