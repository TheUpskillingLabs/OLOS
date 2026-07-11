"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { StatCard } from "@/app/components/ui";
import { formatDate } from "@/lib/format/date";

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
      <hr className="mb-8 border-ink/10" />
      <h2 className="t-h3 mb-4 text-ink">
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
          value={<span className="text-teal-deep">{avgEnergy}</span>}
          sublabel="out of 5"
        />
        <StatCard label="Members" value={members.length} />
      </div>

      {/* Per-member table */}
      <div className="overflow-x-auto rounded-card border border-ink/10 bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink/[0.03]">
            <tr>
              <th className="lbl px-4 py-3">
                Name
              </th>
              <th className="lbl px-4 py-3">
                Completed
              </th>
              <th className="lbl px-4 py-3">
                Last check
              </th>
              <th className="lbl px-4 py-3">
                Avg energy
              </th>
              <th className="lbl px-4 py-3 text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
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
                      className="flex w-full cursor-pointer items-center px-4 py-3 text-left transition-colors duration-150 hover:bg-ink/[0.02] focus-visible:bg-ink/[0.04]"
                    >
                      <span className="flex-1 font-medium text-charcoal">
                        {m.name}
                      </span>
                      <span className="w-24 text-meta tabular-nums">
                        {completed} / {m.checks.length}
                      </span>
                      <span className="w-32 text-meta tabular-nums">
                        {lastCompleted
                          ? formatDate(lastCompleted.completed_at!)
                          : "—"}
                      </span>
                      <span className="w-24 text-meta tabular-nums">
                        {memberAvgEnergy}
                      </span>
                      <span className="w-8 text-right text-meta">
                        <ChevronDown
                          className={`inline-block h-4 w-4 transition-transform duration-150 ease-spring ${isExpanded ? "rotate-180" : ""}`}
                          aria-hidden
                        />
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="border-t border-ink/10 bg-ink/[0.02] px-4 py-3">
                        {m.checks.filter((c) => c.completed_at).length === 0 ? (
                          <p className="text-sm text-meta">
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
                                    className="rounded-card border border-ink/10 bg-white p-3"
                                  >
                                    <div className="mb-2 flex items-center justify-between">
                                      <span className="text-xs font-medium tracking-tight text-teal-deep tabular-nums">
                                        {formatDate(c.scheduled_date)}
                                      </span>
                                      {r?.energy_level != null && (
                                        <span className="rounded-sm bg-teal/10 px-2 py-0.5 text-xs font-medium text-teal-deep tabular-nums">
                                          Energy: {String(r.energy_level)}/5
                                        </span>
                                      )}
                                    </div>
                                    {r?.accomplishment != null && (
                                      <div className="mb-1">
                                        <span className="text-xs font-medium text-meta">
                                          Accomplishment:{" "}
                                        </span>
                                        <span className="text-sm text-charcoal">
                                          {String(r.accomplishment)}
                                        </span>
                                      </div>
                                    )}
                                    {r?.highlight != null && (
                                      <div className="mb-1">
                                        <span className="text-xs font-medium text-meta">
                                          Highlight:{" "}
                                        </span>
                                        <span className="text-sm text-charcoal">
                                          {String(r.highlight)}
                                        </span>
                                      </div>
                                    )}
                                    {r?.challenge != null && (
                                      <div className="mb-1">
                                        <span className="text-xs font-medium text-meta">
                                          Challenge:{" "}
                                        </span>
                                        <span className="text-sm text-charcoal">
                                          {String(r.challenge)}
                                        </span>
                                      </div>
                                    )}
                                    {r?.blockers != null && (
                                      <div className="mb-1">
                                        <span className="text-xs font-medium text-meta">
                                          Blockers:{" "}
                                        </span>
                                        <span className="text-sm text-charcoal">
                                          {String(r.blockers)}
                                        </span>
                                      </div>
                                    )}
                                    {r?.tailwinds != null && (
                                      <div className="mb-1">
                                        <span className="text-xs font-medium text-meta">
                                          Tailwinds:{" "}
                                        </span>
                                        <span className="text-sm text-charcoal">
                                          {String(r.tailwinds)}
                                        </span>
                                      </div>
                                    )}
                                    {r?.mitigation_strategy != null && (
                                      <div className="mb-1">
                                        <span className="text-xs font-medium text-meta">
                                          Mitigation:{" "}
                                        </span>
                                        <span className="text-sm text-charcoal">
                                          {String(r.mitigation_strategy)}
                                        </span>
                                      </div>
                                    )}
                                    {c.nomination_count != null && c.nomination_count > 0 && (
                                      <div>
                                        <span className="text-xs font-medium text-meta">
                                          Nominations:{" "}
                                        </span>
                                        <span className="text-sm text-teal-deep">
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
