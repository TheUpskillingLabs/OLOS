import Link from "next/link";
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
        <Link
          href={`/cycles/${cycle.id}`}
          className="text-sm text-cloud/60 hover:text-aqua"
        >
          &larr; {cycle.name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-white">
          Register for Pods
        </h1>
        <p className="mt-1 text-sm text-cloud/50">
          Join up to 2 pods to explore problems that interest you.
        </p>
      </div>

      {isOpen ? (
        <PodRegistration cycleId={cycleId} initialMyPodIds={myPodIds} />
      ) : (
        <div className="rounded-md border border-whisper bg-white/[0.02] p-6 text-center">
          <p className="text-cloud/60">
            Pod registration is not currently open.
          </p>
          {config?.pod_registration_open &&
            now < new Date(config.pod_registration_open) && (
              <p className="mt-2 text-sm text-cloud/40">
                Opens{" "}
                {new Date(config.pod_registration_open).toLocaleDateString(
                  "en-US",
                  { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
                )}
              </p>
            )}
        </div>
      )}
    </div>
  );
}
