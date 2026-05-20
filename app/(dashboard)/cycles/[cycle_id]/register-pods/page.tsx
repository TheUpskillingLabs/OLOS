import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
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

  const { data: cycle } = await supabase
    .from("cycles")
    .select("id, name, status")
    .eq("id", cycleId)
    .single();

  if (!cycle) notFound();

  const serviceClient = createServiceClient();
  const { data: config } = await serviceClient
    .from("cycle_config")
    .select("pod_registration_open, pod_registration_close")
    .eq("cycle_id", cycleId)
    .single();

  const now = new Date();
  const isOpen =
    config?.pod_registration_open &&
    config?.pod_registration_close &&
    now >= new Date(config.pod_registration_open) &&
    now <= new Date(config.pod_registration_close);

  // Get current user's participant_id
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
        <p className="text-sm font-medium uppercase tracking-widest text-cloud/40">
          {cycle.name}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">
          Choose your pods
        </h1>
        <p className="mt-2 text-sm text-cloud/60">
          Join up to 2 pods to explore problems that interest you.
        </p>
      </div>

      {isOpen ? (
        <>
          <PodRegistration cycleId={cycleId} initialMyPodIds={myPodIds} />
          <div className="mt-8">
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-2 rounded-md bg-teal px-6 py-3 text-base font-semibold tracking-tight text-white shadow-[0_1px_4px_rgba(0,148,160,0.2)] transition-all duration-150 ease-spring hover:bg-teal/80 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
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
        <div className="rounded-md border border-whisper bg-white/[0.02] p-6 text-center">
          <p className="text-cloud/80">
            Pod registration is not currently open.
          </p>
          {config?.pod_registration_open &&
            now < new Date(config.pod_registration_open) && (
              <p className="mt-2 text-sm text-cloud/60 tabular-nums">
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
              className="text-sm font-medium text-aqua transition-colors duration-150 hover:text-teal"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
