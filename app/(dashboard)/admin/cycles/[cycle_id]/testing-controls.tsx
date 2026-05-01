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
    <div className="rounded-md border border-yellow-500/30 bg-yellow-500/[0.06] p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-yellow-500/20 px-2.5 py-0.5 text-xs font-medium text-yellow-300">
          Testing
        </span>
        <h3 className="text-sm font-semibold tracking-tight text-white">
          Phase advancement controls
        </h3>
      </div>

      {/* Phase progress indicator */}
      <div className="mb-5 flex items-center gap-1">
        {PHASE_SEQUENCE.map((phase, i) => (
          <div key={phase} className="flex items-center gap-1">
            <div className="group relative">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${
                  statuses[phase] === "completed"
                    ? "bg-teal/20 text-aqua"
                    : statuses[phase] === "active"
                      ? "bg-yellow-500/30 text-yellow-200 ring-2 ring-yellow-400"
                      : "bg-white/[0.06] text-cloud/40"
                }`}
              >
                {statuses[phase] === "completed" ? "\u2713" : i + 1}
              </div>
              <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-whisper bg-ink px-2 py-1 text-xs text-cloud opacity-0 shadow-2xl transition-opacity duration-150 group-hover:opacity-100">
                {PHASE_LABELS[phase]}
              </div>
            </div>
            {i < PHASE_SEQUENCE.length - 1 && (
              <div
                className={`h-0.5 w-4 ${
                  statuses[phase] === "completed"
                    ? "bg-teal/40"
                    : "bg-white/[0.06]"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Status + button */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 text-sm text-cloud/80">
          {allCompleted
            ? "All 6 phases completed."
            : activePhase
              ? `Currently open: ${PHASE_LABELS[activePhase]}`
              : "No phase currently active."}
        </div>
        <button
          onClick={advancePhase}
          disabled={loading || allCompleted}
          className="rounded-md bg-yellow-500/20 px-4 py-2 text-sm font-semibold tracking-tight text-yellow-200 transition-all duration-150 ease-spring hover:bg-yellow-500/30 hover:text-white active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
        >
          {loading
            ? "Advancing..."
            : allCompleted
              ? "Cycle complete"
              : activePhase && !nextPhaseLabel
                ? "Close final phase"
                : nextPhaseLabel
                  ? `Advance to ${nextPhaseLabel}`
                  : "Start first phase"}
        </button>
      </div>

      {message && (
        <p className="mt-3 text-sm text-yellow-200">{message}</p>
      )}
    </div>
  );
}
