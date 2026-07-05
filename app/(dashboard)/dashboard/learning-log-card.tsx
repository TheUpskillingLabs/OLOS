"use client";

import { useCallback, useEffect, useState } from "react";

/* The Learning Log — the weekly ritual, on the dashboard where the practice
   lives (owner decision: the ritual is Home, not a nav destination). Three
   parts, one Save (prototype dashboard/index.html + app.js
   renderLearningLog/saveLearningLog):
     1. Health check — two 1–5 scales + an "I'm blocked" toggle. Private to
        the member, their Poderator, and admins. Never shared.
     2. Scaffolded reflection — three prompts that kill the blank page.
     3. Share preview — the prompts concatenated into one paragraph, with a
        members-only share toggle (the ONLY source of member updates).
   Unlimited logs; the form resets after save; saving clears the weekly
   gate instantly ("You're back in ✓" — firm, never shaming). */

interface RecentLog {
  id: number;
  kind: string;
  clarity: number;
  alignment: number;
  is_blocked: boolean;
  accomplished: string | null;
  exploring: string | null;
  next_focus: string | null;
  share_publicly: boolean;
  created_at: string;
}

const SCALE = [1, 2, 3, 4, 5];

function ScaleRow({
  label,
  low,
  high,
  value,
  onChange,
}: {
  label: string;
  low: string;
  high: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-ink">{label}</span>
        <span className="text-xs text-meta">
          {low} → {high}
        </span>
      </div>
      <div className="mt-2 flex gap-2" role="radiogroup" aria-label={label}>
        {SCALE.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            onClick={() => onChange(n)}
            className={`h-11 flex-1 rounded-card border text-sm font-semibold transition-colors duration-150 ${
              value === n
                ? "border-teal-deep bg-teal-deep text-white"
                : "border-ink/15 bg-white text-charcoal hover:border-teal"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export interface MilestoneContext {
  kind: string;
  /** "Mid-cycle review" / "End-cycle review". */
  label: string;
  /** Seed values from the member's most recent log (review, don't re-ask). */
  prefill: {
    clarity: number;
    alignment: number;
    accomplished: string;
    exploring: string;
    next_focus: string;
  } | null;
}

export default function LearningLogCard({
  gateActive,
  milestone = null,
}: {
  gateActive: boolean;
  /** When set, this week is a milestone evaluation — same flow, evaluation
      framing, prefilled from the member's own logs (never a grade). */
  milestone?: MilestoneContext | null;
}) {
  const pf = milestone?.prefill ?? null;
  const [clarity, setClarity] = useState(pf?.clarity ?? 3);
  const [alignment, setAlignment] = useState(pf?.alignment ?? 3);
  const [blocked, setBlocked] = useState(false);
  const [blockerContext, setBlockerContext] = useState("");
  const [accomplished, setAccomplished] = useState(pf?.accomplished ?? "");
  const [exploring, setExploring] = useState(pf?.exploring ?? "");
  const [nextFocus, setNextFocus] = useState(pf?.next_focus ?? "");
  const [share, setShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState<null | { cleared: boolean }>(null);
  const [recent, setRecent] = useState<RecentLog[]>([]);
  const [count, setCount] = useState(0);

  const loadRecent = useCallback(async () => {
    try {
      const res = await fetch("/api/learning-logs");
      if (!res.ok) return;
      const data = await res.json();
      setRecent(data.logs ?? []);
      setCount(data.count ?? 0);
    } catch {
      /* history is decoration — the form still works */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/learning-logs");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        setRecent(data.logs ?? []);
        setCount(data.count ?? 0);
      } catch {
        /* history is decoration — the form still works */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const preview = [
    accomplished.trim() && `This week, I figured out ${accomplished.trim()}`,
    exploring.trim() && `I’m currently exploring ${exploring.trim()}`,
    nextFocus.trim() && `Next week, my focus is ${nextFocus.trim()}`,
  ]
    .filter(Boolean)
    .join(" ");

  // Milestone weeks reframe the same three prompts as an evaluation.
  const isFinal = milestone?.kind === "milestone_13";
  const promptLabels: [string, string, string] = milestone
    ? [
        "Looking back over the cycle, what have you built or figured out?",
        "Where are you now — what are you still working through?",
        isFinal
          ? "What are you taking with you from this cycle?"
          : "What’s your focus for the rest of the cycle?",
      ]
    : [
        "This week, I figured out…",
        "I’m currently exploring…",
        "Next week, my focus is…",
      ];

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/learning-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clarity,
          alignment,
          is_blocked: blocked,
          blocker_context: blocked ? blockerContext : null,
          accomplished: accomplished || null,
          exploring: exploring || null,
          next_focus: nextFocus || null,
          share_publicly: share,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "That didn’t save. Give it another try.");
        return;
      }
      const data = await res.json();
      setJustSaved({ cleared: !!data.gate_cleared });
      // The form resets in place — log as often as you like.
      setClarity(3);
      setAlignment(3);
      setBlocked(false);
      setBlockerContext("");
      setAccomplished("");
      setExploring("");
      setNextFocus("");
      setShare(false);
      loadRecent();
      if (data.gate_cleared) {
        // The gate reads server state — refresh so the chrome unlocks now.
        setTimeout(() => window.location.reload(), 1200);
      }
    } catch {
      setError("That didn’t save. Give it another try.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      id="learning-log"
      className={`mb-8 rounded-card border bg-white p-6 shadow-card ${
        gateActive ? "border-red" : "border-ink/10"
      }`}
    >
      <div className="flex items-baseline justify-between">
        <div>
          <p className="lbl">{milestone ? "Milestone" : "Weekly ritual"}</p>
          <h2 className="t-h3 text-ink">
            {milestone ? milestone.label : "Learning Log"}
          </h2>
        </div>
        {count > 0 && (
          <span className="text-sm text-meta">
            {count} {count === 1 ? "log" : "logs"} so far
          </span>
        )}
      </div>

      {milestone && (
        <p className="mt-2 text-sm text-charcoal">
          An evaluation inside the practice — the same Learning Log, prefilled
          from your own logs so you review your record instead of a blank page.
          Never a grade.
        </p>
      )}

      {justSaved && (
        <div
          className="mt-4 rounded-card border border-teal/40 bg-teal/5 px-4 py-3 text-sm font-semibold text-teal-deep"
          role="status"
        >
          Logged ✓{justSaved.cleared ? " — you’re back in ✓" : ""}
        </div>
      )}

      {/* Part 1 — health check (private) */}
      <div className="mt-5 space-y-4">
        <p className="text-xs text-meta">
          This part stays between you, your Poderator, and admins. It never
          gets shared.
        </p>
        <ScaleRow
          label="Clarity on your next steps"
          low="Foggy"
          high="Crystal"
          value={clarity}
          onChange={setClarity}
        />
        <ScaleRow
          label="Alignment with your pod"
          low="Adrift"
          high="In sync"
          value={alignment}
          onChange={setAlignment}
        />
        <label className="flex items-center gap-2 text-sm font-semibold text-ink">
          <input
            type="checkbox"
            checked={blocked}
            onChange={(e) => setBlocked(e.target.checked)}
            className="h-4 w-4 accent-[var(--red)]"
          />
          I’m currently blocked
        </label>
        {blocked && (
          <textarea
            value={blockerContext}
            onChange={(e) => setBlockerContext(e.target.value)}
            placeholder="What do you need?"
            rows={2}
            maxLength={2000}
            className="w-full rounded-card border border-ink/15 p-3 text-base"
          />
        )}
      </div>

      {/* Part 2 — scaffolded reflection */}
      <div className="mt-6 space-y-4">
        {(
          [
            [promptLabels[0], accomplished, setAccomplished],
            [promptLabels[1], exploring, setExploring],
            [promptLabels[2], nextFocus, setNextFocus],
          ] as const
        ).map(([label, value, setter]) => (
          <div key={label}>
            <label className="text-sm font-semibold text-ink">{label}</label>
            <textarea
              value={value}
              onChange={(e) => setter(e.target.value)}
              rows={2}
              maxLength={2000}
              className="mt-1 w-full rounded-card border border-ink/15 p-3 text-base"
            />
          </div>
        ))}
      </div>

      {/* Part 3 — share preview */}
      {preview && (
        <div className="mt-6 rounded-card border border-ink/10 bg-paper p-4">
          <p className="text-sm text-charcoal">{preview}</p>
          <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              checked={share}
              onChange={(e) => setShare(e.target.checked)}
              className="h-4 w-4 accent-[var(--teal-deep)]"
            />
            Share this with The Labs
          </label>
          <p className="mt-1 text-xs text-meta">
            Members only. Your health check never travels with it.
          </p>
        </div>
      )}

      {error && (
        <p className="mt-4 text-sm text-red" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="btn btn-teal mt-5"
      >
        {busy ? "Saving…" : milestone ? "Save review" : "Save log"}
      </button>

      {recent.length > 0 && (
        <div className="mt-6 border-t border-ink/10 pt-4">
          <p className="lbl mb-2">Recent logs</p>
          <ul className="space-y-2">
            {recent.slice(0, 5).map((log) => (
              <li key={log.id} className="flex items-center gap-3 text-sm">
                <span className="text-meta">
                  {new Date(log.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="truncate text-charcoal">
                  {log.accomplished || log.exploring || log.next_focus || "Health check"}
                </span>
                {log.is_blocked && (
                  <span className="flex-shrink-0 text-xs font-semibold text-red">
                    blocked
                  </span>
                )}
                {log.share_publicly && (
                  <span className="flex-shrink-0 text-xs text-teal-deep">
                    shared
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
