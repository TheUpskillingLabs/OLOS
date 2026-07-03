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
      <span className="text-sm text-charcoal">
        Current status:{" "}
        <span
          className={`status ${
            currentStatus === "active"
              ? "active"
              : currentStatus === "closed"
                ? ""
                : "soon"
          }`}
        >
          {currentStatus}
        </span>
      </span>

      {nextStatus ? (
        <button
          onClick={advance}
          disabled={loading}
          className={`btn px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
            nextStatus === "closed"
              ? "btn-red"
              : "btn-teal"
          }`}
        >
          {loading ? "Updating…" : BUTTON_LABELS[nextStatus]}
        </button>
      ) : (
        <span className="text-sm text-meta">
          Cycle is closed — no further transitions.
        </span>
      )}

      {error && (
        <p role="alert" className="text-sm text-red">
          {error}
        </p>
      )}
    </div>
  );
}
