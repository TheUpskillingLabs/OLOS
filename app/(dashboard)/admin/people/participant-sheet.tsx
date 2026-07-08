"use client";

import * as React from "react";
import { Sheet } from "@/app/components/ui";
import { roleBadgeClass } from "@/lib/auth/role-colors";
import { moderatorNoun } from "@/lib/cycle/labels";
import type { Permission } from "@/lib/auth/permissions";
import PermissionsEditor from "./permissions-editor";
import AdminNameEditForm from "./admin-name-edit-form";
import type { Person } from "./types";

/** Same org tint as people-table.tsx's ORG_CHIP_CLASS/OrgDot — duplicated
    rather than imported to avoid a circular import (people-table.tsx renders
    this component). Keep the two in sync if the tint ever changes. */
const ORG_CHIP_CLASS =
  "inline-flex items-center gap-1.5 rounded-sm bg-slate/10 py-0.5 text-xs font-medium text-slate";
function OrgDot() {
  return <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-teal-deep" />;
}

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
  onClose,
}: {
  person: Person | null;
  canManageRoles: boolean;
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
                  staff
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
            />
          ) : null}
        </div>
      )}
    </Sheet>
  );
}
