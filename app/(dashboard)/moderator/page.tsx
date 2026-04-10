import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { resolveUserRoles, isAdmin, isModerator, can } from "@/lib/auth/roles";

export default async function ModeratorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const serviceClient = createServiceClient();
  const userRoles = await resolveUserRoles(serviceClient, user.id);

  const hasPodAccess = can(userRoles, "pods:read") || isModerator(userRoles);
  if (!hasPodAccess) redirect("/cycles");

  const admin = isAdmin(userRoles) || can(userRoles, "pods:read");

  // Admins see all pods; moderators see only their assigned pods
  let pods: {
    pod_id: number;
    pod_name: string;
    status: string;
    cycle_name: string;
    cycle_id: number;
  }[] = [];

  if (admin) {
    // Fetch all pods across active cycles
    const { data: allPods } = await serviceClient
      .from("pods")
      .select("id, name, status, cycle_id, cycles (name)")
      .order("created_at", { ascending: false });

    pods = (allPods ?? []).map((p) => {
      const cycle = (p.cycles as unknown) as { name: string } | null;
      return {
        pod_id: p.id,
        pod_name: p.name ?? `Pod ${p.id}`,
        status: p.status,
        cycle_name: cycle?.name ?? "",
        cycle_id: p.cycle_id,
      };
    });
  } else {
    // Moderator: fetch only assigned pods
    const { data: assignments } = await serviceClient
      .from("moderator_assignments")
      .select(
        "pod_id, assigned_at, pods (id, name, status, cycle_id, cycles (name))"
      )
      .eq("participant_id", userRoles.participantId!)
      .is("removed_at", null)
      .order("assigned_at", { ascending: false });

    pods = (assignments ?? []).map((a) => {
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
        cycle_id: pod?.cycle_id ?? 0,
      };
    });
  }

  // Group pods by cycle
  const podsByCycle: Record<string, typeof pods> = {};
  for (const pod of pods) {
    const key = pod.cycle_name || "Other";
    (podsByCycle[key] ??= []).push(pod);
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-white">
        {admin ? "All Pods" : "My Pods"}
      </h1>
      <p className="mb-8 text-sm text-cloud/60">
        {admin
          ? "All pods across cycles. Click to view pulse check responses and member activity."
          : "Pods you are assigned to moderate. View pulse check responses and member activity."}
      </p>

      {pods.length === 0 ? (
        <p className="text-sm text-cloud/40">
          {admin
            ? "No pods have been created yet."
            : "You are not currently assigned to moderate any pods."}
        </p>
      ) : (
        <div className="space-y-8">
          {Object.entries(podsByCycle).map(([cycleName, cyclePods]) => (
            <div key={cycleName}>
              <h2 className="mb-3 text-sm font-medium text-cloud/60">
                {cycleName}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {cyclePods.map((pod) => (
                  <Link
                    key={pod.pod_id}
                    href={`/pods/${pod.pod_id}`}
                    className="rounded-md border border-whisper bg-white/[0.02] p-4 transition-colors hover:border-teal/40 hover:bg-white/[0.04]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white">
                        {pod.pod_name}
                      </span>
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
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
