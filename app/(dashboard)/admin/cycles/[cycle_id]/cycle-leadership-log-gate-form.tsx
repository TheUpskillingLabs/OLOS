"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Admin pause/resume for the org Leadership Log cascade
 * (`cycle_config.leadership_log_gate_paused` / `leadership_log_due_at`,
 * migration 00069, docs/ORG_CYCLES.md §4a). Org cycles only — the leads'
 * weekly window is armed Wednesday; pausing has the Wednesday cron skip it and
 * clears any stale stamp. Non-blocking, so this only affects the due prompt +
 * reminder, never a lockout. Mirrors CycleLogGateForm.
 */

function formatArmedAt(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function CycleLeadershipLogGateForm({
  cycleId,
  dueAt,
  paused,
}: {
  cycleId: number;
  dueAt: string | null;
  paused: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/cycles/${cycleId}/config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadership_log_gate_paused: !paused }),
    });
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to update");
    }
  }

  const readout = paused
    ? "Paused — the Wednesday cron skips this cascade."
    : dueAt
      ? `Cascade armed ${formatArmedAt(dueAt)} — leads' weekly logs are open.`
      : "Not armed.";

  return (
    <div className="rounded-card border border-ink/10 bg-white p-4 shadow-card">
      <h3 className="mb-3 text-sm font-semibold tracking-tight text-ink">
        Leadership Log cascade
      </h3>
      <p className="mb-4 text-sm text-charcoal">{readout}</p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className="btn btn-teal px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Saving…" : paused ? "Resume cascade" : "Pause cascade"}
        </button>
        {error && (
          <span role="alert" className="text-sm text-red">
            {error}
          </span>
        )}
      </div>
      <p className="mt-3 text-xs text-meta">
        Workstream leads log Thursday, lab leads Friday — non-blocking.
        docs/ORG_CYCLES.md §4a.
      </p>
    </div>
  );
}
