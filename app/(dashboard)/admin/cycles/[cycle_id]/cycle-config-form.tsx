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

// Convert stored timestamp to datetime-local input value (treats as UTC)
function toLocal(iso: string | null): string {
  if (!iso) return "";
  return iso.replace(" ", "T").slice(0, 16);
}

// Convert datetime-local input value back to a storable timestamp string
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
      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-800">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">
                Phase
              </th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">
                Opens (UTC)
              </th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">
                Closes (UTC)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
            {PHASES.map((phase) => (
              <tr key={phase.label}>
                <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                  {phase.label}
                </td>
                <td className="px-4 py-3">
                  <input
                    type="datetime-local"
                    name={phase.open}
                    defaultValue={toLocal(
                      config[phase.open as keyof Config] as string | null
                    )}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="datetime-local"
                    name={phase.close}
                    defaultValue={toLocal(
                      config[phase.close as keyof Config] as string | null
                    )}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
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
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {loading ? "Saving…" : "Save Schedule"}
        </button>
        {saved && <span className="text-sm text-green-600">Saved!</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
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
            <h3 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
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
                    className="text-sm text-zinc-600 dark:text-zinc-400"
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
                    className="w-20 rounded-md border border-zinc-300 px-2 py-1 text-right text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
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
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {loading ? "Saving…" : "Save Parameters"}
        </button>
        {saved && <span className="text-sm text-green-600">Saved!</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}
