"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const NEXT_STATUS: Record<string, string | null> = {
  draft: "active",
  active: "closed",
  closed: null,
};

const BUTTON_LABELS: Record<string, string> = {
  active: "Activate Cycle",
  closed: "Close Cycle",
};

export default function CycleStatusForm({
  cycleId,
  currentStatus,
}: {
  cycleId: number;
  currentStatus: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const nextStatus = NEXT_STATUS[currentStatus] ?? null;

  async function advance() {
    if (!nextStatus) return;
    if (
      !confirm(
        `Advance cycle status to "${nextStatus}"? ${nextStatus === "closed" ? "This cannot be undone." : ""}`
      )
    )
      return;

    setLoading(true);
    setError(null);

    const res = await fetch(`/api/cycles/${cycleId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });

    setLoading(false);
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to update status");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <span className="text-sm text-cloud/60">
        Current status:{" "}
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            currentStatus === "active"
              ? "bg-teal/20 text-aqua"
              : currentStatus === "closed"
                ? "bg-white/10 text-cloud/60"
                : "bg-yellow-500/20 text-yellow-300"
          }`}
        >
          {currentStatus}
        </span>
      </span>

      {nextStatus ? (
        <button
          onClick={advance}
          disabled={loading}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
            nextStatus === "closed"
              ? "bg-red text-white hover:bg-crimson"
              : "bg-teal text-white hover:bg-teal/80"
          }`}
        >
          {loading ? "Updating…" : BUTTON_LABELS[nextStatus]}
        </button>
      ) : (
        <span className="text-sm text-cloud/40">
          Cycle is closed — no further transitions.
        </span>
      )}

      {error && <p className="text-sm text-red">{error}</p>}
    </div>
  );
}
