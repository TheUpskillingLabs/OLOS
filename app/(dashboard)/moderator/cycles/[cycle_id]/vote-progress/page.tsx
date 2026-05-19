import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { resolveUserRoles, isAdmin, isModerator } from "@/lib/auth/roles";

type Proposal = {
  id: number;
  name: string | null;
  summary: string | null;
};

type PodWithVotes = {
  pod_id: number;
  pod_name: string;
  proposals: (Proposal & { total_votes: number })[];
  ballot_count: number;
};

// W2-001 moderator dashboard: per-proposal vote progress during the voting
// window. Intentionally aggregate-only — no per-voter attribution. Ballot
// count is surfaced so moderators can gauge participation without seeing who
// voted for whom.
export default async function ModeratorVoteProgressPage({
  params,
}: {
  params: Promise<{ cycle_id: string }>;
}) {
  const { cycle_id } = await params;
  const cycleId = parseInt(cycle_id, 10);
  if (Number.isNaN(cycleId)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const serviceClient = createServiceClient();
  const userRoles = await resolveUserRoles(serviceClient, user.id);

  if (!isAdmin(userRoles) && !isModerator(userRoles)) {
    redirect("/cycles");
  }

  const { data: cycle } = await serviceClient
    .from("cycles")
    .select("id, name")
    .eq("id", cycleId)
    .single();

  if (!cycle) notFound();

  const { data: config } = await serviceClient
    .from("cycle_config")
    .select("solution_voting_open, solution_voting_close")
    .eq("cycle_id", cycleId)
    .single();

  const now = new Date();
  const openAt = config?.solution_voting_open ? new Date(config.solution_voting_open) : null;
  const closeAt = config?.solution_voting_close ? new Date(config.solution_voting_close) : null;
  const isOpen = openAt !== null && closeAt !== null && now >= openAt && now <= closeAt;

  // Scope: admins see every pod; moderators see only their assigned pods.
  let pods: { id: number; name: string | null }[] = [];
  if (isAdmin(userRoles)) {
    const { data } = await serviceClient
      .from("pods")
      .select("id, name")
      .eq("cycle_id", cycleId)
      .order("created_at");
    pods = data ?? [];
  } else {
    const scopedIds = userRoles.moderatorPodIds;
    if (scopedIds.length === 0) {
      pods = [];
    } else {
      const { data } = await serviceClient
        .from("pods")
        .select("id, name")
        .eq("cycle_id", cycleId)
        .in("id", scopedIds)
        .order("created_at");
      pods = data ?? [];
    }
  }

  const podData: PodWithVotes[] = [];
  for (const pod of pods) {
    const [{ data: proposals }, { data: votes }] = await Promise.all([
      serviceClient
        .from("solution_proposals")
        .select("id, name, summary")
        .eq("pod_id", pod.id)
        .order("created_at"),
      serviceClient
        .from("project_votes")
        .select("solution_proposal_id, vote_count, voter_id")
        .eq("pod_id", pod.id),
    ]);

    const tallyMap: Record<number, number> = {};
    const voterSet = new Set<number>();
    for (const v of votes ?? []) {
      tallyMap[v.solution_proposal_id] =
        (tallyMap[v.solution_proposal_id] || 0) + v.vote_count;
      voterSet.add(v.voter_id);
    }

    const withTallies = (proposals ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      summary: p.summary,
      total_votes: tallyMap[p.id] || 0,
    }));
    withTallies.sort((a, b) => b.total_votes - a.total_votes);

    podData.push({
      pod_id: pod.id,
      pod_name: pod.name ?? `Pod ${pod.id}`,
      proposals: withTallies,
      ballot_count: voterSet.size,
    });
  }

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/moderator"
          className="inline-flex items-center gap-1.5 text-sm text-cloud/60 transition-colors duration-150 hover:text-aqua focus-visible:outline-none focus-visible:text-aqua"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Moderator
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
          Vote progress
        </h1>
        <p className="mt-1 text-sm text-cloud/80">
          {cycle.name} — per-project vote tallies. Aggregate only; individual
          ballots are not shown.
        </p>
        {openAt && closeAt && (
          <p
            className={`mt-2 text-xs tabular-nums ${
              isOpen ? "text-aqua" : "text-cloud/60"
            }`}
          >
            {isOpen
              ? `Voting closes ${closeAt.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}`
              : now < openAt
                ? `Voting opens ${openAt.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}`
                : "Voting has closed."}
          </p>
        )}
      </div>

      {podData.length === 0 ? (
        <div className="rounded-md border border-whisper bg-white/[0.02] p-6 text-center">
          <p className="text-cloud/80">
            No pods to display for this cycle.
            {!isAdmin(userRoles) && " You are not assigned to any pods here."}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {podData.map((pod) => {
            const maxVotes = pod.proposals.reduce(
              (m, p) => Math.max(m, p.total_votes),
              0
            );
            return (
              <section key={pod.pod_id}>
                <header className="mb-3 flex items-baseline justify-between gap-3">
                  <h2 className="text-lg font-semibold tracking-tight text-white">
                    {pod.pod_name}
                  </h2>
                  <p className="text-xs text-cloud/60 tabular-nums">
                    {pod.ballot_count} ballot
                    {pod.ballot_count === 1 ? "" : "s"} submitted
                  </p>
                </header>

                {pod.proposals.length === 0 ? (
                  <p className="rounded-md border border-dashed border-whisper bg-white/[0.01] p-6 text-center text-sm text-cloud/60">
                    No projects submitted in this pod.
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-md border border-whisper">
                    <table className="w-full text-sm">
                      <thead className="bg-white/[0.04]">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-cloud/60">
                            Project
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-cloud/60">
                            Summary
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-cloud/60">
                            Votes
                          </th>
                          <th className="w-32 px-4 py-3" aria-hidden />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-whisper">
                        {pod.proposals.map((p) => {
                          const widthPct =
                            maxVotes > 0 ? (p.total_votes / maxVotes) * 100 : 0;
                          return (
                            <tr
                              key={p.id}
                              className="transition-colors duration-150 hover:bg-white/[0.02]"
                            >
                              <td className="px-4 py-3 font-medium text-white">
                                {p.name || "Untitled"}
                              </td>
                              <td className="max-w-md truncate px-4 py-3 text-cloud/70">
                                {p.summary || ""}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold tabular-nums text-aqua">
                                {p.total_votes}
                              </td>
                              <td className="w-32 px-4 py-3">
                                <div
                                  className="h-2 overflow-hidden rounded-full bg-white/[0.05]"
                                  aria-hidden
                                >
                                  <div
                                    className="h-full bg-teal/60 transition-all duration-300"
                                    style={{ width: `${widthPct}%` }}
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
