"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { StatCard } from "@/app/components/ui";

type PulseCheck = {
  scheduled_date: string;
  completed_at: string | null;
  survey_responses: Record<string, unknown> | null;
  nomination_count?: number;
};

type MemberPulseData = {
  participant_id: number;
  name: string;
  checks: PulseCheck[];
};

export default function PulseCheckDashboard({
  members,
}: {
  members: MemberPulseData[];
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Summary stats
  const totalChecks = members.reduce((sum, m) => sum + m.checks.length, 0);
  const completedChecks = members.reduce(
    (sum, m) => sum + m.checks.filter((c) => c.completed_at).length,
    0
  );
  const completionRate =
    totalChecks > 0 ? Math.round((completedChecks / totalChecks) * 100) : 0;

  const energyValues = members.flatMap((m) =>
    m.checks
      .filter((c) => c.survey_responses?.energy_level != null)
      .map((c) => Number(c.survey_responses!.energy_level))
  );
  const avgEnergy =
    energyValues.length > 0
      ? (energyValues.reduce((a, b) => a + b, 0) / energyValues.length).toFixed(
          1
        )
      : "—";

  return (
    <div>
      <hr className="mb-8 border-whisper" />
      <h2 className="mb-4 text-lg font-semibold tracking-tight text-white">
        Pulse checks
      </h2>

      {/* Summary stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Completion rate"
          value={`${completionRate}%`}
          sublabel={`${completedChecks} / ${totalChecks}`}
        />
        <StatCard
          label="Avg energy"
          value={<span className="text-aqua">{avgEnergy}</span>}
          sublabel="out of 5"
        />
        <StatCard label="Members" value={members.length} />
      </div>

      {/* Per-member table */}
      <div className="overflow-hidden rounded-md border border-whisper">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.04]">
            <tr>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-cloud/60">
                Name
              </th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-cloud/60">
                Completed
              </th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-cloud/60">
                Last check
              </th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-cloud/60">
                Avg energy
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-cloud/60" />
            </tr>
          </thead>
          <tbody className="divide-y divide-whisper">
            {members.map((m) => {
              const completed = m.checks.filter((c) => c.completed_at).length;
              const lastCompleted = m.checks.find((c) => c.completed_at);
              const memberEnergy = m.checks
                .filter((c) => c.survey_responses?.energy_level != null)
                .map((c) => Number(c.survey_responses!.energy_level));
              const memberAvgEnergy =
                memberEnergy.length > 0
                  ? (
                      memberEnergy.reduce((a, b) => a + b, 0) /
                      memberEnergy.length
                    ).toFixed(1)
                  : "—";
              const isExpanded = expandedId === m.participant_id;

              return (
                <tr key={m.participant_id} className="group">
                  <td colSpan={5} className="p-0">
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() =>
                        setExpandedId(isExpanded ? null : m.participant_id)
                      }
                      className="flex w-full cursor-pointer items-center px-4 py-3 text-left transition-colors duration-150 hover:bg-white/[0.02] focus-visible:outline-none focus-visible:bg-white/[0.04]"
                    >
                      <span className="flex-1 font-medium text-cloud">
                        {m.name}
                      </span>
                      <span className="w-24 text-cloud/60 tabular-nums">
                        {completed} / {m.checks.length}
                      </span>
                      <span className="w-32 text-cloud/60 tabular-nums">
                        {lastCompleted
                          ? new Date(
                              lastCompleted.completed_at!
                            ).toLocaleDateString()
                          : "—"}
                      </span>
                      <span className="w-24 text-cloud/60 tabular-nums">
                        {memberAvgEnergy}
                      </span>
                      <span className="w-8 text-right text-cloud/60">
                        <ChevronDown
                          className={`inline-block h-4 w-4 transition-transform duration-150 ease-spring ${isExpanded ? "rotate-180" : ""}`}
                          aria-hidden
                        />
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="border-t border-whisper bg-white/[0.01] px-4 py-3">
                        {m.checks.filter((c) => c.completed_at).length === 0 ? (
                          <p className="text-sm text-cloud/60">
                            No completed pulse checks yet.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {m.checks
                              .filter((c) => c.completed_at)
                              .map((c, i) => {
                                const r = c.survey_responses;
                                return (
                                  <div
                                    key={i}
                                    className="rounded-md border border-whisper bg-white/[0.02] p-3"
                                  >
                                    <div className="mb-2 flex items-center justify-between">
                                      <span className="text-xs font-medium tracking-tight text-aqua tabular-nums">
                                        {new Date(
                                          c.scheduled_date
                                        ).toLocaleDateString()}
                                      </span>
                                      {r?.energy_level != null && (
                                        <span className="rounded-full bg-teal/15 px-2 py-0.5 text-xs font-medium text-aqua tabular-nums">
                                          Energy: {String(r.energy_level)}/5
                                        </span>
                                      )}
                                    </div>
                                    {r?.accomplishment != null && (
                                      <div className="mb-1">
                                        <span className="text-xs font-medium text-cloud/60">
                                          Accomplishment:{" "}
                                        </span>
                                        <span className="text-sm text-white">
                                          {String(r.accomplishment)}
                                        </span>
                                      </div>
                                    )}
                                    {r?.highlight != null && (
                                      <div className="mb-1">
                                        <span className="text-xs font-medium text-cloud/60">
                                          Highlight:{" "}
                                        </span>
                                        <span className="text-sm text-white">
                                          {String(r.highlight)}
                                        </span>
                                      </div>
                                    )}
                                    {r?.challenge != null && (
                                      <div className="mb-1">
                                        <span className="text-xs font-medium text-cloud/60">
                                          Challenge:{" "}
                                        </span>
                                        <span className="text-sm text-white">
                                          {String(r.challenge)}
                                        </span>
                                      </div>
                                    )}
                                    {r?.blockers != null && (
                                      <div className="mb-1">
                                        <span className="text-xs font-medium text-cloud/60">
                                          Blockers:{" "}
                                        </span>
                                        <span className="text-sm text-white">
                                          {String(r.blockers)}
                                        </span>
                                      </div>
                                    )}
                                    {r?.tailwinds != null && (
                                      <div className="mb-1">
                                        <span className="text-xs font-medium text-cloud/60">
                                          Tailwinds:{" "}
                                        </span>
                                        <span className="text-sm text-white">
                                          {String(r.tailwinds)}
                                        </span>
                                      </div>
                                    )}
                                    {r?.mitigation_strategy != null && (
                                      <div className="mb-1">
                                        <span className="text-xs font-medium text-cloud/60">
                                          Mitigation:{" "}
                                        </span>
                                        <span className="text-sm text-white">
                                          {String(r.mitigation_strategy)}
                                        </span>
                                      </div>
                                    )}
                                    {c.nomination_count != null && c.nomination_count > 0 && (
                                      <div>
                                        <span className="text-xs font-medium text-cloud/60">
                                          Nominations:{" "}
                                        </span>
                                        <span className="text-sm text-aqua">
                                          {c.nomination_count}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
