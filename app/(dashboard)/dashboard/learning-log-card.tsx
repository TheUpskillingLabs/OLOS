"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/* The Learning Log — the weekly ritual, on the dashboard where the practice
   lives (owner decision: the ritual is Home, not a nav destination). Three
   parts, one Save (prototype dashboard/index.html + app.js
   renderLearningLog/saveLearningLog):
     1. Health check — two 1–5 scales + an "I'm blocked" toggle. Private to
        the member, their Poderator, and admins. Never shared.
     2. Scaffolded reflection — three prompts that kill the blank page.
     3. Share preview — the prompts concatenated into one paragraph, with a
        members-only share toggle (one of two feed sources, alongside the
        freeform Update composer).
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
  journal = false,
  logCycles = [],
  pendingCycleIds = [],
  embedded = false,
}: {
  gateActive: boolean;
  /** When set, this week is a milestone evaluation — same flow, evaluation
      framing, prefilled from the member's own logs (never a grade). */
  milestone?: MilestoneContext | null;
  /** Journal mode: the member isn't an active cycle member, so this is a
      personal diary — no pod health check, no gate, timeless prompts. The
      practice is theirs from account creation; the cycle only adds cadence. */
  journal?: boolean;
  /** Every active cycle this member is actively enrolled in (org cycles:
      dual-enrolled staff can hold both a participant and an org enrollment
      at once). More than one renders a "Log for" picker; the chosen
      cycle_id always rides along on save, even with exactly one. */
  logCycles?: { id: number; name: string; mode: string }[];
  /** The gate's pending (armed + unmet) cycle ids — a locked member's
      "Log for" picker should default to one of THESE, not blindly to the
      open cycle, or a member whose only pending window is the org cycle
      saves against the open cycle by default and stays locked with a
      success message. */
  pendingCycleIds?: number[];
  /** Embedded in the feed composer (dashboard): drop the card chrome and the
      header — the composer's card + "Learning Log" tab supply them — and
      render just the form. */
  embedded?: boolean;
}) {
  const router = useRouter();
  const pf = milestone?.prefill ?? null;
  const [clarity, setClarity] = useState(pf?.clarity ?? 3);
  const [alignment, setAlignment] = useState(pf?.alignment ?? 3);
  const [blocked, setBlocked] = useState(false);
  const [blockerContext, setBlockerContext] = useState("");
  const [accomplished, setAccomplished] = useState(pf?.accomplished ?? "");
  const [exploring, setExploring] = useState(pf?.exploring ?? "");
  const [nextFocus, setNextFocus] = useState(pf?.next_focus ?? "");
  // Work-log fields (00069) — org cycles only (the member tier of the
  // Leadership Log cascade).
  const [workSummary, setWorkSummary] = useState("");
  const [workProgress, setWorkProgress] = useState("");
  const [workBlockers, setWorkBlockers] = useState("");
  const [share, setShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState<null | {
    cleared: boolean;
    stillDue: string | null;
  }>(null);
  const [recent, setRecent] = useState<RecentLog[]>([]);
  const [count, setCount] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  // Default: whichever eligible cycle is actually pending the gate (a
  // locked member should log against the cycle that's locking them, not
  // silently save against the open cycle and stay locked). Falls back to
  // the open (participant) cycle — the legacy single-cycle behavior a
  // dual-enrolled, non-locked member expects by default — then the first.
  const [selectedCycleId, setSelectedCycleId] = useState<number | null>(() => {
    if (logCycles.length === 0) return null;
    const pending = logCycles.find((c) => pendingCycleIds.includes(c.id));
    return (
      pending ?? logCycles.find((c) => c.mode === "open") ?? logCycles[0]
    ).id;
  });
  const selectedCycle =
    logCycles.find((c) => c.id === selectedCycleId) ?? null;

  // Milestone framing describes the participant (open) cycle's record; a
  // dual-enrolled member logging against a different cycle gets the plain
  // weekly framing for that save instead.
  const activeMilestone =
    milestone && (!selectedCycle || selectedCycle.mode === "open")
      ? milestone
      : null;

  const toggleExpanded = useCallback((id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

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
  const isFinal = activeMilestone?.kind === "milestone_13";
  const promptLabels: [string, string, string] = activeMilestone
    ? [
        "Looking back over the cycle, what have you built or figured out?",
        "Where are you now — what are you still working through?",
        isFinal
          ? "What are you taking with you from this cycle?"
          : "What’s your focus for the rest of the cycle?",
      ]
    : journal
      ? [
          "What did you figure out?",
          "What are you exploring?",
          "What’s your focus next?",
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
          work_summary: workSummary || null,
          work_progress: workProgress || null,
          work_blockers: workBlockers || null,
          share_publicly: share,
          cycle_id: selectedCycleId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "That didn’t save. Give it another try.");
        return;
      }
      const data = await res.json();
      // Name the still-pending cycle when the save didn't fully clear the
      // gate — a dual-enrolled member logging one cycle's window while
      // another stays due shouldn't read a bare "Logged ✓" with no hint
      // they're still locked.
      const stillPendingIds = pendingCycleIds.filter(
        (id) => id !== selectedCycleId
      );
      const stillDueCycle = logCycles.find((c) => c.id === stillPendingIds[0]);
      const stillDue = !data.gate_cleared
        ? stillDueCycle
          ? `${stillDueCycle.name}${stillDueCycle.mode === "org" ? " (org)" : ""}`
          : null
        : null;
      setJustSaved({ cleared: !!data.gate_cleared, stillDue });
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
      // Refresh the server components so anything derived from log state
      // updates in place — notably the setup checklist's "Save your first
      // Learning Log" row, which is computed server-side (logCount > 0) and
      // otherwise stayed unchecked until a manual refresh.
      router.refresh();
      if (data.gate_cleared) {
        // The gate reads server state — full reload so the locked chrome
        // unlocks now (stronger than router.refresh for the layout gate).
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
      id={embedded ? undefined : "learning-log"}
      className={
        embedded
          ? ""
          : `mb-8 rounded-card border bg-white p-6 shadow-card ${
              gateActive ? "border-red" : "border-ink/10"
            }`
      }
    >
      {!embedded && (
        <div className="flex items-baseline justify-between">
          <div>
            <p className="lbl">
              {journal
                ? "Journal"
                : activeMilestone
                  ? "Milestone"
                  : "Weekly ritual"}
            </p>
            <h2 className="t-h3 text-ink">
              {activeMilestone ? activeMilestone.label : "Learning Log"}
            </h2>
          </div>
          {count > 0 && (
            <span className="text-sm text-meta">
              {count} {count === 1 ? "log" : "logs"} so far
            </span>
          )}
        </div>
      )}

      {activeMilestone && (
        <p className="mt-2 text-sm text-charcoal">
          An evaluation inside the practice — the same Learning Log, prefilled
          from your own logs so you review your record instead of a blank page.
          Never a grade.
        </p>
      )}

      {logCycles.length > 1 && (
        <label className="mt-4 block">
          <span className="text-sm font-semibold text-ink">Log for</span>
          <select
            value={selectedCycleId ?? ""}
            onChange={(e) => setSelectedCycleId(Number(e.target.value))}
            className="mt-1 w-full rounded-card border border-ink/15 bg-white p-2.5 text-base text-ink transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
          >
            {logCycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.mode === "org" ? " (org)" : ""}
              </option>
            ))}
          </select>
        </label>
      )}

      {journal && (
        <p className="mt-2 text-sm text-charcoal">
          A running record of what you&apos;re learning — yours to keep and look
          back on anytime. When you join a Build Cycle this becomes your
          required weekly check-in.
        </p>
      )}

      {justSaved && (
        <div
          className="mt-4 rounded-card border border-teal/40 bg-teal/5 px-4 py-3 text-sm font-semibold text-teal-deep"
          role="status"
        >
          Logged ✓{justSaved.cleared ? " — you’re back in ✓" : ""}
          {justSaved.stillDue && ` · Still due: ${justSaved.stillDue}`}
        </div>
      )}

      {/* Part 1 — health check (private). Cycle practice only: it's the
          pod-support instrument (clarity + pod alignment + blocked → the
          Poderator). A solo journaler has no pod, so journal mode drops it
          and keeps the reflection. */}
      {!journal && (
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
              aria-label="What do you need?"
              rows={2}
              maxLength={2000}
              className="w-full rounded-card border border-ink/15 p-3 text-base"
            />
          )}
        </div>
      )}

      {/* Part 2 — scaffolded reflection */}
      <div className="mt-6 space-y-4">
        {(
          [
            [promptLabels[0], accomplished, setAccomplished],
            [promptLabels[1], exploring, setExploring],
            [promptLabels[2], nextFocus, setNextFocus],
          ] as const
        ).map(([label, value, setter], i) => (
          <div key={label}>
            <label
              htmlFor={`ll-reflect-${i}`}
              className="text-sm font-semibold text-ink"
            >
              {label}
            </label>
            <textarea
              id={`ll-reflect-${i}`}
              value={value}
              onChange={(e) => setter(e.target.value)}
              rows={2}
              maxLength={2000}
              className="mt-1 w-full rounded-card border border-ink/15 p-3 text-base"
            />
          </div>
        ))}
      </div>

      {/* Work log (org cycles only, 00069) — the member tier of the
          Leadership Log cascade: your work on the workstream this week. */}
      {!journal && selectedCycle?.mode === "org" && (
        <div className="mt-6 space-y-4 rounded-card border border-teal/20 bg-teal/[0.04] p-4">
          <p className="lbl">Your work this week</p>
          {(
            [
              ["What did you work on for the workstream?", workSummary, setWorkSummary],
              ["Progress toward the workstream’s goal", workProgress, setWorkProgress],
              ["Blockers on the work", workBlockers, setWorkBlockers],
            ] as const
          ).map(([label, value, setter], i) => (
            <div key={label}>
              <label
                htmlFor={`ll-work-${i}`}
                className="text-sm font-semibold text-ink"
              >
                {label}
              </label>
              <textarea
                id={`ll-work-${i}`}
                value={value}
                onChange={(e) => setter(e.target.value)}
                rows={2}
                maxLength={2000}
                className="mt-1 w-full rounded-card border border-ink/15 p-3 text-base"
              />
            </div>
          ))}
        </div>
      )}

      {/* Part 3 — share preview */}
      {preview && (
        <div className="mt-6 rounded-card border border-ink/10 bg-paper p-4">
          <p className="break-words text-sm text-charcoal">{preview}</p>
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
        {busy ? "Saving…" : activeMilestone ? "Save review" : "Save log"}
      </button>

      {/* Your record — every past entry, readable in place (review, don't
          re-derive). Tap a row to open the full reflection. */}
      {recent.length > 0 && (
        <div className="mt-6 border-t border-ink/10 pt-4">
          <p className="lbl mb-2">{journal ? "Your journal" : "Your logs"}</p>
          <ul className="space-y-1.5">
            {(showAll ? recent : recent.slice(0, 5)).map((log) => {
              const open = expanded.has(log.id);
              const summary =
                log.accomplished ||
                log.exploring ||
                log.next_focus ||
                "Health check";
              const hasBody =
                !!(log.accomplished || log.exploring || log.next_focus);
              return (
                <li
                  key={log.id}
                  className="overflow-hidden rounded-card border border-ink/10"
                >
                  <button
                    type="button"
                    onClick={() => toggleExpanded(log.id)}
                    aria-expanded={open}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-ink/[0.02]"
                  >
                    <span className="flex-shrink-0 text-meta tabular-nums">
                      {new Date(log.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-charcoal">
                      {summary}
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
                    <span aria-hidden className="flex-shrink-0 text-meta">
                      {open ? "–" : "+"}
                    </span>
                  </button>
                  {open && (
                    <div className="space-y-1.5 border-t border-ink/10 px-3 py-2.5 text-sm text-charcoal break-words">
                      {log.accomplished && (
                        <p>
                          <span className="font-semibold text-ink">
                            Figured out:
                          </span>{" "}
                          {log.accomplished}
                        </p>
                      )}
                      {log.exploring && (
                        <p>
                          <span className="font-semibold text-ink">
                            Exploring:
                          </span>{" "}
                          {log.exploring}
                        </p>
                      )}
                      {log.next_focus && (
                        <p>
                          <span className="font-semibold text-ink">Next:</span>{" "}
                          {log.next_focus}
                        </p>
                      )}
                      {!hasBody && (
                        <p className="text-meta">
                          No written reflection on this one.
                        </p>
                      )}
                      {!journal && (
                        <p className="text-xs text-meta">
                          Clarity {log.clarity}/5 · Alignment {log.alignment}/5
                        </p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {recent.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-2 text-sm font-semibold text-teal-deep hover:underline"
            >
              {showAll ? "Show less" : `Show all ${recent.length}`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
