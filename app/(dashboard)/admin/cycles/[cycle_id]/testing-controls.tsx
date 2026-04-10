"use client";

import { useState } from "react";

const PHASE_SEQUENCE = [
  "problem_statement",
  "voting",
  "pod_registration",
  "solution_proposal",
  "solution_voting",
  "project_registration",
] as const;

const PHASE_LABELS: Record<string, string> = {
  problem_statement: "Problem Statements",
  voting: "Voting",
  pod_registration: "Pod Registration",
  solution_proposal: "Solution Proposals",
  solution_voting: "Solution Voting",
  project_registration: "Project Registration",
};

type PhaseStatus = "completed" | "active" | "upcoming";

function getPhaseStatuses(
  config: Record<string, unknown>
): Record<string, PhaseStatus> {
  const now = new Date();
  const statuses: Record<string, PhaseStatus> = {};

  for (const phase of PHASE_SEQUENCE) {
    const openTime = config[`${phase}_open`] as string | null;
    const closeTime = config[`${phase}_close`] as string | null;

    if (openTime && closeTime) {
      if (now >= new Date(openTime) && now <= new Date(closeTime)) {
        statuses[phase] = "active";
      } else if (now > new Date(closeTime)) {
        statuses[phase] = "completed";
      } else {
        statuses[phase] = "upcoming";
      }
    } else {
      statuses[phase] = "upcoming";
    }
  }

  return statuses;
}

export default function TestingControls({
  cycleId,
  initialConfig,
}: {
  cycleId: number;
  initialConfig: Record<string, unknown>;
}) {
  const [config, setConfig] = useState(initialConfig);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const statuses = getPhaseStatuses(config);

  const activePhase = PHASE_SEQUENCE.find((p) => statuses[p] === "active");
  const allCompleted = PHASE_SEQUENCE.every((p) => statuses[p] === "completed");

  // Find what the next phase would be
  let nextPhaseLabel: string | null = null;
  if (activePhase) {
    const idx = PHASE_SEQUENCE.indexOf(activePhase);
    if (idx < PHASE_SEQUENCE.length - 1) {
      nextPhaseLabel = PHASE_LABELS[PHASE_SEQUENCE[idx + 1]];
    }
  } else if (!allCompleted) {
    const firstUpcoming = PHASE_SEQUENCE.find((p) => statuses[p] === "upcoming");
    if (firstUpcoming) {
      nextPhaseLabel = PHASE_LABELS[firstUpcoming];
    }
  }

  async function advancePhase() {
    setLoading(true);
    setMessage(null);

    const res = await fetch(`/api/cycles/${cycleId}/advance-phase`, {
      method: "POST",
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      setMessage(data.message);
      // Refresh config from server
      const configRes = await fetch(`/api/cycles/${cycleId}/config`);
      if (configRes.ok) {
        const configData = await configRes.json();
        setConfig(configData);
      }
    } else {
      setMessage(data.error ?? "Failed to advance phase");
    }
  }

  return (
    <div className="rounded-md border border-purple-500/30 bg-purple-500/5 p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="rounded bg-purple-500/20 px-2 py-0.5 text-xs font-medium text-purple-300">
          Testing
        </span>
        <h3 className="text-sm font-semibold text-white">
          Phase Advancement Controls
        </h3>
      </div>

      {/* Phase progress indicator */}
      <div className="mb-5 flex items-center gap-1">
        {PHASE_SEQUENCE.map((phase, i) => (
          <div key={phase} className="flex items-center gap-1">
            <div className="group relative">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium ${
                  statuses[phase] === "completed"
                    ? "bg-teal/20 text-aqua"
                    : statuses[phase] === "active"
                      ? "bg-purple-500/30 text-purple-200 ring-2 ring-purple-400"
                      : "bg-white/5 text-cloud/30"
                }`}
              >
                {statuses[phase] === "completed" ? "\u2713" : i + 1}
              </div>
              <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-shadow px-2 py-1 text-xs text-cloud opacity-0 transition-opacity group-hover:opacity-100">
                {PHASE_LABELS[phase]}
              </div>
            </div>
            {i < PHASE_SEQUENCE.length - 1 && (
              <div
                className={`h-0.5 w-4 ${
                  statuses[phase] === "completed"
                    ? "bg-teal/40"
                    : "bg-white/10"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Status + button */}
      <div className="flex items-center gap-4">
        <div className="flex-1 text-sm text-cloud/60">
          {allCompleted
            ? "All 6 phases completed."
            : activePhase
              ? `Currently open: ${PHASE_LABELS[activePhase]}`
              : "No phase currently active."}
        </div>
        <button
          onClick={advancePhase}
          disabled={loading || allCompleted}
          className="rounded-md bg-purple-500/20 px-4 py-2 text-sm font-medium text-purple-200 transition-colors hover:bg-purple-500/30 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading
            ? "Advancing..."
            : allCompleted
              ? "Cycle Complete"
              : activePhase && !nextPhaseLabel
                ? "Close Final Phase"
                : nextPhaseLabel
                  ? `Advance to ${nextPhaseLabel}`
                  : "Start First Phase"}
        </button>
      </div>

      {message && (
        <p className="mt-3 text-sm text-purple-300">{message}</p>
      )}
    </div>
  );
}
