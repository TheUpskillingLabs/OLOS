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
        <div>
          <label className="mb-1.5 block text-sm font-medium text-cloud/70">
            Select Pod
          </label>
          <select
            value={selectedPodId}
            onChange={(e) => setSelectedPodId(parseInt(e.target.value, 10))}
            className="rounded-md border border-whisper bg-white/[0.04] px-3 py-2 text-white focus:border-teal focus:outline-none"
          >
            {pods.map((pod) => (
              <option key={pod.id} value={pod.id}>
                {pod.name || `Pod ${pod.id}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {pods.length === 1 && (
        <p className="text-sm text-cloud/50">
          Voting in{" "}
          <span className="font-medium text-white">
            {pods[0].name || `Pod ${pods[0].id}`}
          </span>
        </p>
      )}

      {/* Budget indicator */}
      <div className="flex items-center gap-4 rounded-md border border-teal/20 bg-teal/[0.04] p-4">
        <div>
          <p className="text-sm text-cloud/60">Vote Budget</p>
          <p className="text-2xl font-bold text-aqua">{remaining}</p>
          <p className="text-xs text-cloud/40">votes remaining</p>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-cloud/50">Loading proposals...</p>
      ) : proposals.length === 0 ? (
        <div className="rounded-md border border-whisper bg-white/[0.02] p-6 text-center">
          <p className="text-cloud/60">
            No solution proposals have been submitted yet.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {proposals.map((proposal) => (
            <div
              key={proposal.id}
              className="rounded-md border border-whisper bg-white/[0.02] p-4"
            >
              <p className="text-sm text-cloud/80">{proposal.proposal_text}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-cloud/40">
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
                    className="w-16 rounded border border-whisper bg-white/[0.04] px-2 py-1 text-center text-sm text-white placeholder:text-cloud/30 focus:border-teal focus:outline-none"
                  />
                  <button
                    onClick={() => castVote(proposal.id)}
                    disabled={
                      submitting !== null ||
                      !pendingVotes[proposal.id] ||
                      pendingVotes[proposal.id] < 1
                    }
                    className="rounded bg-teal/20 px-3 py-1 text-xs font-medium text-aqua transition-colors hover:bg-teal/30 disabled:opacity-40"
                  >
                    {submitting === proposal.id ? "..." : "Vote"}
                  </button>
                  {successId === proposal.id && (
                    <span className="text-xs text-aqua">Voted!</span>
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
