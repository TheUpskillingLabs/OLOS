"use client";

import { useState, useEffect } from "react";
import Ballot, { type BallotItem } from "@/app/components/flow/ballot";
import { EmptyState } from "@/app/components/ui";

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

export default function VoteBallot({
  cycleId,
  submitterBudget,
  nonSubmitterBudget,
  isSubmitter,
}: {
  cycleId: number;
  submitterBudget: number;
  nonSubmitterBudget: number;
  isSubmitter: boolean;
}) {
  const budget = isSubmitter ? submitterBudget : nonSubmitterBudget;

  const [statements, setStatements] = useState<ProblemStatement[]>([]);
  const [tallies, setTallies] = useState<Record<number, number>>({});
  const [myVotes, setMyVotes] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/problem-statements/${cycleId}`).then((r) => r.json()),
      fetch(`/api/votes/${cycleId}`).then((r) => r.json()),
    ]).then(([stmts, voteData]) => {
      if (Array.isArray(stmts)) setStatements(stmts);
      const t: Record<number, number> = {};
      for (const row of voteData?.tallies ?? []) t[row.problem_statement_id] = row.total_votes;
      setTallies(t);
      const mine: Record<number, number> = {};
      for (const row of voteData?.my_votes ?? []) mine[row.problem_statement_id] = row.vote_count;
      setMyVotes(mine);
      setLoading(false);
    });
  }, [cycleId]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-meta" aria-busy="true">
        <span
          role="status"
          aria-label="Loading"
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink/10 border-t-teal"
        />
        Loading proposals…
      </div>
    );
  }

  if (statements.length === 0) {
    return (
      <EmptyState
        title="No problem statements yet"
        description="No one has submitted a problem statement for this cycle yet. Once the submission window has run, they'll show up here to vote on."
      />
    );
  }

  const items: BallotItem[] = statements.map((stmt) => ({
    id: stmt.id,
    content: <StatementContent stmt={stmt} />,
  }));

  return (
    <Ballot
      items={items}
      budget={budget}
      idField="problem_statement_id"
      castUrl="/api/votes"
      deleteUrl="/api/votes"
      extraBody={{ cycle_id: cycleId }}
      initialMyVotes={myVotes}
      initialTallies={tallies}
      budgetNote={
        <>
          <p>Submitters get {submitterBudget} votes</p>
          <p>Non-submitters get {nonSubmitterBudget} votes</p>
        </>
      }
    />
  );
}

function StatementContent({ stmt }: { stmt: ProblemStatement }) {
  const [expanded, setExpanded] = useState(false);
  const pd = stmt.proposal_data;
  const hasDetails = pd?.problem || pd?.voter_context;

  return (
    <div>
      <p className="font-semibold tracking-tight text-ink">{stmt.statement_text}</p>

      {pd?.statement?.question && (
        <p className="mt-2 text-sm italic text-slate">{pd.statement.question}</p>
      )}
      {pd?.about?.background && (
        <p className="mt-2 text-xs text-meta">Submitted by: {pd.about.background}</p>
      )}

      {hasDetails && (
        <button
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 inline-flex items-center text-xs font-semibold tracking-tight text-teal-deep transition-colors duration-150 hover:underline focus-visible:outline-none focus-visible:underline"
        >
          {expanded ? "Show less" : "Read full proposal"}
        </button>
      )}

      {expanded && pd && (
        <div className="mt-4 space-y-3 border-t border-ink/10 pt-4">
          {pd.problem?.who && <DetailBlock label="Who is struggling" text={pd.problem.who} />}
          {pd.problem?.need && <DetailBlock label="What they need to do" text={pd.problem.need} />}
          {pd.problem?.barrier && <DetailBlock label="Why they can't do it now" text={pd.problem.barrier} />}
          {pd.problem?.success && <DetailBlock label="What success looks like" text={pd.problem.success} />}
          {pd.voter_context?.tried && <DetailBlock label="What has been tried" text={pd.voter_context.tried} />}
          {pd.voter_context?.scale && <DetailBlock label="Why it matters beyond the individual" text={pd.voter_context.scale} />}
          {pd.voter_context?.pod_work && <DetailBlock label="What the Research Pod would do" text={pd.voter_context.pod_work} />}
          {pd.voter_context?.skills_needed && <DetailBlock label="Skills & people needed" text={pd.voter_context.skills_needed} />}
        </div>
      )}
    </div>
  );
}

function DetailBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="lbl">{label}</p>
      <p className="mt-0.5 text-sm text-charcoal">{text}</p>
    </div>
  );
}
