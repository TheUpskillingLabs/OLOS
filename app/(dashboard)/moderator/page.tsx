import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { resolveUserRoles, isModerator } from "@/lib/auth/roles";

export default async function ModeratorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const serviceClient = createServiceClient();
  const userRoles = await resolveUserRoles(serviceClient, user.id);

  if (!isModerator(userRoles)) redirect("/cycles");

  // Fetch assigned pods with details
  const { data: assignments } = await serviceClient
    .from("moderator_assignments")
    .select(
      "pod_id, assigned_at, pods (id, name, status, cycle_id, cycles (name))"
    )
    .eq("participant_id", userRoles.participantId!)
    .is("removed_at", null)
    .order("assigned_at", { ascending: false });

  const pods = (assignments ?? []).map((a) => {
    const pod = (a.pods as unknown) as {
      id: number;
      name: string | null;
      status: string;
      cycle_id: number;
      cycles: { name: string } | null;
    } | null;
    return {
      pod_id: a.pod_id,
      pod_name: pod?.name ?? `Pod ${a.pod_id}`,
      status: pod?.status ?? "unknown",
      cycle_name: pod?.cycles?.name ?? "",
      assigned_at: a.assigned_at,
    };
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-white">My Pods</h1>
      <p className="mb-8 text-sm text-cloud/60">
        Pods you are assigned to moderate. View pulse check responses and member
        activity.
      </p>

      {pods.length === 0 ? (
        <p className="text-sm text-cloud/40">
          You are not currently assigned to moderate any pods.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pods.map((pod) => (
            <Link
              key={pod.pod_id}
              href={`/pods/${pod.pod_id}`}
              className="rounded-md border border-whisper bg-white/[0.02] p-4 transition-colors hover:border-teal/40 hover:bg-white/[0.04]"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-white">{pod.pod_name}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    pod.status === "active"
                      ? "bg-teal/20 text-aqua"
                      : pod.status === "forming"
                        ? "bg-teal/10 text-teal"
                        : "bg-white/10 text-cloud/60"
                  }`}
                >
                  {pod.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-cloud/60">{pod.cycle_name}</p>
              <p className="mt-2 text-xs text-cloud/40">
                Assigned {new Date(pod.assigned_at).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
