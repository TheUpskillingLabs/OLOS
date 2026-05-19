import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import SolutionBallot from "./solution-ballot";

export default async function SolutionVotePage({
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
    .select(
      "solution_voting_open, solution_voting_close, project_submitter_votes"
    )
    .eq("cycle_id", cycleId)
    .single();

  const now = new Date();
  const openAt = config?.solution_voting_open ? new Date(config.solution_voting_open) : null;
  const closeAt = config?.solution_voting_close ? new Date(config.solution_voting_close) : null;
  const isOpen = openAt !== null && closeAt !== null && now >= openAt && now <= closeAt;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let myPods: { id: number; name: string | null }[] = [];
  let hasSubmitted = false;

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

      // W2-001: only submitters can vote. Check across all pods this cycle —
      // the (cycle_id, participant_id) unique constraint added in 00016
      // guarantees at most one row.
      const { data: ownProposal } = await supabase
        .from("solution_proposals")
        .select("id")
        .eq("cycle_id", cycleId)
        .eq("participant_id", participant.id)
        .maybeSingle();
      hasSubmitted = !!ownProposal;
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <Link
          href={`/cycles/${cycle.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-cloud/60 transition-colors duration-150 hover:text-aqua focus-visible:outline-none focus-visible:text-aqua"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {cycle.name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
          Vote on projects
        </h1>
        <p className="mt-1 text-sm text-cloud/80">
          Allocate your votes to the projects you want your pod to build. Submit
          your full ballot at once.
        </p>
      </div>

      {!isOpen ? (
        <div className="rounded-md border border-whisper bg-white/[0.02] p-6 text-center">
          <p className="text-cloud/80">Project voting is not currently open.</p>
          {openAt && now < openAt && (
            <p className="mt-2 text-sm text-cloud/60 tabular-nums">
              Opens{" "}
              {openAt.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
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
      ) : !hasSubmitted ? (
        <div className="rounded-md border border-whisper bg-white/[0.03] p-6">
          <p className="font-semibold tracking-tight text-cloud/80">
            Voting is underway.
          </p>
          <p className="mt-2 text-sm text-cloud/60">
            You didn&apos;t submit a project, so you&apos;re not eligible to
            vote in this phase. You can still register for one of the
            shortlisted projects when registration opens.
          </p>
        </div>
      ) : (
        <SolutionBallot
          pods={myPods}
          voteBudget={config?.project_submitter_votes ?? 0}
        />
      )}
    </div>
  );
}
