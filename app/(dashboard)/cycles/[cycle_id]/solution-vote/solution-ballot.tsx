"use client";

import { useState, useEffect } from "react";
import Ballot, { type BallotItem } from "@/app/components/flow/ballot";
import { EmptyState } from "@/app/components/ui";

interface Proposal {
  id: number;
  participant_id: number;
  name: string | null;
  summary: string | null;
  proposal_data: Record<string, string> | null;
  proposal_text: string | null;
}

export default function SolutionBallot({
  pods,
  voteBudget,
}: {
  pods: { id: number; name: string | null }[];
  voteBudget: number;
}) {
  const [selectedPodId, setSelectedPodId] = useState(pods[0]?.id ?? 0);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [tallies, setTallies] = useState<Record<number, number>>({});
  const [myVotes, setMyVotes] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Re-key the Ballot per pod so its internal allocation state resets on switch.
  const [ballotKey, setBallotKey] = useState(0);

  useEffect(() => {
    if (!selectedPodId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const [proposalsRes, votesRes] = await Promise.all([
          fetch(`/api/pods/${selectedPodId}/solution-proposals`),
          fetch(`/api/pods/${selectedPodId}/project-votes`),
        ]);
        const proposalData = await proposalsRes.json();
        const voteData = await votesRes.json();
        if (cancelled) return;

        if (Array.isArray(proposalData)) setProposals(proposalData);

        const t: Record<number, number> = {};
        for (const row of voteData?.tallies ?? []) t[row.solution_proposal_id] = row.total_votes;
        setTallies(t);

        const mine: Record<number, number> = {};
        for (const row of voteData?.my_votes ?? []) mine[row.solution_proposal_id] = row.vote_count;
        setMyVotes(mine);

        setBallotKey((k) => k + 1);
      } catch {
        if (!cancelled) setError("Failed to load solutions.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedPodId]);

  const items: BallotItem[] = proposals.map((p) => {
    const description = p.proposal_data?.description ?? p.proposal_text ?? "";
    return {
      id: p.id,
      content: (
        <div>
          <h3 className="font-semibold tracking-tight text-ink">
            {p.name || "Untitled solution"}
          </h3>
          {p.summary && <p className="mt-1 text-sm text-charcoal">{p.summary}</p>}
          {description && (
            <p className="mt-2 whitespace-pre-line text-sm text-meta">{description}</p>
          )}
        </div>
      ),
    };
  });

  return (
    <div className="space-y-6">
      {pods.length > 1 && (
        <div className="space-y-1.5">
          <label htmlFor="select-pod" className="block text-sm font-medium text-charcoal">
            Pod
          </label>
          <div className="relative">
            <select
              id="select-pod"
              value={selectedPodId}
              onChange={(e) => setSelectedPodId(parseInt(e.target.value, 10))}
              className="block w-full appearance-none rounded-card border border-ink/10 bg-white px-3 py-2 pr-9 text-base text-ink transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
            >
              {pods.map((pod) => (
                <option key={pod.id} value={pod.id}>
                  {pod.name || `Pod ${pod.id}`}
                </option>
              ))}
            </select>
            <svg
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-meta"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden
            >
              <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      )}

      {pods.length === 1 && (
        <p className="text-sm text-charcoal">
          Voting in{" "}
          <span className="font-semibold text-ink">
            {pods[0].name || `Pod ${pods[0].id}`}
          </span>
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-card border border-red/20 bg-red/10 px-3 py-2 text-sm text-red">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-3 text-meta" aria-busy="true">
          <span
            role="status"
            aria-label="Loading"
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink/10 border-t-teal"
          />
          Loading solutions…
        </div>
      ) : proposals.length === 0 ? (
        <EmptyState
          title="No solutions here yet"
          description="No one has submitted a solution in this pod yet. Check back once the solution-proposal window has run."
        />
      ) : (
        <Ballot
          key={ballotKey}
          items={items}
          budget={voteBudget}
          idField="solution_proposal_id"
          castUrl={`/api/pods/${selectedPodId}/project-votes`}
          deleteUrl={`/api/pods/${selectedPodId}/project-votes`}
          initialMyVotes={myVotes}
          initialTallies={tallies}
          budgetNote={<p>{voteBudget} votes total</p>}
        />
      )}
    </div>
  );
}
