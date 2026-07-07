import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import type { Permission } from "@/lib/auth/permissions";
import PermissionsEditor from "./permissions-editor";
import AdminNameEditForm from "./admin-name-edit-form";

export default async function ParticipantPermissionsPage({
  params,
}: {
  params: Promise<{ participant_id: string }>;
}) {
  const { participant_id } = await params;
  const { userRoles, serviceClient } = await requireAdmin();

  const participantId = parseInt(participant_id);
  if (isNaN(participantId)) notFound();

  const [{ data: participant }, { data: permRows }, { data: roleRows }, { data: modAssignments }] =
    await Promise.all([
      serviceClient.from("participants").select("id, first_name, last_name, preferred_name, email, is_test").eq("id", participantId).single(),
      serviceClient.from("participant_permissions").select("permission").eq("participant_id", participantId).is("revoked_at", null),
      serviceClient.from("user_roles").select("role").eq("participant_id", participantId).is("revoked_at", null),
      serviceClient.from("moderator_assignments").select("pod_id, pods (name, cycle_id, cycles (name))").eq("participant_id", participantId).is("removed_at", null),
    ]);

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
          className="inline-flex items-center gap-1.5 text-sm text-meta transition-colors duration-150 hover:text-teal-deep focus-visible:outline-none focus-visible:text-teal-deep"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          All participants
        </Link>
        <h1 className="mt-2 t-h1 text-ink">
          {displayName}
        </h1>
        <p className="mt-1 text-sm text-charcoal">{participant.email}</p>
        {currentRoles.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {currentRoles.map((role) => (
              <span
                key={role}
                className={`inline-flex items-center rounded-sm px-2.5 py-0.5 text-xs font-medium ${
                  role === "owner"
                    ? "bg-ink/10 text-ink"
                    : role === "admin"
                      ? "bg-teal/10 text-teal-deep"
                      : role === "developer"
                        ? "bg-forest/10 text-forest"
                        : "bg-ink/[0.04] text-meta"
                }`}
              >
                {role}
              </span>
            ))}
          </div>
        )}
      </div>

      <AdminNameEditForm
        participantId={participantId}
        initial={{
          first_name: participant.first_name ?? "",
          last_name: participant.last_name ?? "",
          preferred_name: participant.preferred_name ?? "",
        }}
      />

      <PermissionsEditor
        participantId={participantId}
        initialPermissions={currentPermissions}
        canManageRoles={canManageRoles}
        podAssignments={podAssignments}
        initialIsTest={!!participant.is_test}
      />
    </div>
  );
}
