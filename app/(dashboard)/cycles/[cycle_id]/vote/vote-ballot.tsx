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
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(null);
    }
  }

  const remaining = budget - totalUsed;

  if (loading) {
    return <p className="text-cloud/50">Loading proposals...</p>;
  }

  if (statements.length === 0) {
    return (
      <div className="rounded-md border border-whisper bg-white/[0.02] p-6 text-center">
        <p className="text-cloud/60">
          No problem statements have been submitted yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Budget indicator */}
      <div className="flex items-center gap-4 rounded-md border border-teal/20 bg-teal/[0.04] p-4">
        <div>
          <p className="text-sm text-cloud/60">Vote Budget</p>
          <p className="text-2xl font-bold text-aqua">{remaining}</p>
          <p className="text-xs text-cloud/40">votes remaining</p>
        </div>
        <div className="text-xs text-cloud/40">
          <p>Submitters get {submitterBudget} votes</p>
          <p>Non-submitters get {nonSubmitterBudget} votes</p>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
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
              className="rounded-md border border-whisper bg-white/[0.02]"
            >
              <div className="p-4">
                {/* Problem statement */}
                <p className="font-medium text-white">
                  {stmt.statement_text}
                </p>

                {/* HMW question */}
                {pd?.statement?.question && (
                  <p className="mt-2 text-sm italic text-cloud/50">
                    {pd.statement.question}
                  </p>
                )}

                {/* Submitter background */}
                {pd?.about?.background && (
                  <p className="mt-2 text-xs text-cloud/40">
                    Submitted by: {pd.about.background}
                  </p>
                )}

                {/* Expand toggle */}
                {hasDetails && (
                  <button
                    onClick={() =>
                      setExpandedId(isExpanded ? null : stmt.id)
                    }
                    className="mt-2 text-xs text-aqua hover:underline"
                  >
                    {isExpanded ? "Show less" : "Read full proposal"}
                  </button>
                )}

                {/* Expanded details */}
                {isExpanded && pd && (
                  <div className="mt-4 space-y-3 border-t border-white/5 pt-4">
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
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-cloud/40">
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
                      className="w-16 rounded border border-whisper bg-white/[0.04] px-2 py-1 text-center text-sm text-white placeholder:text-cloud/30 focus:border-teal focus:outline-none"
                    />
                    <button
                      onClick={() => castVote(stmt.id)}
                      disabled={
                        submitting !== null ||
                        !pendingVotes[stmt.id] ||
                        pendingVotes[stmt.id] < 1
                      }
                      className="rounded bg-teal/20 px-3 py-1 text-xs font-medium text-aqua transition-colors hover:bg-teal/30 disabled:opacity-40"
                    >
                      {submitting === stmt.id ? "..." : "Vote"}
                    </button>
                    {successId === stmt.id && (
                      <span className="text-xs text-aqua">Voted!</span>
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
      <p className="text-[11px] font-medium uppercase tracking-wider text-cloud/40">
        {label}
      </p>
      <p className="mt-0.5 text-sm text-cloud/70">{text}</p>
    </div>
  );
}
