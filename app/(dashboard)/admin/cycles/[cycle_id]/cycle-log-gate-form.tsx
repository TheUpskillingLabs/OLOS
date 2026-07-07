"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Admin control for `cycle_config.log_gate_paused` / `log_due_at`
 * (docs/ORG_CYCLES.md §4) — previously reachable only via direct SQL
 * (PRD-admin-org-separation.md M-9). Ships on both cycle modes: the Friday
 * gate applies to org cycles too (dogfooding, not an exemption).
 */

function formatArmedAt(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function CycleLogGateForm({
  cycleId,
  logDueAt,
  gatePaused,
}: {
  cycleId: number;
  logDueAt: string | null;
  gatePaused: boolean;
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
      body: JSON.stringify({ log_gate_paused: !gatePaused }),
    });

    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to update gate");
    }
  }

  const readout = gatePaused
    ? "Paused — the Friday cron skips this cycle."
    : logDueAt
      ? `Gate armed ${formatArmedAt(logDueAt)} — members must log to unlock.`
      : "Not armed.";

  return (
    <div className="rounded-card border border-ink/10 bg-white p-4 shadow-card">
      <h3 className="mb-3 text-sm font-semibold tracking-tight text-ink">
        Learning Log gate
      </h3>
      <p className="mb-4 text-sm text-charcoal">{readout}</p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className="btn btn-teal px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Saving…" : gatePaused ? "Resume gate" : "Pause gate"}
        </button>
        {error && (
          <span role="alert" className="text-sm text-red">
            {error}
          </span>
        )}
      </div>
      <p className="mt-3 text-xs text-meta">
        Paused cycles are skipped by the Friday cron and any stale deadline
        is cleared — docs/ORG_CYCLES.md.
      </p>
    </div>
  );
}
