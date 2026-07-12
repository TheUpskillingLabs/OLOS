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
  isSubmitter,
  submitterBudget,
  nonSubmitterBudget,
}: {
  cycleId: number;
  isSubmitter: boolean;
  submitterBudget: number;
  nonSubmitterBudget: number;
}) {
  const [statements, setStatements] = useState<ProblemStatement[]>([]);
  const [tallies, setTallies] = useState<Tally[]>([]);
  // The viewer's own allocation per statement (committed). Drives the
  // "Your votes: N" display and seeds the stepper when editing.
  const [myVotes, setMyVotes] = useState<Record<number, number>>({});
  // Which card's stepper is open, and the uncommitted stepper value per card.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Record<number, number>>({});
  const [totalUsed, setTotalUsed] = useState(0);
  // The server decides which budget applies (page.tsx resolves isSubmitter);
  // defaulting to nonSubmitterBudget here was the bug that showed submitters
  // 1 vote instead of their configured allowance.
  // Budget is fixed for the cycle (server resolves submitter vs non-submitter);
  // only totalUsed changes as votes are cast.
  const budget = isSubmitter ? submitterBudget : nonSubmitterBudget;
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
      // Votes cast in earlier sessions count against the budget and are shown
      // per card — without this, "votes remaining" reads as the full budget
      // after a reload and there's no visibility into prior allocation.
      if (Array.isArray(voteData?.my_votes)) {
        const mine: Record<number, number> = {};
        let used = 0;
        for (const v of voteData.my_votes as {
          problem_statement_id: number;
          vote_count: number;
        }[]) {
          mine[v.problem_statement_id] = v.vote_count;
          used += v.vote_count;
        }
        setMyVotes(mine);
        setTotalUsed(used);
      }
      setLoading(false);
    });
  }, [cycleId]);

  function getTallyFor(stmtId: number): number {
    return (
      tallies.find((t) => t.problem_statement_id === stmtId)?.total_votes ?? 0
    );
  }

  // Set-absolute: submits the desired total for a statement (0 removes it).
  // The stepper/edit UI collects the target count; the server clamps it to the
  // budget and this reconciles local state from the returned votes_remaining.
  async function setVotes(problemStatementId: number, count: number) {
    const prev = myVotes[problemStatementId] ?? 0;
    if (count === prev) {
      setEditingId(null);
      return;
    }

    setError("");
    setSuccessId(null);
    setSubmitting(problemStatementId);

    try {
      const res = await fetch("/api/votes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cycle_id: cycleId,
          problem_statement_id: problemStatementId,
          vote_count: count,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Failed to update votes");
        return;
      }

      const result = await res.json();
      setSuccessId(problemStatementId);

      setMyVotes((m) => {
        const next = { ...m };
        if (count === 0) delete next[problemStatementId];
        else next[problemStatementId] = count;
        return next;
      });

      // Budget is constant for the cycle; trust the server's votes_remaining as
      // the source of truth for how many votes are now used.
      if (result.votes_remaining !== undefined) {
        setTotalUsed(budget - result.votes_remaining);
      } else {
        setTotalUsed((t) => t - prev + count);
      }

      // Adjust the community tally by the delta (removal lowers it).
      const delta = count - prev;
      setTallies((prevT) => {
        const existing = prevT.find(
          (t) => t.problem_statement_id === problemStatementId
        );
        if (existing) {
          return prevT
            .map((t) =>
              t.problem_statement_id === problemStatementId
                ? { ...t, total_votes: Math.max(0, t.total_votes + delta) }
                : t
            )
            .filter((t) => t.total_votes > 0);
        }
        if (delta > 0) {
          return [
            ...prevT,
            { problem_statement_id: problemStatementId, total_votes: delta },
          ];
        }
        return prevT;
      });

      setEditingId(null);
      setDraft((d) => {
        const next = { ...d };
        delete next[problemStatementId];
        return next;
      });
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
          {remaining <= 0 ? (
            <p className="font-semibold text-charcoal">
              You&rsquo;ve used all of your votes for this cycle.
            </p>
          ) : (
            <p className="font-semibold text-charcoal">
              You have {budget} vote{budget !== 1 ? "s" : ""} this cycle
              {isSubmitter ? " (you submitted a proposal)" : ""}
            </p>
          )}
          <p>
            Submitters get {submitterBudget} · non-submitters get{" "}
            {nonSubmitterBudget}. Stack votes on one problem or spread them out.
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

      {/* Proposals list */}
      <div className="space-y-4">
        {statements.map((stmt) => {
          const pd = stmt.proposal_data;
          const isExpanded = expandedId === stmt.id;
          const hasDetails = pd?.problem || pd?.voter_context;

          const mine = myVotes[stmt.id] ?? 0;
          // Zero-state cards show the stepper directly so votes can be added;
          // cards you've voted on rest at "Your votes: N" until you hit Edit.
          const isEditing = editingId === stmt.id || mine === 0;
          // Freeing this card's current allocation is available headroom, so
          // the stepper can range up to mine + remaining.
          const maxSettable = mine + remaining;
          const draftValue = draft[stmt.id] ?? mine;

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
                    className="mt-2 inline-flex items-center text-xs font-semibold tracking-tight text-teal-deep transition-colors duration-150 hover:underline focus-visible:underline"
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
                    {mine > 0 && (
                      <span className="ml-2 font-semibold text-teal-deep">
                        · you: {mine}
                      </span>
                    )}
                  </span>
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label="Remove one vote"
                          onClick={() =>
                            setDraft((prev) => ({
                              ...prev,
                              [stmt.id]: Math.max(0, draftValue - 1),
                            }))
                          }
                          disabled={submitting !== null || draftValue <= 0}
                          className="flex h-8 w-8 items-center justify-center rounded-card border border-ink/10 bg-white text-lg leading-none text-ink transition-colors duration-150 hover:border-ink/20 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-base font-semibold tabular-nums text-ink">
                          {draftValue}
                        </span>
                        <button
                          type="button"
                          aria-label="Add one vote"
                          onClick={() =>
                            setDraft((prev) => ({
                              ...prev,
                              [stmt.id]: Math.min(maxSettable, draftValue + 1),
                            }))
                          }
                          disabled={submitting !== null || draftValue >= maxSettable}
                          className="flex h-8 w-8 items-center justify-center rounded-card border border-ink/10 bg-white text-lg leading-none text-ink transition-colors duration-150 hover:border-ink/20 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => setVotes(stmt.id, draftValue)}
                        disabled={submitting !== null || draftValue === mine}
                        className="rounded-card bg-teal/10 px-3 py-2 text-xs font-semibold tracking-tight text-teal-deep transition-all duration-150 hover:bg-teal/20 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
                      >
                        {submitting === stmt.id ? "..." : mine > 0 ? "Save" : "Vote"}
                      </button>
                      {mine > 0 && (
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setDraft((prev) => {
                              const next = { ...prev };
                              delete next[stmt.id];
                              return next;
                            });
                          }}
                          disabled={submitting !== null}
                          className="text-xs font-medium text-meta transition-colors duration-150 hover:text-charcoal disabled:opacity-40"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold tabular-nums text-charcoal">
                        Your votes: {mine}
                      </span>
                      <button
                        onClick={() => {
                          setEditingId(stmt.id);
                          setDraft((prev) => ({ ...prev, [stmt.id]: mine }));
                        }}
                        disabled={submitting !== null}
                        className="rounded-card bg-teal/10 px-3 py-2 text-xs font-semibold tracking-tight text-teal-deep transition-all duration-150 hover:bg-teal/20 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
                      >
                        Edit
                      </button>
                      {successId === stmt.id && (
                        <span className="text-xs font-medium text-teal-deep">
                          Saved
                        </span>
                      )}
                    </div>
                  )}
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
