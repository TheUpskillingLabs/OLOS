"use client";

import { useState } from "react";

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
      <h2 className="mb-4 text-lg font-semibold text-white">
        Pulse Checks
      </h2>

      {/* Summary stats */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-md border border-whisper bg-white/[0.02] p-4">
          <p className="text-sm text-cloud/60">Completion Rate</p>
          <p className="text-2xl font-bold text-white">{completionRate}%</p>
          <p className="text-xs text-cloud/40">
            {completedChecks} / {totalChecks}
          </p>
        </div>
        <div className="rounded-md border border-whisper bg-white/[0.02] p-4">
          <p className="text-sm text-cloud/60">Avg Energy</p>
          <p className="text-2xl font-bold text-aqua">{avgEnergy}</p>
          <p className="text-xs text-cloud/40">out of 5</p>
        </div>
        <div className="rounded-md border border-whisper bg-white/[0.02] p-4">
          <p className="text-sm text-cloud/60">Members</p>
          <p className="text-2xl font-bold text-white">{members.length}</p>
        </div>
      </div>

      {/* Per-member table */}
      <div className="overflow-hidden rounded-md border border-whisper">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.04]">
            <tr>
              <th className="px-4 py-3 font-medium text-cloud/60">Name</th>
              <th className="px-4 py-3 font-medium text-cloud/60">
                Completed
              </th>
              <th className="px-4 py-3 font-medium text-cloud/60">
                Last Check
              </th>
              <th className="px-4 py-3 font-medium text-cloud/60">
                Avg Energy
              </th>
              <th className="px-4 py-3 text-right font-medium text-cloud/60" />
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
                    <div
                      className="flex cursor-pointer items-center px-4 py-3 hover:bg-white/[0.02]"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : m.participant_id)
                      }
                    >
                      <span className="flex-1 font-medium text-white">
                        {m.name}
                      </span>
                      <span className="w-24 text-cloud/60">
                        {completed} / {m.checks.length}
                      </span>
                      <span className="w-32 text-cloud/60">
                        {lastCompleted
                          ? new Date(
                              lastCompleted.completed_at!
                            ).toLocaleDateString()
                          : "—"}
                      </span>
                      <span className="w-24 text-cloud/60">
                        {memberAvgEnergy}
                      </span>
                      <span className="w-8 text-right text-cloud/40">
                        {isExpanded ? "−" : "+"}
                      </span>
                    </div>
                    {isExpanded && (
                      <div className="border-t border-whisper/50 bg-white/[0.01] px-4 py-3">
                        {m.checks.filter((c) => c.completed_at).length === 0 ? (
                          <p className="text-sm text-cloud/40">
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
                                    className="rounded border border-whisper/50 bg-white/[0.01] p-3"
                                  >
                                    <div className="mb-2 flex items-center justify-between">
                                      <span className="text-xs font-medium text-aqua">
                                        {new Date(
                                          c.scheduled_date
                                        ).toLocaleDateString()}
                                      </span>
                                      {r?.energy_level != null && (
                                        <span className="rounded-full bg-teal/15 px-2 py-0.5 text-xs text-aqua">
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
