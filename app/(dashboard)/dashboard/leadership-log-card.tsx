"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/* The Leadership Log composer (docs/ORG_CYCLES.md §4a) — the lead tiers of the
   org weekly cascade. NON-BLOCKING: it never locks the dashboard. Each scope a
   lead holds (a co-led run pod, or a led lab) gets its own log, composed beside
   a read-only view of the tier below's logs (members' Learning Logs for a
   workstream lead; workstream leads' Leadership Logs for a lab lead). */

export interface LeadershipTeamLog {
  participantName: string;
  // Nullable since 00091 — mirrors lib/leadership-logs/context.ts's
  // TeamLogEntry (org logs still write both; the column allows NULL).
  clarity: number | null;
  alignment: number | null;
  is_blocked: boolean;
  blocker_context: string | null;
  accomplished: string | null;
  exploring: string | null;
  next_focus: string | null;
  work_summary?: string | null;
  work_progress?: string | null;
  work_blockers?: string | null;
  created_at: string;
}

export interface LeadershipCardScope {
  tier: "workstream_lead" | "lab_lead";
  cycleId: number;
  podId: number | null;
  labId: number | null;
  scopeLabel: string;
  cycleName: string;
  targetDay: string;
  due: boolean;
  submittedThisWeek: boolean;
  context: LeadershipTeamLog[];
}

const scopeKey = (s: LeadershipCardScope) =>
  `${s.tier}:${s.cycleId}:${s.podId != null ? "p" + s.podId : "l" + s.labId}`;

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
      <p className="text-sm font-semibold text-ink">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            onClick={() => onChange(n)}
            className={`h-9 w-9 rounded-card text-sm font-semibold tabular-nums transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-teal ${
              value === n
                ? "bg-teal-deep text-white"
                : "bg-ink/[0.04] text-charcoal hover:bg-ink/10"
            }`}
          >
            {n}
          </button>
        ))}
        <span className="ml-2 text-xs text-meta">
          {low} &rarr; {high}
        </span>
      </div>
    </div>
  );
}

export default function LeadershipLogCard({
  scopes,
}: {
  scopes: LeadershipCardScope[];
}) {
  const router = useRouter();
  const first = scopes.find((s) => s.due) ?? scopes[0];
  const [selKey, setSelKey] = useState(first ? scopeKey(first) : "");
  const sel = scopes.find((s) => scopeKey(s) === selKey) ?? scopes[0];

  const [clarity, setClarity] = useState(3);
  const [alignment, setAlignment] = useState(3);
  const [blocked, setBlocked] = useState(false);
  const [blockerContext, setBlockerContext] = useState("");
  const [accomplished, setAccomplished] = useState("");
  const [exploring, setExploring] = useState("");
  const [nextFocus, setNextFocus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());

  if (!sel) return null;
  const alreadyDone = sel.submittedThisWeek || savedKeys.has(scopeKey(sel));
  const isWorkstream = sel.tier === "workstream_lead";
  const contextHeading = isWorkstream
    ? `${sel.scopeLabel} — your team's logs this week`
    : `${sel.scopeLabel} — your workstream leads' logs this week`;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/leadership-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: sel.tier,
          cycle_id: sel.cycleId,
          pod_id: sel.podId,
          lab_id: sel.labId,
          clarity,
          alignment,
          is_blocked: blocked,
          blocker_context: blocked ? blockerContext : null,
          accomplished: accomplished || null,
          exploring: exploring || null,
          next_focus: nextFocus || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setError(d?.error ?? "That didn't save. Give it another try.");
        return;
      }
      setSavedKeys((prev) => new Set(prev).add(scopeKey(sel)));
      setAccomplished("");
      setExploring("");
      setNextFocus("");
      setBlocked(false);
      setBlockerContext("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-card border border-ink/10 bg-white p-5 shadow-card">
      {scopes.length > 1 && (
        <div className="mb-4">
          <label htmlFor="ll-scope" className="lbl mb-1 block">
            Log for
          </label>
          <select
            id="ll-scope"
            value={selKey}
            onChange={(e) => setSelKey(e.target.value)}
            className="w-full rounded-card border border-ink/15 px-3 py-2 text-base text-ink focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
          >
            {scopes.map((s) => (
              <option key={scopeKey(s)} value={scopeKey(s)}>
                {s.scopeLabel} ({s.tier === "lab_lead" ? "Lab lead" : "Workstream lead"})
                {(s.submittedThisWeek || savedKeys.has(scopeKey(s))) ? " ✓" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Read-only context: the tier below's logs this week. */}
      <div className="mb-5 rounded-card border border-ink/10 bg-paper p-4">
        <p className="lbl mb-2">{contextHeading}</p>
        {sel.context.length === 0 ? (
          <p className="text-sm text-meta">
            No logs from the tier below yet this week.
          </p>
        ) : (
          <ul className="space-y-3">
            {sel.context.map((e, i) => (
              <li key={i} className="text-sm">
                <p className="font-semibold text-ink">
                  {e.participantName}
                  {e.is_blocked && (
                    <span className="ml-2 rounded-sm bg-red/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-red">
                      blocked
                    </span>
                  )}
                </p>
                {(e.accomplished || e.work_summary) && (
                  <p className="text-charcoal">{e.work_summary || e.accomplished}</p>
                )}
                {e.work_progress && (
                  <p className="text-meta">Progress: {e.work_progress}</p>
                )}
                {(e.work_blockers || e.blocker_context) && (
                  <p className="text-meta">
                    Blockers: {e.work_blockers || e.blocker_context}
                  </p>
                )}
                {e.next_focus && <p className="text-meta">Next: {e.next_focus}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {alreadyDone ? (
        <p className="text-sm font-semibold text-teal-deep">
          Logged this week ✓
        </p>
      ) : (
        <div className="space-y-4">
          <ScaleRow
            label={isWorkstream ? "Clarity on the team's direction" : "Clarity on the lab's direction"}
            low="Foggy"
            high="Crystal"
            value={clarity}
            onChange={setClarity}
          />
          <ScaleRow
            label={isWorkstream ? "The team's alignment" : "The lab's alignment"}
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
            Something&rsquo;s blocking the team
          </label>
          {blocked && (
            <textarea
              value={blockerContext}
              onChange={(e) => setBlockerContext(e.target.value)}
              placeholder="What does the team need?"
              aria-label="What does the team need?"
              rows={2}
              maxLength={2000}
              className="w-full rounded-card border border-ink/15 p-3 text-base"
            />
          )}
          {(
            [
              ["What did the team accomplish this week?", accomplished, setAccomplished],
              ["What are you working through as a lead?", exploring, setExploring],
              ["Your focus / asks for next week", nextFocus, setNextFocus],
            ] as const
          ).map(([label, value, setter], i) => (
            <div key={label}>
              <label htmlFor={`lead-${i}`} className="text-sm font-semibold text-ink">
                {label}
              </label>
              <textarea
                id={`lead-${i}`}
                value={value}
                onChange={(e) => setter(e.target.value)}
                rows={2}
                maxLength={2000}
                className="mt-1 w-full rounded-card border border-ink/15 p-3 text-base"
              />
            </div>
          ))}
          {error && (
            <p className="text-sm text-red" role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="btn btn-teal"
          >
            {busy ? "Saving…" : "Save leadership log"}
          </button>
        </div>
      )}
    </div>
  );
}
