import Link from "next/link";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import PodRegistration from "./pod-registration";
import NextStepFooter from "@/app/components/flow/next-step-footer";

export default async function RegisterPodsPage({
  params,
}: {
  params: Promise<{ cycle_id: string }>;
}) {
  const { cycle_id } = await params;
  const cycleId = parseInt(cycle_id, 10);
  const supabase = await createClient();

  const [{ data: cycle }, { data: config }, { data: { user } }] = await Promise.all([
    supabase.from("cycles").select("id, name, status").eq("id", cycleId).single(),
    createServiceClient().from("cycle_config").select("pod_registration_open, pod_registration_close, pod_limit, pod_min").eq("cycle_id", cycleId).single(),
    supabase.auth.getUser(),
  ]);

  if (!cycle) notFound();

  const podLimit = config?.pod_limit ?? 2;
  const podMin = config?.pod_min ?? 2;

  const now = new Date();
  const isOpen =
    config?.pod_registration_open &&
    config?.pod_registration_close &&
    now >= new Date(config.pod_registration_open) &&
    now <= new Date(config.pod_registration_close);

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
        <Link
          href={`/cycles/${cycle.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-meta transition-colors duration-150 hover:text-teal-deep focus-visible:outline-none focus-visible:text-teal-deep"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {cycle.name}
        </Link>
        <h1 className="t-h1 mt-2 text-ink">
          Choose your pods
        </h1>
        <p className="mt-2 text-sm text-meta">
          Join up to {podLimit} {podLimit === 1 ? "pod" : "pods"} to explore
          problems that interest you.
        </p>
      </div>

      {isOpen ? (
        <>
          <PodRegistration cycleId={cycleId} initialMyPodIds={myPodIds} podLimit={podLimit} podMin={podMin} />
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
        <div className="rounded-card border border-ink/10 bg-white p-6 text-center shadow-card">
          <p className="text-charcoal">
            Pod registration is not currently open.
          </p>
          {config?.pod_registration_open &&
            now < new Date(config.pod_registration_open) && (
              <p className="mt-2 text-sm text-meta tabular-nums">
                Opens{" "}
                {new Date(config.pod_registration_open).toLocaleDateString(
                  "en-US",
                  { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
                )}
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

      <NextStepFooter cycleId={cycleId} currentStage="pod_registration" />
    </div>
  );
}
