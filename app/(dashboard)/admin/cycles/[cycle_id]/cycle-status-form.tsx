"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Mirror the API's cycle lifecycle (SECTOR_MODEL.md §4):
// draft → upcoming → active → closing → archived ('closed' = legacy terminal).
const NEXT_STATUSES: Record<string, string[]> = {
  draft: ["upcoming", "active"],
  upcoming: ["active"],
  active: ["closing", "closed"],
  closing: ["archived"],
};

const BUTTON_LABELS: Record<string, string> = {
  upcoming: "Open for recruiting",
  active: "Activate",
  closing: "Begin closing",
  // Org cycles really do archive into the org sector; participant cycles
  // don't, so they get the plainer label (P-9) — see the `mode` override
  // below, applied only for the terminal `archived` transition.
  archived: "Archive to sector",
  closed: "Close (legacy)",
};

const IRREVERSIBLE = new Set(["closed", "archived"]);

export default function CycleStatusForm({
  cycleId,
  currentStatus,
  mode,
}: {
  cycleId: number;
  currentStatus: string;
  mode?: string | null;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const nextOptions = NEXT_STATUSES[currentStatus] ?? [];
  const buttonLabel = (next: string) =>
    next === "archived" && mode !== "org" ? "Archive cycle" : BUTTON_LABELS[next] ?? next;

  async function advance(next: string) {
    if (
      !confirm(
        `Advance cycle status to "${next}"?${IRREVERSIBLE.has(next) ? " This cannot be undone." : ""}`
      )
    )
      return;

    setLoading(next);
    setError(null);

    const res = await fetch(`/api/cycles/${cycleId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });

    setLoading(null);
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
              : currentStatus === "closed" || currentStatus === "archived"
                ? ""
                : "soon"
          }`}
        >
          {currentStatus}
        </span>
      </span>

      {nextOptions.length > 0 ? (
        nextOptions.map((next) => (
          <button
            key={next}
            onClick={() => advance(next)}
            disabled={loading !== null}
            className={`btn px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
              IRREVERSIBLE.has(next) ? "btn-red" : "btn-teal"
            }`}
          >
            {loading === next ? "Updating…" : buttonLabel(next)}
          </button>
        ))
      ) : (
        <span className="text-sm text-meta">
          Cycle is {currentStatus} — no further transitions.
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
