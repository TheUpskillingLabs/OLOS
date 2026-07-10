"use client";

import { useState, type ReactNode } from "react";

export interface BallotItem {
  id: number;
  /** The rendered proposal/statement content shown above the vote control. */
  content: ReactNode;
}

/**
 * Shared budget-voting ballot — the single interaction model for both the pod
 * (problem-statement) and project (solution) votes. Live tallies, incremental
 * per-item allocation, and edit/withdraw until the window closes. The parent
 * supplies the items + initial server state (tallies, the caller's own
 * allocations) and the cast/withdraw endpoints; this component owns the
 * allocation UX (clamp-on-type, Update/Withdraw, budget header, aria-live
 * confirmation).
 *
 * Cast  → POST castUrl   { ...extraBody, [idField]: id, vote_count }
 * Withdraw → DELETE deleteUrl { ...extraBody, [idField]: id }
 */
export default function Ballot({
  items,
  budget,
  idField,
  castUrl,
  deleteUrl,
  extraBody = {},
  initialMyVotes = {},
  initialTallies = {},
  budgetNote,
}: {
  items: BallotItem[];
  budget: number;
  idField: string;
  castUrl: string;
  deleteUrl: string;
  extraBody?: Record<string, unknown>;
  initialMyVotes?: Record<number, number>;
  initialTallies?: Record<number, number>;
  budgetNote?: ReactNode;
}) {
  const [tallies, setTallies] = useState<Record<number, number>>(initialTallies);
  const [myVotes, setMyVotes] = useState<Record<number, number>>(initialMyVotes);
  const [pendingVotes, setPendingVotes] = useState<Record<number, number>>(initialMyVotes);
  const [totalUsed, setTotalUsed] = useState(
    Object.values(initialMyVotes).reduce((s, n) => s + n, 0)
  );
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  const remaining = budget - totalUsed;

  async function castVote(id: number) {
    const voteCount = pendingVotes[id];
    if (!voteCount || voteCount < 1) return;
    const previous = myVotes[id] ?? 0;
    const delta = voteCount - previous;

    setError("");
    setStatusMsg("");
    setSubmitting(id);
    try {
      const res = await fetch(castUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...extraBody, [idField]: id, vote_count: voteCount }),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Failed to cast vote");
        return;
      }
      setMyVotes((prev) => ({ ...prev, [id]: voteCount }));
      setTotalUsed((prev) => prev + delta);
      setTallies((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + delta }));
      setStatusMsg("Vote saved.");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSubmitting(null);
    }
  }

  async function withdrawVote(id: number) {
    const previous = myVotes[id] ?? 0;
    if (previous < 1) return;

    setError("");
    setStatusMsg("");
    setSubmitting(id);
    try {
      const res = await fetch(deleteUrl, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...extraBody, [idField]: id }),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Failed to withdraw vote");
        return;
      }
      setMyVotes((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setPendingVotes((prev) => ({ ...prev, [id]: 0 }));
      setTotalUsed((prev) => prev - previous);
      setTallies((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) - previous) }));
      setStatusMsg("Vote withdrawn.");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Budget header */}
      <div className="sticky top-[76px] z-30 flex items-center justify-between gap-4 rounded-card border border-ink/10 bg-white/95 p-4 shadow-card backdrop-blur-sm">
        <div>
          <p className="lbl">Vote budget</p>
          <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-teal-deep">
            {remaining}
          </p>
          <p className="text-xs text-meta tabular-nums">
            {remaining === 1 ? "vote" : "votes"} remaining
          </p>
        </div>
        {budgetNote && (
          <div className="text-right text-xs text-meta tabular-nums">{budgetNote}</div>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-card border border-red/20 bg-red/10 px-3 py-2 text-sm text-red"
        >
          {error}
        </p>
      )}
      {/* aria-live confirmation — announced to screen readers, visually subtle */}
      <p role="status" aria-live="polite" className="sr-only">
        {statusMsg}
      </p>

      <div className="space-y-4">
        {items.map((item) => {
          const mine = myVotes[item.id] ?? 0;
          const pending = pendingVotes[item.id] ?? 0;
          // You may allocate up to what's remaining plus what you've already put
          // on this item (re-allocating frees your own prior votes).
          const maxForThis = remaining + mine;
          const unchanged = pending === mine;
          const over = pending > maxForThis;
          const tally = tallies[item.id] ?? 0;

          return (
            <div
              key={item.id}
              className="rounded-card border border-ink/10 bg-white shadow-card transition-colors duration-150 hover:border-ink/20"
            >
              <div className="p-4">
                {item.content}

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-ink/10 pt-3">
                  <span className="text-xs font-medium text-meta tabular-nums">
                    {tally} vote{tally !== 1 ? "s" : ""}
                    {mine > 0 && (
                      <span className="ml-2 text-teal-deep">&middot; you: {mine}</span>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={maxForThis}
                      value={pendingVotes[item.id] ?? ""}
                      onChange={(e) => {
                        // Clamp on type so an over-budget entry can't reach submit.
                        const raw = parseInt(e.target.value, 10) || 0;
                        const clamped = Math.max(0, Math.min(raw, maxForThis));
                        setPendingVotes((prev) => ({ ...prev, [item.id]: clamped }));
                      }}
                      placeholder="0"
                      aria-label="Vote count"
                      className="w-16 rounded-card border border-ink/10 bg-white px-2 py-1 text-center text-base tabular-nums text-ink placeholder:text-meta-soft transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
                    />
                    <button
                      onClick={() => castVote(item.id)}
                      disabled={submitting !== null || pending < 1 || unchanged || over}
                      title={
                        over
                          ? "That's more than your remaining budget"
                          : unchanged && mine > 0
                            ? "No change to save"
                            : undefined
                      }
                      className="rounded-card bg-teal/10 px-3 py-2 text-xs font-semibold tracking-tight text-teal-deep transition-all duration-150 hover:bg-teal/20 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
                    >
                      {submitting === item.id ? "…" : mine > 0 ? "Update" : "Vote"}
                    </button>
                    {mine > 0 && (
                      <button
                        onClick={() => withdrawVote(item.id)}
                        disabled={submitting !== null}
                        className="rounded-card px-3 py-2 text-xs font-semibold tracking-tight text-charcoal ring-1 ring-ink/10 transition-all duration-150 ease-spring hover:bg-ink/[0.04] hover:text-ink hover:ring-ink/20 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
                      >
                        Withdraw
                      </button>
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
