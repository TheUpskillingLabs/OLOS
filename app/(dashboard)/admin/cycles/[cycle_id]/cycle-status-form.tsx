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
      <span className="text-sm text-zinc-500">
        Current status:{" "}
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            currentStatus === "active"
              ? "bg-green-100 text-green-800"
              : currentStatus === "closed"
                ? "bg-zinc-100 text-zinc-600"
                : "bg-yellow-100 text-yellow-800"
          }`}
        >
          {currentStatus}
        </span>
      </span>

      {nextStatus ? (
        <button
          onClick={advance}
          disabled={loading}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
            nextStatus === "closed"
              ? "bg-red-600 text-white hover:bg-red-700"
              : "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          }`}
        >
          {loading ? "Updating…" : BUTTON_LABELS[nextStatus]}
        </button>
      ) : (
        <span className="text-sm text-zinc-400">
          Cycle is closed — no further transitions.
        </span>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
