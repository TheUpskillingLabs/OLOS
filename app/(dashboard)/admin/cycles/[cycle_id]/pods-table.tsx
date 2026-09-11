"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable, StatusBadge, Sheet } from "@/app/components/ui";
import AssignModeratorButton from "./assign-moderator-button";
import OwnerLifecycle from "@/app/components/owner-lifecycle";
import { ContactsDownloadButton } from "@/app/components/contacts-download-button";
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

export type PodMember = {
  participant_id: number;
  name: string;
  /** Org-run members whose home lab differs from the run's lab (Decision 2:
   * org runs stay cross-lab). Open-cycle members never set this. */
  out_of_lab?: boolean;
};
export type PodModerator = {
  participant_id: number;
  name: string;
  assigned_at: string;
};
export type ProjectAdminRow = {
  id: number;
  name: string | null;
  status: string;
  pod_id: number;
  /** ACTIVE members only (left_at IS NULL) — matches what the project_max cap
   * counts, so the fill shown here can't promise room the DB then refuses. */
  members: PodMember[];
};
export type PodAdminRow = {
  id: number;
  name: string | null;
  status: string;
  members: PodMember[];
  moderators: PodModerator[];
  /** Existing projects for this pod — gates the Finalize-projects action. */
  projectCount: number;
  /** This pod's projects with their rosters (00103 admin add / move).
   * Optional: consumers that don't load rosters (the lab page) fall back to
   * the plain "projects have been finalized" note. */
  projects?: ProjectAdminRow[];
};
type ParticipantOption = {
  participant_id: number;
  name: string;
  email?: string;
  /** False when the participant is not enrolled in this cycle. Only set on
   * the poderator-candidate list — a poderator shepherds a pod they don't
   * sit in, so the assign dropdown offers everyone and tags non-enrollees. */
  enrolled?: boolean;
};

const POD_STATUS_VARIANT: Record<string, "active" | "forming" | "inactive"> = {
  active: "active",
  forming: "forming",
  inactive: "inactive",
  dissolved: "inactive",
};

export default function PodsTable({
  cycleId,
  pods,
  participants,
  moderatorCandidates,
  mode,
  isOwner = false,
  allProjects = [],
  projectMax = null,
}: {
  cycleId: number;
  pods: PodAdminRow[];
  /** Add-member dropdown: this cycle's enrollees (org: full roster). */
  participants: ParticipantOption[];
  /** Assign-poderator dropdown: every participant, enrolled or not.
   * Falls back to `participants` when not provided. */
  moderatorCandidates?: ParticipantOption[];
  mode?: string | null;
  isOwner?: boolean;
  /** Every project in the cycle — the Move picker's destination list. A move
   * is usually cross-pod, which is why this isn't scoped to one pod. */
  allProjects?: ProjectAdminRow[];
  /** cycle_config.project_max; null means uncapped. */
  projectMax?: number | null;
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
          // Projects sit inside the Manage drawer, so without a count here
          // there is nothing on the surface to suggest a pod HAS projects —
          // the drawer reads as membership-only. Mirrors the Members column.
          ...(mode !== "org"
            ? [
                {
                  key: "projects",
                  header: "Projects",
                  className: "text-meta tabular-nums",
                  cell: (p: PodAdminRow) => p.projectCount,
                },
              ]
            : []),
          {
            key: "moderators",
            header: moderatorNoun(mode, true),
            cell: (p) => (
              <AssignModeratorButton
                podId={p.id}
                cycleId={cycleId}
                participants={moderatorCandidates ?? participants}
                initialModerators={p.moderators}
                mode={mode}
                podName={p.name ?? `${podNoun(mode)} ${p.id}`}
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
            isOwner={isOwner}
            allProjects={allProjects}
            projectMax={projectMax}
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
  isOwner = false,
  allProjects = [],
  projectMax = null,
}: {
  pod: PodAdminRow;
  participants: ParticipantOption[];
  mode?: string | null;
  isOwner?: boolean;
  allProjects?: ProjectAdminRow[];
  projectMax?: number | null;
}) {
  const router = useRouter();
  const isOrg = mode === "org";
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState("");
  const [roleValue, setRoleValue] = React.useState<"member" | "co_lead">("member");
  const [search, setSearch] = React.useState("");
  // Per-project "add participant" selections, keyed by project id.
  const [projectSel, setProjectSel] = React.useState<Record<number, string>>({});
  // The person currently being moved, and where to.
  const [moving, setMoving] = React.useState<
    { participantId: number; name: string; fromProjectId: number } | null
  >(null);
  const [moveTo, setMoveTo] = React.useState("");

  const memberIds = new Set(pod.members.map((m) => m.participant_id));
  const addable = participants.filter((p) => !memberIds.has(p.participant_id));
  // Org runs draw from the FULL registered-participant list (it can be
  // hundreds of people), so offer a client-side name/email filter — the
  // people-table.tsx idiom. Open cycles keep the short enrolled-only list.
  const q = search.trim().toLowerCase();
  const filteredAddable = q
    ? addable.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.email ?? "").toLowerCase().includes(q),
      )
    : addable;

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

  const finalizeProjects = () => {
    if (
      !confirm(
        "Finalize solution voting and create this pod's projects? This uses AI to name projects and cannot be undone."
      )
    )
      return;
    call(`/api/pods/${pod.id}/projects/finalize`, "POST");
  };

  const addMember = () => {
    if (!selectedId) return;
    call(`/api/admin/pods/${pod.id}/memberships`, "POST", {
      participant_id: parseInt(selectedId, 10),
      // Org runs require the role pairing (co-lead also writes the
      // moderator assignment server-side); other pods reject pod_role.
      ...(isOrg ? { pod_role: roleValue } : {}),
    });
    setSelectedId("");
    setSearch("");
    setRoleValue("member");
  };

  const removeMember = (participantId: number) => {
    if (!confirm("Remove this member from the pod?")) return;
    call(`/api/admin/pods/${pod.id}/memberships/${participantId}`, "DELETE");
  };

  // ── Project roster controls (00103) ────────────────────────────────────
  // Adding someone to a project also puts them in that project's pod, and a
  // move carries the pod with it when the destination is in another pod. Both
  // happen inside one RPC transaction, so the two rosters can never disagree.

  /** null = uncapped. */
  const isFull = (proj: ProjectAdminRow) =>
    projectMax != null && proj.members.length >= projectMax;

  const fill = (proj: ProjectAdminRow) =>
    projectMax != null ? `${proj.members.length}/${projectMax}` : `${proj.members.length}`;

  const addToProject = (proj: ProjectAdminRow) => {
    const raw = projectSel[proj.id];
    if (!raw) return;
    let override = false;
    if (isFull(proj)) {
      // Owner decision (2026-09-11): admins may exceed project_max, but only
      // deliberately. The cap is enforced in the database (00101), so this
      // flag is what opens the transaction-scoped override in the RPC.
      if (
        !confirm(
          `${proj.name ?? `Project ${proj.id}`} is already at its limit of ${projectMax}. Add anyway and exceed the limit?`,
        )
      )
        return;
      override = true;
    }
    call(`/api/admin/projects/${proj.id}/memberships`, "POST", {
      action: "add",
      participant_id: parseInt(raw, 10),
      override,
    });
    setProjectSel((prev) => ({ ...prev, [proj.id]: "" }));
  };

  const confirmMove = () => {
    if (!moving || !moveTo) return;
    const toId = parseInt(moveTo, 10);
    const target = allProjects.find((p) => p.id === toId);
    if (!target) return;
    let override = false;
    if (isFull(target)) {
      if (
        !confirm(
          `${target.name ?? `Project ${target.id}`} is already at its limit of ${projectMax}. Move anyway and exceed the limit?`,
        )
      )
        return;
      override = true;
    }
    // The destination project is the route target; the SOURCE is derived
    // server-side from the participant's one active membership, so a stale
    // roster in this tab can't move the wrong row.
    call(`/api/admin/projects/${toId}/memberships`, "POST", {
      action: "move",
      participant_id: moving.participantId,
      override,
    });
    setMoving(null);
    setMoveTo("");
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

      {mode !== "org" && (
        <section>
          <h3 className="lbl mb-3">Projects ({pod.projectCount})</h3>
          {pod.projectCount > 0 && (pod.projects?.length ?? 0) > 0 ? (
            <div className="space-y-5">
              {(pod.projects ?? []).map((proj) => {
                const addable = participants.filter(
                  (p) => !proj.members.some((m) => m.participant_id === p.participant_id),
                );
                return (
                  <div
                    key={proj.id}
                    className="rounded-card border border-ink/10 p-3"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ink">
                        {proj.name ?? `Project ${proj.id}`}
                      </span>
                      <span
                        className={`text-xs tabular-nums ${isFull(proj) ? "font-medium text-red" : "text-meta"}`}
                      >
                        {fill(proj)}
                        {isFull(proj) ? " · full" : ""}
                      </span>
                    </div>

                    <div className="space-y-1">
                      {proj.members.map((m) => (
                        <div
                          key={m.participant_id}
                          className="flex items-center justify-between gap-3 text-sm"
                        >
                          <span className="text-charcoal">{m.name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setMoving({
                                participantId: m.participant_id,
                                name: m.name,
                                fromProjectId: proj.id,
                              });
                              setMoveTo("");
                            }}
                            disabled={busy}
                            className="text-xs font-medium text-teal-deep transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Move
                          </button>
                        </div>
                      ))}
                      {proj.members.length === 0 && (
                        <p className="text-xs text-meta">No one on this project yet.</p>
                      )}
                    </div>

                    {/* Moving someone off THIS project: the destination list is
                        every other project in the cycle, since a move is
                        usually into another pod. */}
                    {moving?.fromProjectId === proj.id && (
                      <div className="mt-3 rounded-card bg-ink/[0.03] p-3">
                        <p className="mb-2 text-xs text-meta">
                          Move <span className="font-medium text-ink">{moving.name}</span> to:
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={moveTo}
                            onChange={(e) => setMoveTo(e.target.value)}
                            aria-label="Destination project"
                            className="flex-1 rounded-card border border-ink/10 bg-white px-2 py-1.5 text-base text-ink transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
                          >
                            <option value="">Choose a project…</option>
                            {allProjects
                              .filter((p) => p.id !== proj.id)
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name ?? `Project ${p.id}`}
                                  {p.pod_id !== pod.id ? " (other pod)" : ""} — {fill(p)}
                                  {isFull(p) ? " full" : ""}
                                </option>
                              ))}
                          </select>
                          <button
                            type="button"
                            onClick={confirmMove}
                            disabled={busy || !moveTo}
                            className="btn btn-ghost px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Move
                          </button>
                          <button
                            type="button"
                            onClick={() => setMoving(null)}
                            disabled={busy}
                            className="text-xs text-meta disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                        <p className="mt-2 text-[11px] text-meta">
                          Moving to a project in another pod moves their pod
                          membership too.
                        </p>
                      </div>
                    )}

                    {addable.length > 0 && (
                      <div className="mt-3 flex items-center gap-2">
                        <select
                          value={projectSel[proj.id] ?? ""}
                          onChange={(e) =>
                            setProjectSel((prev) => ({ ...prev, [proj.id]: e.target.value }))
                          }
                          aria-label={`Add participant to ${proj.name ?? `project ${proj.id}`}`}
                          className="flex-1 rounded-card border border-ink/10 bg-white px-2 py-1.5 text-base text-ink transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
                        >
                          <option value="">Add participant…</option>
                          {addable.map((p) => (
                            <option key={p.participant_id} value={p.participant_id}>
                              {p.email ? `${p.name} — ${p.email}` : p.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => addToProject(proj)}
                          disabled={busy || !projectSel[proj.id]}
                          className="btn btn-ghost px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isFull(proj) ? "Add over limit" : "Add"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              <p className="text-[11px] text-meta">
                Adding someone to a project also adds them to this pod.
              </p>
            </div>
          ) : pod.projectCount > 0 ? (
            <p className="text-sm text-meta">
              Projects have been finalized for this pod.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-meta">
                Turn this pod&rsquo;s solution-proposal votes into projects.
                Also runs automatically when the cycle advances into Project
                Registration.
              </p>
              <button
                type="button"
                onClick={finalizeProjects}
                disabled={busy}
                className="btn btn-ghost px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                Finalize projects
              </button>
            </div>
          )}
        </section>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="lbl">Members ({pod.members.length})</h3>
          <ContactsDownloadButton
            href={`/api/pods/${pod.id}/contacts/export`}
          />
        </div>
        <div className="space-y-1">
          {pod.members.map((m) => (
            <div
              key={m.participant_id}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="text-charcoal">
                {m.name}
                {m.out_of_lab && (
                  <span className="ml-2 rounded-full bg-ink/[0.06] px-2 py-0.5 text-[10px] font-medium text-meta">
                    Out of lab
                  </span>
                )}
              </span>
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
          <div className="mt-4 space-y-2">
            {isOrg && (
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search members by name or email…"
                aria-label="Search registered members"
                className="w-full rounded-card border border-ink/10 bg-white px-2 py-1.5 text-base text-ink transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
              />
            )}
            <div className="flex items-center gap-2">
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                aria-label="Add participant to pod"
                className="flex-1 rounded-card border border-ink/10 bg-white px-2 py-1.5 text-base text-ink transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
              >
                <option value="">
                  {isOrg ? "Add core contributor…" : "Add participant…"}
                </option>
                {filteredAddable.map((p) => (
                  <option key={p.participant_id} value={p.participant_id}>
                    {p.email ? `${p.name} — ${p.email}` : p.name}
                  </option>
                ))}
              </select>
              {isOrg && (
                <select
                  value={roleValue}
                  onChange={(e) =>
                    setRoleValue(e.target.value === "co_lead" ? "co_lead" : "member")
                  }
                  aria-label="Role for the new core contributor"
                  className="rounded-card border border-ink/10 bg-white px-2 py-1.5 text-base text-ink transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
                >
                  <option value="member">Member</option>
                  <option value="co_lead">Co-lead</option>
                </select>
              )}
              <button
                type="button"
                onClick={addMember}
                disabled={!selectedId || busy}
                className="rounded-card bg-teal/10 px-3 py-1.5 text-xs font-semibold tracking-tight text-teal-deep transition-all duration-150 hover:bg-teal/20 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
              >
                {busy ? "…" : "Add"}
              </button>
            </div>
            {isOrg && q && filteredAddable.length === 0 && (
              <p className="text-xs text-meta">No registered members match that search.</p>
            )}
          </div>
        )}
      </section>

      {isOwner && (
        <OwnerLifecycle
          entity="pods"
          id={pod.id}
          name={pod.name ?? `${podNoun(mode)} ${pod.id}`}
        />
      )}
    </div>
  );
}
