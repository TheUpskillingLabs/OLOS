"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/app/components/ui";

/**
 * Formation-tab counterpart to PodsTable for org cycles (docs/ORG_CYCLES.md
 * §2/§5): lists the org's durable workstreams and lets an admin charter this
 * cycle's run (a `pods` row, `workstream_id` set) per workstream, optionally
 * copying a prior run's roster forward via
 * POST /api/admin/workstreams/[id]/runs.
 */

export type WorkstreamRun = { pod_id: number; name: string | null };
export type WorkstreamAdminRow = {
  id: number;
  name: string;
  description: string | null;
  status: string;
  run: WorkstreamRun | null;
};
export type PriorOrgCycleOption = { id: number; name: string };

const WORKSTREAM_STATUS_VARIANT: Record<string, "active" | "inactive"> = {
  active: "active",
  dormant: "inactive",
};

export default function WorkstreamsPanel({
  cycleId,
  workstreams,
  priorOrgCycles,
}: {
  cycleId: number;
  workstreams: WorkstreamAdminRow[];
  priorOrgCycles: PriorOrgCycleOption[];
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);

  async function createWorkstream(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/admin/workstreams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: description || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCreateError(
          typeof data?.error === "string" ? data.error : "Failed to create workstream"
        );
        return;
      }
      setName("");
      setDescription("");
      setFormOpen(false);
      router.refresh();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="rounded-card border border-ink/10 bg-white p-4 shadow-card">
      <div className="mb-4 flex items-center justify-end">
        {!formOpen && (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="btn btn-teal px-3 py-1 text-xs"
          >
            + New workstream
          </button>
        )}
      </div>

      {formOpen && (
        <form
          onSubmit={createWorkstream}
          className="mb-4 flex flex-wrap items-start gap-3 rounded-card border border-ink/10 bg-ink/[0.02] p-3"
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-charcoal" htmlFor="ws-name">
              Name
            </label>
            <input
              id="ws-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder="e.g. Moderator tooling"
              className="rounded-card border border-ink/10 bg-white px-3 py-1.5 text-base text-ink placeholder:text-meta transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <label className="text-xs font-medium text-charcoal" htmlFor="ws-description">
              Description (optional)
            </label>
            <input
              id="ws-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this workstream covers"
              className="rounded-card border border-ink/10 bg-white px-3 py-1.5 text-base text-ink placeholder:text-meta transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
            />
          </div>
          <div className="flex items-center gap-2 pt-5">
            <button
              type="submit"
              disabled={creating || !name.trim()}
              className="btn btn-teal px-4 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => {
                setFormOpen(false);
                setCreateError(null);
                setName("");
                setDescription("");
              }}
              className="text-sm text-meta transition-colors duration-150 hover:text-charcoal focus-visible:outline-none focus-visible:text-charcoal"
            >
              Cancel
            </button>
          </div>
          {createError && (
            <p role="alert" className="w-full text-xs text-red">
              {createError}
            </p>
          )}
        </form>
      )}

      {workstreams.length === 0 ? (
        <p className="text-sm text-meta">No workstreams yet.</p>
      ) : (
        <div className="divide-y divide-ink/10">
          {workstreams.map((w) => (
            <WorkstreamRowItem
              key={w.id}
              cycleId={cycleId}
              workstream={w}
              priorOrgCycles={priorOrgCycles}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkstreamRowItem({
  cycleId,
  workstream,
  priorOrgCycles,
}: {
  cycleId: number;
  workstream: WorkstreamAdminRow;
  priorOrgCycles: PriorOrgCycleOption[];
}) {
  const router = useRouter();
  const [copyFrom, setCopyFrom] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<string | null>(null);

  async function createRun() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/workstreams/${workstream.id}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cycle_id: cycleId,
          ...(copyFrom ? { copy_from_cycle_id: parseInt(copyFrom, 10) } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Failed to create run");
        return;
      }
      const copiedMembers = data.copied_members ?? 0;
      const copiedModerators = data.copied_moderators ?? 0;
      setResult(
        copiedMembers || copiedModerators
          ? `Run created — copied ${copiedMembers} member(s), ${copiedModerators} co-lead(s).`
          : "Run created."
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-[180px] flex-1">
        <p className="text-sm font-medium text-ink">{workstream.name}</p>
        {workstream.description && (
          <p className="text-xs text-meta">{workstream.description}</p>
        )}
      </div>
      <StatusBadge variant={WORKSTREAM_STATUS_VARIANT[workstream.status] ?? "inactive"}>
        {workstream.status}
      </StatusBadge>
      <div className="flex min-w-[160px] flex-1 items-center justify-end gap-3">
        {workstream.run ? (
          <Link
            href={`/pods/${workstream.run.pod_id}`}
            className="text-sm font-semibold tracking-tight text-teal-deep transition-colors duration-150 hover:text-ink focus-visible:outline-none focus-visible:text-ink"
          >
            {workstream.run.name ?? `Run ${workstream.run.pod_id}`} &rarr;
          </Link>
        ) : workstream.status !== "active" ? (
          <span className="text-xs text-meta">Dormant</span>
        ) : (
          <div className="flex items-center gap-2">
            {priorOrgCycles.length > 0 && (
              <select
                value={copyFrom}
                onChange={(e) => setCopyFrom(e.target.value)}
                aria-label={`Copy roster from a prior cycle for ${workstream.name}`}
                className="rounded-card border border-ink/10 bg-white px-2 py-1 text-xs text-ink transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
              >
                <option value="">Copy roster from…</option>
                {priorOrgCycles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={createRun}
              disabled={busy}
              className="rounded-card bg-teal/10 px-3 py-1.5 text-xs font-semibold tracking-tight text-teal-deep transition-all duration-150 hover:bg-teal/20 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              {busy ? "…" : "Create run"}
            </button>
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="w-full text-xs text-red">
          {error}
        </p>
      )}
      {result && <p className="w-full text-xs text-teal-deep">{result}</p>}
    </div>
  );
}
