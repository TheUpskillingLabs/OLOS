"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable, StatusBadge, Sheet } from "@/app/components/ui";
import AssignModeratorButton from "./assign-moderator-button";
import { podNoun, moderatorNoun } from "@/lib/cycle/labels";

/**
 * The Formation-tab pods table. Extracted from the cycle detail page and wired
 * to the (previously built but unused) admin pod routes:
 *   - PATCH  /api/admin/pods/[id]                         force forming → active
 *   - POST   /api/admin/pods/[id]/memberships            add a member
 *   - DELETE /api/admin/pods/[id]/memberships/[pid]      remove a member
 * These operator fixes previously required raw SQL. Moderator assignment keeps
 * its existing inline control; the rest lives in a per-pod management drawer.
 */

export type PodMember = { participant_id: number; name: string };
export type PodModerator = {
  participant_id: number;
  name: string;
  assigned_at: string;
};
export type PodAdminRow = {
  id: number;
  name: string | null;
  status: string;
  members: PodMember[];
  moderators: PodModerator[];
};
type ParticipantOption = { participant_id: number; name: string };

const POD_STATUS_VARIANT: Record<string, "active" | "forming" | "inactive"> = {
  active: "active",
  forming: "forming",
  closed: "inactive",
  inactive: "inactive",
};

export default function PodsTable({
  cycleId,
  pods,
  participants,
  mode,
}: {
  cycleId: number;
  pods: PodAdminRow[];
  participants: ParticipantOption[];
  mode?: string | null;
}) {
  const [managePodId, setManagePodId] = React.useState<number | null>(null);
  const managePod = pods.find((p) => p.id === managePodId) ?? null;

  if (pods.length === 0) {
    return (
      <p className="text-sm text-meta">
        {mode === "org"
          ? "No workstream runs chartered yet — create runs from the workstreams above."
          : "No pods yet. Finalize pod voting to create them."}
      </p>
    );
  }

  return (
    <>
      <DataTable<PodAdminRow>
        rows={pods}
        rowKey={(p) => p.id}
        columns={[
          {
            key: "pod",
            header: podNoun(mode),
            className: "font-medium text-ink",
            cell: (p) => p.name ?? `${podNoun(mode)} ${p.id}`,
          },
          {
            key: "status",
            header: "Status",
            cell: (p) => (
              <StatusBadge variant={POD_STATUS_VARIANT[p.status] ?? "inactive"}>
                {p.status}
              </StatusBadge>
            ),
          },
          {
            key: "members",
            header: "Members",
            className: "text-meta tabular-nums",
            cell: (p) => p.members.length,
          },
          {
            key: "moderators",
            header: moderatorNoun(mode, true),
            cell: (p) => (
              <AssignModeratorButton
                podId={p.id}
                cycleId={cycleId}
                participants={participants}
                initialModerators={p.moderators}
                mode={mode}
              />
            ),
          },
          {
            key: "actions",
            header: "",
            align: "right",
            cell: (p) => (
              <div className="flex items-center justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setManagePodId(p.id)}
                  className="text-sm font-semibold tracking-tight text-teal-deep transition-colors duration-150 hover:text-ink"
                >
                  Manage
                </button>
                <Link
                  href={`/pods/${p.id}`}
                  className="text-sm font-semibold tracking-tight text-teal-deep transition-colors duration-150 hover:text-ink"
                >
                  View &rarr;
                </Link>
              </div>
            ),
          },
        ]}
      />

      <Sheet
        open={managePod !== null}
        onClose={() => setManagePodId(null)}
        title={managePod ? (managePod.name ?? `${podNoun(mode)} ${managePod.id}`) : ""}
        description="Membership and status — admin overrides"
      >
        {managePod && (
          <PodManagePanel
            key={managePod.id}
            pod={managePod}
            participants={participants}
            mode={mode}
          />
        )}
      </Sheet>
    </>
  );
}

function PodManagePanel({
  pod,
  participants,
  mode,
}: {
  pod: PodAdminRow;
  participants: ParticipantOption[];
  mode?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState("");

  const memberIds = new Set(pod.members.map((m) => m.participant_id));
  const addable = participants.filter((p) => !memberIds.has(p.participant_id));

  async function call(
    url: string,
    method: string,
    body?: Record<string, unknown>,
  ) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          typeof data?.error === "string"
            ? data.error
            : `Request failed (${res.status})`,
        );
        return;
      }
      // Authoritative refresh — the pod's members/status re-derive from the
      // server, and this drawer (kept open) reflects the change immediately.
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const forceActive = () => {
    const noun = podNoun(mode).toLowerCase();
    const message =
      mode === "org"
        ? `Force this ${noun} to active? This activates every current member's enrollment.`
        : `Force this ${noun} to active? This skips the pod_min check and activates every current member's enrollment.`;
    if (!confirm(message)) return;
    call(`/api/admin/pods/${pod.id}`, "PATCH", { status: "active" });
  };

  const addMember = () => {
    if (!selectedId) return;
    call(`/api/admin/pods/${pod.id}/memberships`, "POST", {
      participant_id: parseInt(selectedId, 10),
    });
    setSelectedId("");
  };

  const removeMember = (participantId: number) => {
    if (!confirm("Remove this member from the pod?")) return;
    call(`/api/admin/pods/${pod.id}/memberships/${participantId}`, "DELETE");
  };

  return (
    <div className="space-y-8 p-6">
      {error && (
        <div
          role="alert"
          className="rounded-card border border-red/20 bg-red/10 p-3 text-sm text-red"
        >
          {error}
        </div>
      )}

      <section>
        <h3 className="lbl mb-3">Status</h3>
        <div className="flex items-center gap-3">
          <StatusBadge variant={POD_STATUS_VARIANT[pod.status] ?? "inactive"}>
            {pod.status}
          </StatusBadge>
          {pod.status === "forming" && (
            <button
              type="button"
              onClick={forceActive}
              disabled={busy}
              className="btn btn-ghost px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              Force active
            </button>
          )}
        </div>
      </section>

      <section>
        <h3 className="lbl mb-3">Members ({pod.members.length})</h3>
        <div className="space-y-1">
          {pod.members.map((m) => (
            <div
              key={m.participant_id}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="text-charcoal">{m.name}</span>
              <button
                type="button"
                onClick={() => removeMember(m.participant_id)}
                disabled={busy}
                className="text-xs font-medium text-red transition-colors duration-150 hover:text-red disabled:cursor-not-allowed disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          ))}
          {pod.members.length === 0 && (
            <p className="text-xs text-meta">No members yet.</p>
          )}
        </div>

        {addable.length > 0 && (
          <div className="mt-4 flex items-center gap-2">
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              aria-label="Add participant to pod"
              className="flex-1 rounded-card border border-ink/10 bg-white px-2 py-1.5 text-base text-ink transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
            >
              <option value="">Add participant…</option>
              {addable.map((p) => (
                <option key={p.participant_id} value={p.participant_id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addMember}
              disabled={!selectedId || busy}
              className="rounded-card bg-teal/10 px-3 py-1.5 text-xs font-semibold tracking-tight text-teal-deep transition-all duration-150 hover:bg-teal/20 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              {busy ? "…" : "Add"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
