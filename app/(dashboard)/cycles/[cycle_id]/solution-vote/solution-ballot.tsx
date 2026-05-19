"use client";

import { useState, useEffect } from "react";

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
  const [allocations, setAllocations] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [alreadyVoted, setAlreadyVoted] = useState(false);

  useEffect(() => {
    if (!selectedPodId) return;
    setLoading(true);
    setAllocations({});
    setError("");
    setSubmitted(false);
    setAlreadyVoted(false);

    (async () => {
      try {
        const [proposalsRes, votesRes] = await Promise.all([
          fetch(`/api/pods/${selectedPodId}/solution-proposals`),
          fetch(`/api/pods/${selectedPodId}/project-votes`),
        ]);
        const proposalData = await proposalsRes.json();
        const voteData = await votesRes.json();

        if (Array.isArray(proposalData)) setProposals(proposalData);

        // If the GET returns the per-voter breakdown for admins, we don't use
        // it here — blind voting hides tallies regardless. But we DO need to
        // know whether the current user has already submitted a ballot in
        // this pod. The cleanest signal is to POST and let the server return
        // 409 — but that's a destructive probe. Instead, we look at the
        // tallies: if there are any votes at all and the budget is zero we
        // could be done, but that's noisy. Defer the "already voted" check
        // to submit time and surface the 409 cleanly.
        if (voteData && Array.isArray(voteData.tallies)) {
          // Intentional no-op: we don't surface tallies during voting.
        }
      } catch {
        setError("Failed to load proposals.");
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedPodId]);

  function bump(proposalId: number, delta: number) {
    setAllocations((prev) => {
      const next = { ...prev, [proposalId]: Math.max(0, (prev[proposalId] || 0) + delta) };
      return next;
    });
  }

  const totalAllocated = Object.values(allocations).reduce((s, n) => s + n, 0);
  const remaining = voteBudget - totalAllocated;
  const ready = remaining === 0 && totalAllocated > 0;

  async function submitBallot() {
    if (!ready) return;
    setError("");
    setSubmitting(true);

    const ballot = proposals.map((p) => ({
      solution_proposal_id: p.id,
      vote_count: allocations[p.id] || 0,
    }));

    try {
      const res = await fetch(`/api/pods/${selectedPodId}/project-votes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votes: ballot }),
      });

      if (res.status === 409) {
        const body = await res.json().catch(() => ({}));
        setAlreadyVoted(true);
        setError(body.error || "You have already voted.");
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Failed to submit ballot.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted || alreadyVoted) {
    return (
      <div className="rounded-md border border-aqua/30 bg-aqua/[0.06] p-5">
        <p className="font-semibold tracking-tight text-white">
          {alreadyVoted ? "Ballot already submitted" : "Ballot submitted ✓"}
        </p>
        <p className="mt-1 text-sm text-cloud/70">
          {alreadyVoted
            ? "Your ballot is on file. Votes are final once cast."
            : "Your votes are recorded. Results will be visible after voting closes."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pods.length > 1 && (
        <div className="space-y-1.5">
          <label
            htmlFor="select-pod"
            className="block text-sm font-medium text-cloud"
          >
            Pod
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

      <div className="rounded-md border border-teal/20 bg-teal/[0.04] p-4">
        <div className="flex items-baseline gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-cloud/60">
              Votes remaining
            </p>
            <p
              className={`mt-1 text-3xl font-bold tabular-nums tracking-tight ${
                ready ? "text-aqua" : "text-white"
              }`}
            >
              {remaining}
            </p>
          </div>
          <p className="text-xs text-cloud/60 tabular-nums">
            of {voteBudget} total
          </p>
        </div>
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
          Loading projects...
        </div>
      ) : proposals.length === 0 ? (
        <div className="rounded-md border border-dashed border-whisper bg-white/[0.01] p-12 text-center">
          <p className="text-sm text-cloud/60">
            No projects have been submitted in this pod.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {proposals.map((p) => {
            const count = allocations[p.id] || 0;
            const description =
              p.proposal_data?.description ?? p.proposal_text ?? "";
            return (
              <div
                key={p.id}
                className="rounded-md border border-whisper bg-white/[0.02] p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold tracking-tight text-white">
                      {p.name || "Untitled project"}
                    </h3>
                    {p.summary && (
                      <p className="mt-1 text-sm text-cloud/80">{p.summary}</p>
                    )}
                    {description && (
                      <p className="mt-2 whitespace-pre-line text-sm text-cloud/60">
                        {description}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => bump(p.id, -1)}
                      disabled={count === 0}
                      aria-label={`Decrease votes for ${p.name || `proposal ${p.id}`}`}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.10] bg-white/[0.04] text-cloud transition-all duration-150 hover:bg-white/[0.08] active:scale-[0.94] disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
                    >
                      −
                    </button>
                    <span
                      className="w-6 text-center font-semibold tabular-nums text-white"
                      aria-live="polite"
                    >
                      {count}
                    </span>
                    <button
                      type="button"
                      onClick={() => bump(p.id, 1)}
                      disabled={remaining === 0}
                      aria-label={`Increase votes for ${p.name || `proposal ${p.id}`}`}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-teal/30 bg-teal/[0.10] text-aqua transition-all duration-150 hover:bg-teal/[0.20] active:scale-[0.94] disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-3 border-t border-whisper pt-4">
        <button
          type="button"
          onClick={submitBallot}
          disabled={!ready || submitting || proposals.length === 0}
          className="rounded-md bg-teal px-4 py-2 text-sm font-semibold tracking-tight text-white shadow-[0_1px_4px_rgba(0,148,160,0.2)] transition-all duration-150 ease-spring hover:bg-teal/80 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
        >
          {submitting ? "Submitting..." : "Submit votes"}
        </button>
        <p className="text-xs text-cloud/60">
          {ready
            ? "Ready to submit. Votes are final."
            : `Allocate all ${voteBudget} vote${voteBudget === 1 ? "" : "s"} to submit.`}
        </p>
      </div>
    </div>
  );
}
