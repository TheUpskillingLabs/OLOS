"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";

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
  registration_open: string | null;
  registration_close: string | null;
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
    label: "Cycle Registration",
    open: "registration_open",
    close: "registration_close",
  },
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

type ScheduleKey = "phase_2_start" | "phase_3_start" |
  typeof PHASES[number]["open"] | typeof PHASES[number]["close"];

type ScheduleFormData = Record<ScheduleKey, string>;

export function CycleScheduleForm({
  cycleId,
  config,
}: {
  cycleId: number;
  config: Config;
}) {
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { isSubmitting } } = useForm<ScheduleFormData>({
    defaultValues: {
      phase_2_start: toLocal(config.phase_2_start),
      phase_3_start: toLocal(config.phase_3_start),
      ...Object.fromEntries(
        PHASES.flatMap((p) => [
          [p.open, toLocal(config[p.open as keyof Config] as string | null)],
          [p.close, toLocal(config[p.close as keyof Config] as string | null)],
        ])
      ),
    },
  });

  async function onSubmit(data: ScheduleFormData) {
    setSaved(false);
    setServerError(null);

    const body: Record<string, string | null> = {
      phase_2_start: fromLocal(data.phase_2_start),
      phase_3_start: fromLocal(data.phase_3_start),
    };
    for (const phase of PHASES) {
      body[phase.open] = fromLocal(data[phase.open as ScheduleKey]);
      body[phase.close] = fromLocal(data[phase.close as ScheduleKey]);
    }

    const res = await fetch(`/api/cycles/${cycleId}/config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      const json = await res.json();
      setServerError(json.error ?? "Failed to save schedule");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="mb-6 rounded-card border border-ink/10 bg-white p-4 shadow-card">
        <h3 className="mb-3 text-sm font-semibold tracking-tight text-ink">
          Cycle Phases
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="phase_2_start" className="mb-1 block text-sm text-meta">
              Meet The Pods (Phase 1 &rarr; 2)
            </label>
            <input
              id="phase_2_start"
              type="datetime-local"
              {...register("phase_2_start")}
              className="block w-full rounded-card border border-ink/10 bg-white px-2 py-1 text-base text-ink transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
            />
          </div>
          <div>
            <label htmlFor="phase_3_start" className="mb-1 block text-sm text-meta">
              Meet The Projects (Phase 2 &rarr; 3)
            </label>
            <input
              id="phase_3_start"
              type="datetime-local"
              {...register("phase_3_start")}
              className="block w-full rounded-card border border-ink/10 bg-white px-2 py-1 text-base text-ink transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
            />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-card border border-ink/10 bg-white shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-ink/[0.02]">
            <tr>
              <th className="lbl px-4 py-3 text-left">
                Phase
              </th>
              <th className="lbl px-4 py-3 text-left">
                Opens (UTC)
              </th>
              <th className="lbl px-4 py-3 text-left">
                Closes (UTC)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {PHASES.map((phase) => (
              <tr key={phase.label} className="transition-colors duration-150 hover:bg-ink/[0.02]">
                <td className="px-4 py-3 font-medium text-ink">{phase.label}</td>
                <td className="px-4 py-3">
                  <input
                    type="datetime-local"
                    {...register(phase.open as ScheduleKey)}
                    className="rounded-card border border-ink/10 bg-white px-2 py-1 text-base text-ink transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="datetime-local"
                    {...register(phase.close as ScheduleKey)}
                    className="rounded-card border border-ink/10 bg-white px-2 py-1 text-base text-ink transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
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
          disabled={isSubmitting}
          className="btn btn-teal px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Saving…" : "Save Schedule"}
        </button>
        {saved && <span className="text-sm font-medium text-teal-deep">Saved.</span>}
        {serverError && (
          <span role="alert" className="text-sm text-red">{serverError}</span>
        )}
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

type ParamKey = typeof PARAM_GROUPS[number]["fields"][number]["name"];
type ParamsFormData = Record<ParamKey, string>;

export function CycleParamsForm({
  cycleId,
  config,
}: {
  cycleId: number;
  config: Config;
}) {
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { isSubmitting } } = useForm<ParamsFormData>({
    defaultValues: Object.fromEntries(
      PARAM_GROUPS.flatMap((g) =>
        g.fields.map((f) => [f.name, String(config[f.name as keyof Config] ?? "")])
      )
    ) as ParamsFormData,
  });

  async function onSubmit(data: ParamsFormData) {
    setSaved(false);
    setServerError(null);

    const body: Record<string, number> = {};
    for (const group of PARAM_GROUPS) {
      for (const field of group.fields) {
        const val = data[field.name as ParamKey];
        if (val !== "") body[field.name] = parseInt(val, 10);
      }
    }

    const res = await fetch(`/api/cycles/${cycleId}/config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      const json = await res.json();
      setServerError(json.error ?? "Failed to save parameters");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="grid gap-8 sm:grid-cols-2">
        {PARAM_GROUPS.map((group) => (
          <div key={group.heading}>
            <h3 className="mb-3 text-sm font-semibold tracking-tight text-ink">
              {group.heading}
            </h3>
            <div className="space-y-3">
              {group.fields.map((field) => (
                <div key={field.name} className="flex items-center justify-between gap-4">
                  <label htmlFor={field.name} className="text-sm text-meta">
                    {field.label}
                  </label>
                  <input
                    id={field.name}
                    type="number"
                    min={0}
                    {...register(field.name as ParamKey)}
                    className="w-20 rounded-card border border-ink/10 bg-white px-2 py-1 text-right text-base tabular-nums text-ink transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
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
          disabled={isSubmitting}
          className="btn btn-teal px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Saving…" : "Save Parameters"}
        </button>
        {saved && <span className="text-sm font-medium text-teal-deep">Saved.</span>}
        {serverError && (
          <span role="alert" className="text-sm text-red">{serverError}</span>
        )}
      </div>
    </form>
  );
}
