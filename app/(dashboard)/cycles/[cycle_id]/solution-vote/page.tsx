import Link from "next/link";
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
    .select("solution_voting_open, solution_voting_close, project_submitter_votes")
    .eq("cycle_id", cycleId)
    .single();

  const now = new Date();
  const isOpen =
    config?.solution_voting_open &&
    config?.solution_voting_close &&
    now >= new Date(config.solution_voting_open) &&
    now <= new Date(config.solution_voting_close);

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
    <div>
      <div className="mb-8">
        <Link
          href={`/cycles/${cycle.id}`}
          className="text-sm text-cloud/60 hover:text-aqua"
        >
          &larr; {cycle.name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-white">
          Vote on Solutions
        </h1>
        <p className="mt-1 text-sm text-cloud/50">
          Allocate your votes to the solutions you want your pod to build.
        </p>
      </div>

      {!isOpen ? (
        <div className="rounded-md border border-whisper bg-white/[0.02] p-6 text-center">
          <p className="text-cloud/60">
            Solution voting is not currently open.
          </p>
          {config?.solution_voting_open &&
            now < new Date(config.solution_voting_open) && (
              <p className="mt-2 text-sm text-cloud/40">
                Opens{" "}
                {new Date(config.solution_voting_open).toLocaleDateString(
                  "en-US",
                  { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
                )}
              </p>
            )}
        </div>
      ) : myPods.length === 0 ? (
        <div className="rounded-md border border-whisper bg-white/[0.02] p-6 text-center">
          <p className="text-cloud/60">
            You are not a member of any pods in this cycle.
          </p>
          <Link
            href={`/cycles/${cycle.id}`}
            className="mt-2 inline-block text-sm text-aqua hover:underline"
          >
            View cycle &rarr;
          </Link>
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
