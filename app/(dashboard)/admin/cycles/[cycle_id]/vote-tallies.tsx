"use client";

import { useEffect, useState } from "react";

type Tally = { problem_statement_id: number; total_votes: number };
type Statement = { id: number; statement_text: string };

/**
 * Compact ranked problem-statement tallies, shown in the admin Pod Voting
 * section so an admin/lead can see results before finalizing. Reads the same
 * aggregate endpoints the participant ballot uses (no per-voter attribution).
 */
export default function VoteTallies({ cycleId }: { cycleId: number }) {
  const [rows, setRows] = useState<{ text: string; votes: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/votes/${cycleId}`).then((r) => r.json()),
      fetch(`/api/problem-statements/${cycleId}`).then((r) => r.json()),
    ])
      .then(([voteData, statements]) => {
        const tallies: Tally[] = voteData?.tallies ?? [];
        const byId = new Map<number, string>(
          (Array.isArray(statements) ? (statements as Statement[]) : []).map((s) => [
            s.id,
            s.statement_text,
          ])
        );
        const merged = tallies
          .map((t) => ({ text: byId.get(t.problem_statement_id) ?? `#${t.problem_statement_id}`, votes: t.total_votes }))
          .sort((a, b) => b.votes - a.votes);
        setRows(merged);
      })
      .finally(() => setLoading(false));
  }, [cycleId]);

  if (loading) return <p className="text-xs text-meta">Loading tallies…</p>;
  if (rows.length === 0) return <p className="text-xs text-meta">No votes cast yet.</p>;

  const max = rows.reduce((m, r) => Math.max(m, r.votes), 0);

  return (
    <div className="mb-4 space-y-1.5 rounded-card border border-ink/10 bg-white p-4 shadow-card">
      <p className="lbl mb-1">Current tallies</p>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-3 text-sm">
          <span className="min-w-0 flex-1 truncate text-charcoal">{r.text}</span>
          <div className="h-2 w-24 overflow-hidden rounded-full bg-ink/[0.06]" aria-hidden>
            <div
              className="h-full bg-teal/60"
              style={{ width: `${max > 0 ? (r.votes / max) * 100 : 0}%` }}
            />
          </div>
          <span className="w-6 text-right font-semibold tabular-nums text-teal-deep">
            {r.votes}
          </span>
        </div>
      ))}
    </div>
  );
}
