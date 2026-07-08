"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/app/components/ui";
import { workstreamStatusVariant } from "@/lib/cycle/labels";

/**
 * The Organization page's workstream directory (docs/ORG_CYCLES.md §2/§5):
 * the durable, cross-cycle roster of workstreams, independent of any single
 * cycle. Each row shows the workstream's run in the active org cycle (if
 * chartered) plus co-leads, and lets an admin rename/redescribe or toggle
 * active/dormant status in place via PATCH /api/admin/workstreams/[id].
 *
 * Creating a new workstream also lives here now — moved off the per-cycle
 * Formation tab's workstreams-panel.tsx, which only charters runs for
 * workstreams that already exist (see that file's header comment).
 */

export type WorkstreamRunCoLead = { participant_id: number; name: string };
export type WorkstreamDirectoryRun = {
  pod_id: number;
  name: string | null;
  co_leads: WorkstreamRunCoLead[];
};
export type WorkstreamDirectoryRow = {
  id: number;
  name: string;
  description: string | null;
  status: string;
  run: WorkstreamDirectoryRun | null;
};

export default function WorkstreamsDirectory({
  workstreams,
  labId,
}: {
  workstreams: WorkstreamDirectoryRow[];
  /** Local Labs (docs/LOCAL_LABS.md): when set (the /lab/[slug]
      workspace), created workstreams belong to that lab instead of the
      HQ sector. */
  labId?: number;
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
        body: JSON.stringify({
          name,
          description: description || undefined,
          ...(labId ? { lab_id: labId } : {}),
        }),
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
            <label className="text-xs font-medium text-charcoal" htmlFor="ws-new-name">
              Name
            </label>
            <input
              id="ws-new-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder="e.g. Programs & Events"
              className="rounded-card border border-ink/10 bg-white px-3 py-1.5 text-base text-ink placeholder:text-meta transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <label className="text-xs font-medium text-charcoal" htmlFor="ws-new-description">
              Description (optional)
            </label>
            <input
              id="ws-new-description"
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
              className="text-sm text-meta transition-colors duration-150 hover:text-charcoal"
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
            <WorkstreamDirectoryRowItem key={w.id} workstream={w} />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkstreamDirectoryRowItem({
  workstream,
}: {
  workstream: WorkstreamDirectoryRow;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState(workstream.name);
  const [description, setDescription] = React.useState(workstream.description ?? "");
  const [saving, setSaving] = React.useState(false);
  const [togglingStatus, setTogglingStatus] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function patchWorkstream(body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/workstreams/${workstream.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(
        typeof data?.error === "string" ? data.error : "Failed to update workstream"
      );
    }
    router.refresh();
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await patchWorkstream({ name, description: description || null });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update workstream");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus() {
    setTogglingStatus(true);
    setError(null);
    try {
      await patchWorkstream({
        status: workstream.status === "active" ? "dormant" : "active",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update workstream");
    } finally {
      setTogglingStatus(false);
    }
  }

  return (
    <div className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-[180px] flex-1">
          <p className="text-sm font-medium text-ink">{workstream.name}</p>
          {workstream.description && (
            <p className="text-xs text-meta">{workstream.description}</p>
          )}
        </div>
        <StatusBadge variant={workstreamStatusVariant(workstream.status)}>
          {workstream.status}
        </StatusBadge>
        <div className="min-w-[180px] flex-1">
          {workstream.run ? (
            <div>
              <Link
                href={`/pods/${workstream.run.pod_id}`}
                className="text-sm font-semibold tracking-tight text-teal-deep transition-colors duration-150 hover:text-ink"
              >
                {workstream.run.name ?? `Run ${workstream.run.pod_id}`} &rarr;
              </Link>
              {workstream.run.co_leads.length > 0 && (
                <p className="text-xs text-meta">
                  {workstream.run.co_leads.map((c) => c.name).join(", ")}
                </p>
              )}
            </div>
          ) : (
            <span className="text-xs text-meta">No run this cycle</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="rounded-card bg-teal/10 px-3 py-1 text-xs font-semibold tracking-tight text-teal-deep transition-all duration-150 hover:bg-teal/20 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            {editing ? "Cancel" : "Edit"}
          </button>
          <button
            type="button"
            onClick={toggleStatus}
            disabled={togglingStatus}
            className="rounded-card bg-ink/[0.04] px-3 py-1 text-xs font-semibold tracking-tight text-charcoal transition-all duration-150 hover:bg-ink/[0.08] hover:text-ink active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            {togglingStatus
              ? "…"
              : workstream.status === "active"
                ? "Mark dormant"
                : "Reactivate"}
          </button>
        </div>
      </div>

      {editing && (
        <form
          onSubmit={saveEdit}
          className="mt-3 flex flex-wrap items-start gap-3 rounded-card border border-ink/10 bg-ink/[0.02] p-3"
        >
          <div className="flex flex-col gap-1.5">
            <label
              className="text-xs font-medium text-charcoal"
              htmlFor={`ws-name-${workstream.id}`}
            >
              Name
            </label>
            <input
              id={`ws-name-${workstream.id}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              className="rounded-card border border-ink/10 bg-white px-3 py-1.5 text-base text-ink transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <label
              className="text-xs font-medium text-charcoal"
              htmlFor={`ws-description-${workstream.id}`}
            >
              Description
            </label>
            <textarea
              id={`ws-description-${workstream.id}`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-card border border-ink/10 bg-white px-3 py-1.5 text-base text-ink transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
            />
          </div>
          <div className="flex items-center gap-2 pt-5">
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="btn btn-teal px-4 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs text-red">
          {error}
        </p>
      )}
    </div>
  );
}
