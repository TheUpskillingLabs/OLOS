import Link from "next/link";
import { parseWindow, fmtLabDateTime } from "@/lib/cycles/lab-time";
import { ArrowRight } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { checkPodJoinWindow } from "@/lib/auth/windows";
import { effectiveUser } from "@/lib/auth/simulation";
import { notFound } from "next/navigation";
import PodRegistration from "./pod-registration";

export default async function RegisterPodsPage({
  params,
}: {
  params: Promise<{ cycle_id: string }>;
}) {
  const { cycle_id } = await params;
  const cycleId = parseInt(cycle_id, 10);
  const supabase = await createClient();

  const [{ data: cycle }, { data: config }, user] = await Promise.all([
    supabase.from("cycles").select("id, name, status").eq("id", cycleId).single(),
    // maybeSingle: a cycle with no cycle_config row is a real production
    // state (config is seeded by hand) — .single() errors instead of
    // reading as a closed window (vibe-scan PP6, matching propose/vote).
    createServiceClient().from("cycle_config").select("pod_registration_open, pod_registration_close, pod_limit").eq("cycle_id", cycleId).maybeSingle(),
    effectiveUser(),
  ]);

  if (!cycle) notFound();

  // Same gate as the join route (lib/auth/windows.ts): pod_forming OR the
  // pod_active_join overlay, so this page and the POST it drives can never
  // disagree — the old windowOpen(config columns) check here ignored phase
  // rows and the late-join overlay entirely.
  const now = new Date();
  const joinWindow = await checkPodJoinWindow(createServiceClient(), cycleId);
  const isOpen = joinWindow.open;
  const isLateJoin = joinWindow.via === "pod_active_join";

  const podLimit = config?.pod_limit ?? 1;
  const single = podLimit === 1;

  let myPodIds: number[] = [];
  if (user) {
    const { data: participant } = await supabase
      .from("participants")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (participant) {
      const { data: memberships } = await supabase
        .from("pod_memberships")
        .select("pod_id, pods!inner(cycle_id)")
        .eq("participant_id", participant.id)
        .eq("pods.cycle_id", cycleId)
        .is("inactive_at", null);

      myPodIds = (memberships || []).map((m) => m.pod_id);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <p className="lbl">
          {cycle.name}
        </p>
        <h1 className="t-h1 mt-1 text-ink">
          {single ? "Choose your pod" : "Choose your pods"}
        </h1>
        <p className="mt-2 text-sm text-meta">
          {isLateJoin
            ? "The cycle is underway — you can still join a pod and jump in."
            : single
              ? "Join the pod working on the problem that interests you most."
              : `Join up to ${podLimit} pods to explore problems that interest you.`}
        </p>
      </div>

      {isOpen ? (
        <>
          <PodRegistration
            cycleId={cycleId}
            initialMyPodIds={myPodIds}
            podLimit={podLimit}
          />
          <div className="mt-8">
            <Link
              href="/dashboard"
              className="btn btn-teal group gap-2"
            >
              Continue to Dashboard
              <ArrowRight
                className="h-4 w-4 transition-transform duration-150 ease-spring group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </div>
        </>
      ) : (
        <div className="rounded-card border border-ink/10 bg-white p-6 shadow-card">
          <p className="text-charcoal">
            Pod registration is not currently open.
          </p>
          {config?.pod_registration_open &&
            now < (parseWindow(config.pod_registration_open) as Date) && (
              <p className="mt-2 text-sm text-meta tabular-nums">
                Opens {fmtLabDateTime(config.pod_registration_open)}
              </p>
            )}
          <div className="mt-4">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-teal-deep transition-colors duration-150 hover:text-teal"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
