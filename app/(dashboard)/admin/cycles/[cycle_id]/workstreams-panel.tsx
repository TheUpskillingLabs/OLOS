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
 *
 * Creating, renaming, and archiving workstreams themselves (durable,
 * cross-cycle entities) lives at /admin/org — see workstreams-directory.tsx
 * — not here; this panel only charters a run for an existing workstream.
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
  // Already-chartered workstreams live in the "Chartered runs" table below
  // this panel — repeating them here read as a duplicated list, so the
  // panel only shows what's left to charter.
  const unchartered = workstreams.filter((w) => !w.run);
  const charteredCount = workstreams.length - unchartered.length;

  return (
    <div className="rounded-card border border-ink/10 bg-white p-4 shadow-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        {charteredCount > 0 ? (
          <p className="text-xs text-meta">
            {charteredCount} of {workstreams.length} workstreams already
            chartered — see Chartered runs below.
          </p>
        ) : (
          <span />
        )}
        <Link
          href="/admin/org"
          className="text-sm text-meta transition-colors duration-150 hover:text-teal-deep focus-visible:outline-none focus-visible:text-teal-deep"
        >
          Manage workstreams &rarr;
        </Link>
      </div>

      {workstreams.length === 0 ? (
        <p className="text-sm text-meta">No workstreams yet.</p>
      ) : unchartered.length === 0 ? (
        <p className="text-sm text-meta">
          All workstreams have runs this cycle.
        </p>
      ) : (
        <div className="divide-y divide-ink/10">
          {unchartered.map((w) => (
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
        {workstream.status !== "active" ? (
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
