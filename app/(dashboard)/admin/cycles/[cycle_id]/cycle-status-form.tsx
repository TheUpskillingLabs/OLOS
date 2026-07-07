"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cycleStatusLabel } from "@/lib/cycles/status";

// Valid forward transitions — must mirror VALID_TRANSITIONS in
// app/api/cycles/[cycle_id]/status/route.ts. `upcoming` is the state a cycle
// sits in while it takes registrations before it goes `active`.
const VALID_NEXT: Record<string, string[]> = {
  draft: ["upcoming", "active"],
  upcoming: ["active"],
  active: ["closing", "closed"],
  closing: ["closed"],
};

const BUTTON_LABELS: Record<string, string> = {
  upcoming: "Mark Upcoming",
  active: "Activate Cycle",
  closing: "Begin Closing",
  closed: "Close Cycle",
};

export default function CycleStatusForm({
  cycleId,
  currentStatus,
}: {
  cycleId: number;
  currentStatus: string;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const nextStatuses = VALID_NEXT[currentStatus] ?? [];

  async function advance(nextStatus: string) {
    if (
      !confirm(
        `Change cycle status to "${nextStatus}"? ${nextStatus === "closed" ? "This cannot be undone." : ""}`
      )
    )
      return;

    setLoading(nextStatus);
    setError(null);

    const res = await fetch(`/api/cycles/${cycleId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });

    setLoading(null);
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to update status");
    }
  }

  const statusClass =
    currentStatus === "active"
      ? "active"
      : currentStatus === "closed" || currentStatus === "archived"
        ? ""
        : "soon";

  return (
    <div className="flex flex-wrap items-center gap-4">
      <span className="text-sm text-charcoal">
        Current status: <span className={`status ${statusClass}`}>{cycleStatusLabel(currentStatus)}</span>
      </span>

      {nextStatuses.length > 0 ? (
        nextStatuses.map((s) => (
          <button
            key={s}
            onClick={() => advance(s)}
            disabled={loading !== null}
            className={`btn px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
              s === "closed" ? "btn-red" : "btn-teal"
            }`}
          >
            {loading === s ? "Updating…" : BUTTON_LABELS[s]}
          </button>
        ))
      ) : (
        <span className="text-sm text-meta">
          No further transitions from this status.
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
