import Link from "next/link";
import { Users } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { resolveUserRoles, isAdmin, isModerator, can } from "@/lib/auth/roles";
import { EmptyState, StatusBadge } from "@/app/components/ui";

type PodStatus = "active" | "forming" | "closed" | "inactive";

const POD_STATUS_VARIANT: Record<
  PodStatus,
  "active" | "forming" | "inactive"
> = {
  active: "active",
  forming: "forming",
  closed: "inactive",
  inactive: "inactive",
};

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
      <h1 className="mb-2 text-2xl font-bold tracking-tight text-white">
        {admin ? "All pods" : "My pods"}
      </h1>
      <p className="mb-8 text-sm text-cloud/80">
        {admin
          ? "All pods across cycles. Click to view pulse check responses and member activity."
          : "Pods you are assigned to moderate. View pulse check responses and member activity."}
      </p>

      {pods.length === 0 ? (
        <EmptyState
          icon={Users}
          title={admin ? "No pods yet" : "No assigned pods"}
          description={
            admin
              ? "No pods have been created yet."
              : "You are not currently assigned to moderate any pods."
          }
        />
      ) : (
        <div className="space-y-8">
          {Object.entries(podsByCycle).map(([cycleName, cyclePods]) => (
            <div key={cycleName}>
              <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-cloud/60">
                {cycleName}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {cyclePods.map((pod) => {
                  const variant =
                    POD_STATUS_VARIANT[pod.status as PodStatus] ?? "inactive";
                  return (
                    <Link
                      key={pod.pod_id}
                      href={`/pods/${pod.pod_id}`}
                      className="rounded-md border border-whisper bg-white/[0.02] p-4 transition-colors duration-150 ease-out hover:border-white/[0.12] hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold tracking-tight text-white">
                          {pod.pod_name}
                        </span>
                        <StatusBadge variant={variant}>{pod.status}</StatusBadge>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
