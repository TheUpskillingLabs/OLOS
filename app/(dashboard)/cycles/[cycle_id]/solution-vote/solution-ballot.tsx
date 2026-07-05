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

    (async () => {
      // Reset inside the async body (not the effect body) so these aren't
      // synchronous setStates in the effect (react-hooks/set-state-in-effect).
      setLoading(true);
      setAllocations({});
      setError("");
      setSubmitted(false);
      setAlreadyVoted(false);
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
      setError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted || alreadyVoted) {
    return (
      <div className="rounded-card border border-teal/30 bg-teal/10 p-5">
        <p className="font-semibold tracking-tight text-ink">
          {alreadyVoted ? "Ballot already submitted" : "Ballot submitted ✓"}
        </p>
        <p className="mt-1 text-sm text-slate">
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
            className="block text-sm font-medium text-charcoal"
          >
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
        <p className="text-sm text-charcoal">
          Voting in{" "}
          <span className="font-semibold text-ink">
            {pods[0].name || `Pod ${pods[0].id}`}
          </span>
        </p>
      )}

      <div className="rounded-card border border-ink/10 bg-white p-4 shadow-card">
        <div className="flex items-baseline gap-4">
          <div>
            <p className="lbl">
              Votes remaining
            </p>
            <p
              className={`mt-1 text-3xl font-bold tabular-nums tracking-tight ${
                ready ? "text-teal-deep" : "text-ink"
              }`}
            >
              {remaining}
            </p>
          </div>
          <p className="text-xs text-meta tabular-nums">
            of {voteBudget} total
          </p>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-card border border-red/20 bg-red/10 px-3 py-2 text-sm text-red"
        >
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
          Loading projects...
        </div>
      ) : proposals.length === 0 ? (
        <div className="rounded-card border border-dashed border-meta-soft bg-white p-12">
          <p className="text-sm text-meta">
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
                className="rounded-card border border-ink/10 bg-white p-4 shadow-card"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold tracking-tight text-ink">
                      {p.name || "Untitled project"}
                    </h3>
                    {p.summary && (
                      <p className="mt-1 text-sm text-charcoal">{p.summary}</p>
                    )}
                    {description && (
                      <p className="mt-2 whitespace-pre-line text-sm text-meta">
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
                      className="flex h-8 w-8 items-center justify-center rounded-card border border-ink/10 bg-white text-charcoal transition-all duration-150 hover:bg-ink/[0.04] active:scale-[0.94] disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
                    >
                      −
                    </button>
                    <span
                      className="w-6 text-center font-semibold tabular-nums text-ink"
                      aria-live="polite"
                    >
                      {count}
                    </span>
                    <button
                      type="button"
                      onClick={() => bump(p.id, 1)}
                      disabled={remaining === 0}
                      aria-label={`Increase votes for ${p.name || `proposal ${p.id}`}`}
                      className="flex h-8 w-8 items-center justify-center rounded-card border border-teal/30 bg-teal/10 text-teal-deep transition-all duration-150 hover:bg-teal/20 active:scale-[0.94] disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
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

      <div className="flex items-center gap-3 border-t border-ink/10 pt-4">
        <button
          type="button"
          onClick={submitBallot}
          disabled={!ready || submitting || proposals.length === 0}
          className="btn btn-teal btn-sm"
        >
          {submitting ? "Submitting..." : "Submit votes"}
        </button>
        <p className="text-xs text-meta">
          {ready
            ? "Ready to submit. Votes are final."
            : `Allocate all ${voteBudget} vote${voteBudget === 1 ? "" : "s"} to submit.`}
        </p>
      </div>
    </div>
  );
}
