import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { resolveUserRoles, isAdmin } from "@/lib/auth/roles";
import type { Permission } from "@/lib/auth/permissions";
import PermissionsEditor from "./permissions-editor";

export default async function ParticipantPermissionsPage({
  params,
}: {
  params: Promise<{ participant_id: string }>;
}) {
  const { participant_id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const serviceClient = createServiceClient();

  const participantId = parseInt(participant_id);
  if (isNaN(participantId)) notFound();

  const [userRoles, { data: participant }, { data: permRows }, { data: roleRows }, { data: modAssignments }] =
    await Promise.all([
      resolveUserRoles(serviceClient, user.id),
      serviceClient.from("participants").select("id, first_name, last_name, preferred_name, email").eq("id", participantId).single(),
      serviceClient.from("participant_permissions").select("permission").eq("participant_id", participantId).is("revoked_at", null),
      serviceClient.from("user_roles").select("role").eq("participant_id", participantId).is("revoked_at", null),
      serviceClient.from("moderator_assignments").select("pod_id, pods (name, cycle_id, cycles (name))").eq("participant_id", participantId).is("removed_at", null),
    ]);

  if (!isAdmin(userRoles)) redirect("/cycles");
  if (!participant) notFound();

  const currentPermissions = (permRows ?? []).map((r) => r.permission as Permission);
  const currentRoles = (roleRows ?? []).map((r) => r.role as string);

  const podAssignments = (modAssignments ?? []).map((ma) => {
    const pod = (ma.pods as unknown) as { name: string | null; cycle_id: number; cycles: { name: string } | null } | null;
    return {
      pod_id: ma.pod_id,
      pod_name: pod?.name ?? `Pod ${ma.pod_id}`,
      cycle_name: pod?.cycles?.name ?? "",
    };
  });

  const displayName = participant.preferred_name
    ? `${participant.preferred_name} ${participant.last_name}`
    : `${participant.first_name} ${participant.last_name}`;

  const canManageRoles = userRoles.permissions.includes("roles:write");

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/admin/participants"
          className="inline-flex items-center gap-1.5 text-sm text-cloud/60 transition-colors duration-150 hover:text-aqua focus-visible:outline-none focus-visible:text-aqua"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          All participants
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
          {displayName}
        </h1>
        <p className="mt-1 text-sm text-cloud/80">{participant.email}</p>
        {currentRoles.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {currentRoles.map((role) => (
              <span
                key={role}
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  role === "owner"
                    ? "bg-yellow-500/15 text-yellow-300"
                    : role === "admin"
                      ? "bg-teal/15 text-aqua"
                      : role === "developer"
                        ? "bg-purple-500/15 text-purple-300"
                        : "bg-white/10 text-cloud/60"
                }`}
              >
                {role}
              </span>
            ))}
          </div>
        )}
      </div>

      <PermissionsEditor
        participantId={participantId}
        initialPermissions={currentPermissions}
        canManageRoles={canManageRoles}
        podAssignments={podAssignments}
      />
    </div>
  );
}
