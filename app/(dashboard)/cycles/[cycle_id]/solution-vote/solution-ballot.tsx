"use client";

import { useState, useEffect } from "react";

interface Proposal {
  id: number;
  participant_id: number;
  proposal_text: string;
  created_at: string;
}

interface Tally {
  solution_proposal_id: number;
  total_votes: number;
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
  const [tallies, setTallies] = useState<Tally[]>([]);
  const [pendingVotes, setPendingVotes] = useState<Record<number, number>>({});
  const [totalUsed, setTotalUsed] = useState(0);
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [successId, setSuccessId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedPodId) return;
    setLoading(true);
    setTotalUsed(0);
    setPendingVotes({});

    Promise.all([
      fetch(`/api/pods/${selectedPodId}/solution-proposals`).then((r) =>
        r.json()
      ),
      fetch(`/api/pods/${selectedPodId}/project-votes`).then((r) => r.json()),
    ]).then(([proposalData, voteData]) => {
      if (Array.isArray(proposalData)) setProposals(proposalData);
      if (voteData?.tallies) setTallies(voteData.tallies);
      setLoading(false);
    });
  }, [selectedPodId]);

  function getTallyFor(proposalId: number): number {
    return (
      tallies.find((t) => t.solution_proposal_id === proposalId)
        ?.total_votes ?? 0
    );
  }

  async function castVote(proposalId: number) {
    const voteCount = pendingVotes[proposalId];
    if (!voteCount || voteCount < 1) return;

    setError("");
    setSuccessId(null);
    setSubmitting(proposalId);

    try {
      const res = await fetch(`/api/pods/${selectedPodId}/project-votes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solution_proposal_id: proposalId,
          vote_count: voteCount,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Failed to cast vote");
        return;
      }

      setSuccessId(proposalId);
      setTotalUsed((prev) => prev + voteCount);
      setTallies((prev) => {
        const existing = prev.find(
          (t) => t.solution_proposal_id === proposalId
        );
        if (existing) {
          return prev.map((t) =>
            t.solution_proposal_id === proposalId
              ? { ...t, total_votes: t.total_votes + voteCount }
              : t
          );
        }
        return [
          ...prev,
          { solution_proposal_id: proposalId, total_votes: voteCount },
        ];
      });
      setPendingVotes((prev) => ({ ...prev, [proposalId]: 0 }));
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(null);
    }
  }

  const remaining = voteBudget - totalUsed;

  return (
    <div className="space-y-6">
      {pods.length > 1 && (
        <div className="space-y-1.5">
          <label
            htmlFor="select-pod"
            className="block text-sm font-medium text-cloud"
          >
            Select pod
          </label>
          <div className="relative">
            <select
              id="select-pod"
              value={selectedPodId}
              onChange={(e) => setSelectedPodId(parseInt(e.target.value, 10))}
              className="block w-full appearance-none rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-2 pr-9 text-sm text-white transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
            >
              {pods.map((pod) => (
                <option key={pod.id} value={pod.id}>
                  {pod.name || `Pod ${pod.id}`}
                </option>
              ))}
            </select>
            <svg
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cloud/60"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden
            >
              <path
                d="M6 8l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      )}

      {pods.length === 1 && (
        <p className="text-sm text-cloud/80">
          Voting in{" "}
          <span className="font-semibold text-white">
            {pods[0].name || `Pod ${pods[0].id}`}
          </span>
        </p>
      )}

      {/* Budget indicator */}
      <div className="rounded-md border border-teal/20 bg-teal/[0.04] p-4">
        <p className="text-xs font-medium uppercase tracking-widest text-cloud/60">
          Vote budget
        </p>
        <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-aqua">
          {remaining}
        </p>
        <p className="text-xs text-cloud/60 tabular-nums">votes remaining</p>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-red/20 bg-red/10 px-3 py-2 text-sm text-red-300"
        >
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-3 text-cloud/60" aria-busy="true">
          <span
            role="status"
            aria-label="Loading"
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/10 border-t-teal"
          />
          Loading proposals...
        </div>
      ) : proposals.length === 0 ? (
        <div className="rounded-md border border-dashed border-whisper bg-white/[0.01] p-12 text-center">
          <p className="text-sm text-cloud/60">
            No solution proposals have been submitted yet.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {proposals.map((proposal) => (
            <div
              key={proposal.id}
              className="rounded-md border border-whisper bg-white/[0.02] p-4 transition-colors duration-150 hover:border-white/[0.12]"
            >
              <p className="text-sm text-cloud/80">{proposal.proposal_text}</p>
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-whisper pt-3">
                <span className="text-xs font-medium text-cloud/60 tabular-nums">
                  {getTallyFor(proposal.id)} vote
                  {getTallyFor(proposal.id) !== 1 ? "s" : ""}
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={remaining}
                    value={pendingVotes[proposal.id] || ""}
                    onChange={(e) =>
                      setPendingVotes((prev) => ({
                        ...prev,
                        [proposal.id]: parseInt(e.target.value, 10) || 0,
                      }))
                    }
                    placeholder="0"
                    aria-label="Vote count"
                    className="w-16 rounded-md border border-white/[0.10] bg-white/[0.04] px-2 py-1 text-center text-sm tabular-nums text-white placeholder:text-cloud/40 transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
                  />
                  <button
                    onClick={() => castVote(proposal.id)}
                    disabled={
                      submitting !== null ||
                      !pendingVotes[proposal.id] ||
                      pendingVotes[proposal.id] < 1
                    }
                    className="rounded bg-teal/20 px-3 py-1 text-xs font-semibold tracking-tight text-aqua transition-all duration-150 hover:bg-teal/30 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
                  >
                    {submitting === proposal.id ? "..." : "Vote"}
                  </button>
                  {successId === proposal.id && (
                    <span className="text-xs font-medium text-aqua">
                      Voted
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
