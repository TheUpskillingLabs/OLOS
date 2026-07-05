"use client";

import { useState, useEffect } from "react";

interface ProposalData {
  about?: { background?: string; experience?: string };
  problem?: { who?: string; need?: string; barrier?: string; success?: string };
  statement?: { text?: string; question?: string };
  voter_context?: {
    tried?: string;
    scale?: string;
    pod_work?: string;
    skills_needed?: string;
  };
}

interface ProblemStatement {
  id: number;
  participant_id: number;
  statement_text: string;
  proposal_data: ProposalData | null;
  created_at: string;
}

interface Tally {
  problem_statement_id: number;
  total_votes: number;
}

export default function VoteBallot({
  cycleId,
  submitterBudget,
  nonSubmitterBudget,
}: {
  cycleId: number;
  submitterBudget: number;
  nonSubmitterBudget: number;
}) {
  const [statements, setStatements] = useState<ProblemStatement[]>([]);
  const [tallies, setTallies] = useState<Tally[]>([]);
  const [pendingVotes, setPendingVotes] = useState<Record<number, number>>({});
  const [totalUsed, setTotalUsed] = useState(0);
  const [budget, setBudget] = useState(nonSubmitterBudget);
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [successId, setSuccessId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/problem-statements/${cycleId}`).then((r) => r.json()),
      fetch(`/api/votes/${cycleId}`).then((r) => r.json()),
    ]).then(([stmts, voteData]) => {
      if (Array.isArray(stmts)) setStatements(stmts);
      if (voteData?.tallies) setTallies(voteData.tallies);
      setLoading(false);
    });
  }, [cycleId]);

  function getTallyFor(stmtId: number): number {
    return (
      tallies.find((t) => t.problem_statement_id === stmtId)?.total_votes ?? 0
    );
  }

  async function castVote(problemStatementId: number) {
    const voteCount = pendingVotes[problemStatementId];
    if (!voteCount || voteCount < 1) return;

    setError("");
    setSuccessId(null);
    setSubmitting(problemStatementId);

    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cycle_id: cycleId,
          problem_statement_id: problemStatementId,
          vote_count: voteCount,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Failed to cast vote");
        return;
      }

      const result = await res.json();
      setSuccessId(problemStatementId);
      setTotalUsed((prev) => prev + voteCount);
      if (result.votes_remaining !== undefined) {
        setBudget(result.votes_remaining + totalUsed + voteCount);
      }
      setTallies((prev) => {
        const existing = prev.find(
          (t) => t.problem_statement_id === problemStatementId
        );
        if (existing) {
          return prev.map((t) =>
            t.problem_statement_id === problemStatementId
              ? { ...t, total_votes: t.total_votes + voteCount }
              : t
          );
        }
        return [
          ...prev,
          { problem_statement_id: problemStatementId, total_votes: voteCount },
        ];
      });
      setPendingVotes((prev) => ({ ...prev, [problemStatementId]: 0 }));
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSubmitting(null);
    }
  }

  const remaining = budget - totalUsed;

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-meta" aria-busy="true">
        <span
          role="status"
          aria-label="Loading"
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink/10 border-t-teal"
        />
        Loading proposals...
      </div>
    );
  }

  if (statements.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-meta-soft bg-white p-12">
        <p className="text-sm text-meta">
          No problem statements have been submitted yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Budget indicator */}
      <div className="sticky top-[60px] z-30 flex items-center justify-between gap-4 rounded-card border border-ink/10 bg-white/95 p-4 shadow-card backdrop-blur-sm backdrop-saturate-150">
        <div>
          <p className="lbl">
            Vote budget
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-teal-deep">
            {remaining}
          </p>
          <p className="text-xs text-meta tabular-nums">votes remaining</p>
        </div>
        <div className="text-right text-xs text-meta tabular-nums">
          <p>Submitters get {submitterBudget} votes</p>
          <p>Non-submitters get {nonSubmitterBudget} votes</p>
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

      {/* Proposals list */}
      <div className="space-y-4">
        {statements.map((stmt) => {
          const pd = stmt.proposal_data;
          const isExpanded = expandedId === stmt.id;
          const hasDetails = pd?.problem || pd?.voter_context;

          return (
            <div
              key={stmt.id}
              className="rounded-card border border-ink/10 bg-white shadow-card transition-colors duration-150 hover:border-ink/20"
            >
              <div className="p-4">
                {/* Problem statement */}
                <p className="font-semibold tracking-tight text-ink">
                  {stmt.statement_text}
                </p>

                {/* HMW question */}
                {pd?.statement?.question && (
                  <p className="mt-2 text-sm italic text-slate">
                    {pd.statement.question}
                  </p>
                )}

                {/* Submitter background */}
                {pd?.about?.background && (
                  <p className="mt-2 text-xs text-meta">
                    Submitted by: {pd.about.background}
                  </p>
                )}

                {/* Expand toggle */}
                {hasDetails && (
                  <button
                    aria-expanded={isExpanded}
                    onClick={() =>
                      setExpandedId(isExpanded ? null : stmt.id)
                    }
                    className="mt-2 inline-flex items-center text-xs font-semibold tracking-tight text-teal-deep transition-colors duration-150 hover:underline focus-visible:outline-none focus-visible:underline"
                  >
                    {isExpanded ? "Show less" : "Read full proposal"}
                  </button>
                )}

                {/* Expanded details */}
                {isExpanded && pd && (
                  <div className="mt-4 space-y-3 border-t border-ink/10 pt-4">
                    {pd.problem?.who && (
                      <DetailBlock
                        label="Who is struggling"
                        text={pd.problem.who}
                      />
                    )}
                    {pd.problem?.need && (
                      <DetailBlock
                        label="What they need to do"
                        text={pd.problem.need}
                      />
                    )}
                    {pd.problem?.barrier && (
                      <DetailBlock
                        label="Why they can't do it now"
                        text={pd.problem.barrier}
                      />
                    )}
                    {pd.problem?.success && (
                      <DetailBlock
                        label="What success looks like"
                        text={pd.problem.success}
                      />
                    )}
                    {pd.voter_context?.tried && (
                      <DetailBlock
                        label="What has been tried"
                        text={pd.voter_context.tried}
                      />
                    )}
                    {pd.voter_context?.scale && (
                      <DetailBlock
                        label="Why it matters beyond the individual"
                        text={pd.voter_context.scale}
                      />
                    )}
                    {pd.voter_context?.pod_work && (
                      <DetailBlock
                        label="What the Research Pod would do"
                        text={pd.voter_context.pod_work}
                      />
                    )}
                    {pd.voter_context?.skills_needed && (
                      <DetailBlock
                        label="Skills & people needed"
                        text={pd.voter_context.skills_needed}
                      />
                    )}
                  </div>
                )}

                {/* Vote controls */}
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-ink/10 pt-3">
                  <span className="text-xs font-medium text-meta tabular-nums">
                    {getTallyFor(stmt.id)} vote
                    {getTallyFor(stmt.id) !== 1 ? "s" : ""}
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={remaining}
                      value={pendingVotes[stmt.id] || ""}
                      onChange={(e) =>
                        setPendingVotes((prev) => ({
                          ...prev,
                          [stmt.id]: parseInt(e.target.value, 10) || 0,
                        }))
                      }
                      placeholder="0"
                      aria-label="Vote count"
                      className="w-16 rounded-card border border-ink/10 bg-white px-2 py-1 text-center text-base tabular-nums text-ink placeholder:text-meta-soft transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
                    />
                    <button
                      onClick={() => castVote(stmt.id)}
                      disabled={
                        submitting !== null ||
                        !pendingVotes[stmt.id] ||
                        pendingVotes[stmt.id] < 1
                      }
                      className="rounded-card bg-teal/10 px-3 py-2 text-xs font-semibold tracking-tight text-teal-deep transition-all duration-150 hover:bg-teal/20 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
                    >
                      {submitting === stmt.id ? "..." : "Vote"}
                    </button>
                    {successId === stmt.id && (
                      <span className="text-xs font-medium text-teal-deep">
                        Voted
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DetailBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="lbl">
        {label}
      </p>
      <p className="mt-0.5 text-sm text-charcoal">{text}</p>
    </div>
  );
}
