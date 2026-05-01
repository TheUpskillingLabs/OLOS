import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ProposalForm from "./proposal-form";

export default async function SolutionsPage({
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
    .select("solution_proposal_open, solution_proposal_close")
    .eq("cycle_id", cycleId)
    .single();

  const now = new Date();
  const isOpen =
    config?.solution_proposal_open &&
    config?.solution_proposal_close &&
    now >= new Date(config.solution_proposal_open) &&
    now <= new Date(config.solution_proposal_close);

  // Get user's pods for this cycle
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let myPods: { id: number; name: string | null }[] = [];
  if (user) {
    const { data: participant } = await supabase
      .from("participants")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (participant) {
      const { data: memberships } = await supabase
        .from("pod_memberships")
        .select("pod_id, pods!inner(id, name, cycle_id)")
        .eq("participant_id", participant.id)
        .eq("pods.cycle_id", cycleId)
        .is("inactive_at", null);

      myPods = (memberships || []).map((m) => {
        const pod = m.pods as unknown as { id: number; name: string | null };
        return { id: pod.id, name: pod.name };
      });
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <Link
          href={`/cycles/${cycle.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-cloud/60 transition-colors duration-150 hover:text-aqua focus-visible:outline-none focus-visible:text-aqua"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {cycle.name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
          Solution proposals
        </h1>
        <p className="mt-1 text-sm text-cloud/80">
          Propose solutions for your pod to explore.
        </p>
      </div>

      {!isOpen ? (
        <div className="rounded-md border border-whisper bg-white/[0.02] p-6 text-center">
          <p className="text-cloud/80">
            Solution proposal submission is not currently open.
          </p>
          {config?.solution_proposal_open &&
            now < new Date(config.solution_proposal_open) && (
              <p className="mt-2 text-sm text-cloud/60 tabular-nums">
                Opens{" "}
                {new Date(config.solution_proposal_open).toLocaleDateString(
                  "en-US",
                  { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
                )}
              </p>
            )}
        </div>
      ) : myPods.length === 0 ? (
        <div className="rounded-md border border-whisper bg-white/[0.02] p-6 text-center">
          <p className="text-cloud/80">
            You are not a member of any pods in this cycle.
          </p>
          <Link
            href={`/cycles/${cycle.id}`}
            className="mt-2 inline-block text-sm font-semibold tracking-tight text-aqua transition-colors duration-150 hover:underline focus-visible:outline-none focus-visible:text-white"
          >
            View cycle &rarr;
          </Link>
        </div>
      ) : (
        <ProposalForm pods={myPods} />
      )}
    </div>
  );
}
