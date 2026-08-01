"use client";

import * as React from "react";
import { Sheet, ORG_CHIP_CLASS, OrgDot } from "@/app/components/ui";
import { roleBadgeClass } from "@/lib/auth/role-colors";
import { moderatorNoun } from "@/lib/cycle/labels";
import type { Permission } from "@/lib/auth/permissions";
import PermissionsEditor from "./permissions-editor";
import AdminNameEditForm from "./admin-name-edit-form";
import type { Person } from "./types";

/** Why "View as" is unavailable, shown as text and repeated as the tooltip. */
const SIMULATE_BLOCKED_REASON =
  "Only members who have signed in at least once and hold no admin role can be simulated.";

/**
 * The participant drill-in drawer. Replaces the standalone permissions page as
 * the primary surface for editing one participant: identity + name-edit,
 * permissions/roles/tester, and a cross-cycle 360. Permissions load lazily on
 * open (GET /api/permissions) so the list stays a single cheap query.
 *
 * The full-page editor at /admin/participants/[id]/permissions stays as a
 * deep-link fallback.
 */
export default function ParticipantSheet({
  person,
  canManageRoles,
  canSimulate,
  onClose,
}: {
  person: Person | null;
  canManageRoles: boolean;
  canSimulate: boolean;
  onClose: () => void;
}) {
  // One participant-keyed result. State is only set inside the async callback
  // (never synchronously in the effect); loading is derived by comparing the
  // stored id to the current participant, so switching participants shows the
  // loading state without a synchronous reset.
  type PermState =
    | { id: number; status: "loaded"; permissions: Permission[] }
    | { id: number; status: "error"; message: string };
  const [state, setState] = React.useState<PermState | null>(null);

  const participantId = person?.id ?? null;

  React.useEffect(() => {
    if (participantId == null) return;
    let cancelled = false;
    fetch(`/api/permissions?participant_id=${participantId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load permissions (${res.status})`);
        const data = await res.json();
        if (!cancelled)
          setState({
            id: participantId,
            status: "loaded",
            permissions: (data.permissions ?? []) as Permission[],
          });
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setState({
            id: participantId,
            status: "error",
            message: e instanceof Error ? e.message : "Failed to load permissions",
          });
      });
    return () => {
      cancelled = true;
    };
  }, [participantId]);

  // "View as" — start a read-only member-view simulation (lib/auth/simulation.ts)
  // and land on their Home. A full navigation, not router.push: the identity
  // swap happens server-side on the next request, so every cached RSC payload
  // for the admin's own view has to be left behind.
  const [simError, setSimError] = React.useState<string | null>(null);
  const [simBusy, setSimBusy] = React.useState(false);

  const startSimulation = async () => {
    if (participantId == null) return;
    setSimBusy(true);
    setSimError(null);
    try {
      const res = await fetch("/api/admin/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participant_id: participantId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSimError(data.error ?? `Could not start simulation (${res.status})`);
        setSimBusy(false);
        return;
      }
      window.location.href = "/dashboard";
    } catch {
      setSimError("Could not start simulation.");
      setSimBusy(false);
    }
  };

  const current = state && state.id === participantId ? state : null;
  const permissions = current?.status === "loaded" ? current.permissions : null;
  const error = current?.status === "error" ? current.message : null;

  const displayName = person
    ? person.preferred_name
      ? `${person.preferred_name} ${person.last_name}`
      : `${person.first_name} ${person.last_name}`
    : "";

  const podAssignments = (person?.moderator_pods ?? []).map((mp) => ({
    pod_id: mp.pod_id,
    pod_name: mp.pod_name,
    cycle_name: "",
  }));

  return (
    <Sheet
      open={person !== null}
      onClose={onClose}
      title={displayName}
      description={person?.email}
      widthClass="w-full sm:w-[640px]"
    >
      {person && (
        <div className="space-y-8 p-6">
          {/* Roles + cross-cycle 360 */}
          <section className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {person.roles.map((r) => (
                <span
                  key={r}
                  className={`inline-flex items-center rounded-sm px-2.5 py-0.5 text-xs font-medium ${roleBadgeClass(r)}`}
                >
                  {r}
                </span>
              ))}
              {person.is_test && (
                <span className="inline-flex items-center rounded-sm border border-dashed border-ink/30 px-2.5 py-0.5 text-xs font-medium text-meta">
                  tester
                </span>
              )}
              {person.is_staff && (
                <span className={`${ORG_CHIP_CLASS} px-2.5`}>
                  <OrgDot />
                  core contributor
                </span>
              )}
              {person.roles.length === 0 && !person.is_test && !person.is_staff && (
                <span className="text-xs text-meta">No elevated role</span>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="lbl mb-1.5">Cycles</h3>
                {person.cycles.length ? (
                  <div className="flex flex-wrap gap-1">
                    {person.cycles.map((c) =>
                      c.mode === "org" ? (
                        <span key={c.cycle_id} className={`${ORG_CHIP_CLASS} px-2`}>
                          <OrgDot />
                          {c.cycle_name || `Cycle ${c.cycle_id}`}
                        </span>
                      ) : (
                        <span
                          key={c.cycle_id}
                          className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ${
                            c.status === "active"
                              ? "bg-teal/10 text-teal-deep"
                              : c.status === "revoked"
                                ? "bg-red/10 text-red"
                                : "bg-ink/[0.04] text-meta"
                          }`}
                        >
                          {c.cycle_name || `Cycle ${c.cycle_id}`}
                        </span>
                      )
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-meta">—</p>
                )}
              </div>
              <div>
                <h3 className="lbl mb-1.5">Moderating</h3>
                {person.moderator_pods.length ? (
                  <div className="flex flex-wrap gap-1">
                    {person.moderator_pods.map((mp) =>
                      mp.mode === "org" ? (
                        <span key={mp.pod_id} className={`${ORG_CHIP_CLASS} px-2`}>
                          <OrgDot />
                          {moderatorNoun(mp.mode).toLowerCase()} &middot; {mp.pod_name}
                        </span>
                      ) : (
                        <span
                          key={mp.pod_id}
                          className="inline-flex items-center rounded-sm bg-navy/10 px-2 py-0.5 text-xs font-medium text-navy"
                        >
                          {mp.pod_name}
                        </span>
                      )
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-meta">—</p>
                )}
              </div>
            </div>
          </section>

          {canSimulate && (
            <section className="space-y-2">
              <h3 className="lbl">View as</h3>
              <p className="text-xs text-meta">
                Render the member app as {person.preferred_name || person.first_name} to
                see exactly what they see. Read-only — every change is blocked
                until you exit.
              </p>
              <button
                type="button"
                onClick={startSimulation}
                disabled={!person.can_simulate || simBusy}
                title={
                  person.can_simulate
                    ? undefined
                    : SIMULATE_BLOCKED_REASON
                }
                className="btn btn-teal px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {simBusy ? "Starting…" : `View as ${person.first_name}`}
              </button>
              {/* A disabled button whose only explanation is a title attribute
                  explains itself to nobody on a phone, a keyboard or a screen
                  reader. The tooltip stays for the pointer; this is the copy
                  everyone else gets. */}
              {!person.can_simulate && (
                <p className="text-xs text-meta">{SIMULATE_BLOCKED_REASON}</p>
              )}
              {simError && (
                <p role="alert" className="text-sm text-red">
                  {simError}
                </p>
              )}
            </section>
          )}

          <AdminNameEditForm
            participantId={person.id}
            initial={{
              first_name: person.first_name,
              last_name: person.last_name,
              preferred_name: person.preferred_name ?? "",
            }}
          />

          {error && (
            <div
              role="alert"
              className="rounded-card border border-red/20 bg-red/10 p-3 text-sm text-red"
            >
              {error}
            </div>
          )}
          {permissions === null && !error ? (
            <p className="text-sm text-meta">Loading permissions…</p>
          ) : permissions ? (
            <PermissionsEditor
              participantId={person.id}
              initialPermissions={permissions}
              canManageRoles={canManageRoles}
              podAssignments={podAssignments}
              initialIsTest={person.is_test}
              initialIsStaff={person.is_staff}
            />
          ) : null}
        </div>
      )}
    </Sheet>
  );
}
