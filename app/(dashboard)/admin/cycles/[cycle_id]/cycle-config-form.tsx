"use client";

import { useState } from "react";

type Config = {
  cycle_id: number;
  submitter_votes: number;
  non_submitter_votes: number;
  vote_threshold: number;
  max_pods: number;
  pod_min: number;
  project_submitter_votes: number;
  project_vote_threshold: number;
  max_projects: number;
  project_min: number;
  project_max: number;
  phase_2_start: string | null;
  phase_3_start: string | null;
  problem_statement_open: string | null;
  problem_statement_close: string | null;
  voting_open: string | null;
  voting_close: string | null;
  pod_registration_open: string | null;
  pod_registration_close: string | null;
  solution_proposal_open: string | null;
  solution_proposal_close: string | null;
  solution_voting_open: string | null;
  solution_voting_close: string | null;
  project_registration_open: string | null;
  project_registration_close: string | null;
};

function toLocal(iso: string | null): string {
  if (!iso) return "";
  return iso.replace(" ", "T").slice(0, 16);
}

function fromLocal(val: string): string | null {
  if (!val) return null;
  return `${val}:00`;
}

// ─── Schedule form ────────────────────────────────────────────────────────────

const PHASES = [
  {
    label: "Problem Statement",
    open: "problem_statement_open",
    close: "problem_statement_close",
  },
  { label: "Voting", open: "voting_open", close: "voting_close" },
  {
    label: "Pod Registration",
    open: "pod_registration_open",
    close: "pod_registration_close",
  },
  {
    label: "Solution Proposal",
    open: "solution_proposal_open",
    close: "solution_proposal_close",
  },
  {
    label: "Solution Voting",
    open: "solution_voting_open",
    close: "solution_voting_close",
  },
  {
    label: "Project Registration",
    open: "project_registration_open",
    close: "project_registration_close",
  },
] as const;

export function CycleScheduleForm({
  cycleId,
  config,
}: {
  cycleId: number;
  config: Config;
}) {
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaved(false);
    setError(null);
    const fd = new FormData(e.currentTarget);

    const body: Record<string, string | null> = {};
    body.phase_2_start = fromLocal(fd.get("phase_2_start") as string);
    body.phase_3_start = fromLocal(fd.get("phase_3_start") as string);
    for (const phase of PHASES) {
      body[phase.open] = fromLocal(fd.get(phase.open) as string);
      body[phase.close] = fromLocal(fd.get(phase.close) as string);
    }

    setLoading(true);
    const res = await fetch(`/api/cycles/${cycleId}/config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);

    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to save schedule");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Cycle phase milestones */}
      <div className="mb-6 rounded-md border border-whisper bg-white/[0.02] p-4">
        <h3 className="mb-3 text-sm font-semibold text-cloud">
          Cycle Phases
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="phase_2_start"
              className="mb-1 block text-sm text-cloud/60"
            >
              Meet The Pods (Phase 1 &rarr; 2)
            </label>
            <input
              id="phase_2_start"
              type="datetime-local"
              name="phase_2_start"
              defaultValue={toLocal(config.phase_2_start)}
              className="w-full rounded-md border border-whisper bg-white/[0.03] px-2 py-1 text-sm text-white"
            />
          </div>
          <div>
            <label
              htmlFor="phase_3_start"
              className="mb-1 block text-sm text-cloud/60"
            >
              Meet The Projects (Phase 2 &rarr; 3)
            </label>
            <input
              id="phase_3_start"
              type="datetime-local"
              name="phase_3_start"
              defaultValue={toLocal(config.phase_3_start)}
              className="w-full rounded-md border border-whisper bg-white/[0.03] px-2 py-1 text-sm text-white"
            />
          </div>
        </div>
      </div>

      {/* Operational windows */}
      <div className="overflow-hidden rounded-md border border-whisper">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.04]">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-cloud/60">
                Phase
              </th>
              <th className="px-4 py-3 text-left font-medium text-cloud/60">
                Opens (UTC)
              </th>
              <th className="px-4 py-3 text-left font-medium text-cloud/60">
                Closes (UTC)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-whisper">
            {PHASES.map((phase) => (
              <tr key={phase.label}>
                <td className="px-4 py-3 font-medium text-white">
                  {phase.label}
                </td>
                <td className="px-4 py-3">
                  <input
                    type="datetime-local"
                    name={phase.open}
                    defaultValue={toLocal(
                      config[phase.open as keyof Config] as string | null
                    )}
                    className="rounded-md border border-whisper bg-white/[0.03] px-2 py-1 text-sm text-white"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="datetime-local"
                    name={phase.close}
                    defaultValue={toLocal(
                      config[phase.close as keyof Config] as string | null
                    )}
                    className="rounded-md border border-whisper bg-white/[0.03] px-2 py-1 text-sm text-white"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-teal px-4 py-2 text-sm font-medium text-white hover:bg-teal/80 disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save Schedule"}
        </button>
        {saved && <span className="text-sm text-aqua">Saved!</span>}
        {error && <span className="text-sm text-red">{error}</span>}
      </div>
    </form>
  );
}

// ─── Parameters form ──────────────────────────────────────────────────────────

const PARAM_GROUPS = [
  {
    heading: "Problem Voting",
    fields: [
      { label: "Submitter votes", name: "submitter_votes" },
      { label: "Non-submitter votes", name: "non_submitter_votes" },
      { label: "Vote threshold (pods)", name: "vote_threshold" },
      { label: "Max pods", name: "max_pods" },
      { label: "Pod minimum size", name: "pod_min" },
    ],
  },
  {
    heading: "Project Voting",
    fields: [
      { label: "Submitter votes", name: "project_submitter_votes" },
      { label: "Vote threshold (projects)", name: "project_vote_threshold" },
      { label: "Max projects per pod", name: "max_projects" },
      { label: "Project min members", name: "project_min" },
      { label: "Project max members", name: "project_max" },
    ],
  },
] as const;

export function CycleParamsForm({
  cycleId,
  config,
}: {
  cycleId: number;
  config: Config;
}) {
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaved(false);
    setError(null);
    const fd = new FormData(e.currentTarget);

    const body: Record<string, number> = {};
    for (const group of PARAM_GROUPS) {
      for (const field of group.fields) {
        const val = fd.get(field.name) as string;
        if (val !== "") body[field.name] = parseInt(val, 10);
      }
    }

    setLoading(true);
    const res = await fetch(`/api/cycles/${cycleId}/config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);

    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to save parameters");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-8 sm:grid-cols-2">
        {PARAM_GROUPS.map((group) => (
          <div key={group.heading}>
            <h3 className="mb-3 text-sm font-semibold text-cloud">
              {group.heading}
            </h3>
            <div className="space-y-3">
              {group.fields.map((field) => (
                <div
                  key={field.name}
                  className="flex items-center justify-between gap-4"
                >
                  <label
                    htmlFor={field.name}
                    className="text-sm text-cloud/60"
                  >
                    {field.label}
                  </label>
                  <input
                    id={field.name}
                    type="number"
                    name={field.name}
                    min={0}
                    defaultValue={
                      config[field.name as keyof Config] as number
                    }
                    className="w-20 rounded-md border border-whisper bg-white/[0.03] px-2 py-1 text-right text-sm text-white"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-teal px-4 py-2 text-sm font-medium text-white hover:bg-teal/80 disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save Parameters"}
        </button>
        {saved && <span className="text-sm text-aqua">Saved!</span>}
        {error && <span className="text-sm text-red">{error}</span>}
      </div>
    </form>
  );
}
