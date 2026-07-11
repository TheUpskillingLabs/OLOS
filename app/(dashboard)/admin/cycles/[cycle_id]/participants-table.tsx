"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { roleBadgeClass } from "@/lib/auth/role-colors";
import { podNoun } from "@/lib/cycle/labels";
import type { ParticipantRow } from "./page";

interface Props {
  participants: ParticipantRow[];
  cycleId: number;
  mode?: string | null;
}

export default function ParticipantsTable({
  participants,
  cycleId,
  mode,
}: Props) {
  // Org core contributors are invite-only: enrollments never go through the activation
  // pipeline the reconciler + stuck-inactive tooling exist for, so those
  // affordances only render for participant cycles.
  const isOrg = mode === "org";
  const router = useRouter();
  const [stuckOnly, setStuckOnly] = useState(false);
  // Single-flight: one reconcile in progress at a time. Drives the per-row
  // disabled state. Chosen over concurrent reconciles because (a) the
  // reconciler hits the same Postgres tables for every call, so concurrent
  // requests would compete for the same rows anyway, and (b) keeping
  // state simple avoids the complexity of tracking per-row Promise state.
  const [reconcilingId, setReconcilingId] = useState<number | null>(null);
  const [rowError, setRowError] = useState<{ id: number; message: string } | null>(
    null
  );

  const stuckCount = useMemo(
    () =>
      participants.filter((p) => p.status === "inactive" && !p.has_revocation)
        .length,
    [participants]
  );

  const visible = useMemo(() => {
    if (!stuckOnly) return participants;
    return participants.filter(
      (p) => p.status === "inactive" && !p.has_revocation
    );
  }, [participants, stuckOnly]);

  async function runReconciler(participantId: number) {
    setRowError(null);
    setReconcilingId(participantId);
    try {
      const res = await fetch(
        `/api/admin/participants/${participantId}/reconcile`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cycle_id: cycleId }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setRowError({
          id: participantId,
          message:
            typeof data?.error === "string"
              ? data.error
              : `Request failed (${res.status})`,
        });
        return;
      }
      // router.refresh() re-runs the server component's data fetch so the
      // table re-renders with the post-reconcile status. Alternative was
      // optimistic update (immediate UI flip, then sync) — rejected because
      // the reconciler's outcome depends on data we can't replicate
      // client-side (pod_memberships joined to pods.status). Authoritative
      // refresh is correct here.
      router.refresh();
    } finally {
      setReconcilingId(null);
    }
  }

  if (participants.length === 0) {
    return (
      <p className="text-sm text-meta">
        {isOrg
          ? "No core contributors enrolled yet — invite co-leads and members from the Organization page, or add registered members from the Workstreams tab."
          : "No participants enrolled."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {!isOrg && (
        <div className="flex items-center justify-between gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-charcoal">
            <input
              type="checkbox"
              checked={stuckOnly}
              onChange={(e) => setStuckOnly(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-ink/10 bg-white text-teal focus:ring-1 focus:ring-teal focus:ring-offset-0"
            />
            <span>
              Show only stuck-inactive
              <span className="ml-1 text-meta tabular-nums">
                ({stuckCount})
              </span>
            </span>
          </label>
          {stuckOnly && stuckCount === 0 && (
            <span className="text-xs text-meta">
              No stuck-inactive participants — every inactive row has an
              access_revocations entry.
            </span>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-card border border-ink/10 bg-white shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-ink/[0.02]">
            <tr>
              <th className="lbl px-4 py-3 text-left">
                Name
              </th>
              <th className="lbl px-4 py-3 text-left">
                Email
              </th>
              <th className="lbl px-4 py-3 text-left">
                Status
              </th>
              <th className="lbl px-4 py-3 text-left">
                {podNoun(mode, true)}
              </th>
              <th className="lbl px-4 py-3 text-left">
                Roles
              </th>
              <th className="lbl px-4 py-3 text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {visible.map((p) => {
              const displayName = p.preferred_name
                ? `${p.preferred_name} ${p.last_name}`
                : `${p.first_name} ${p.last_name}`;
              const isStuck = p.status === "inactive" && !p.has_revocation;
              const isReconciling = reconcilingId === p.participant_id;
              const showRowError = rowError?.id === p.participant_id;

              return (
                <tr
                  key={p.participant_id}
                  className="transition-colors duration-150 hover:bg-ink/[0.02]"
                >
                  <td className="px-4 py-3 font-medium text-ink">
                    {displayName}
                    {!isOrg && isStuck && (
                      <span
                        title="Inactive with no revocation row — likely never activated"
                        className="ml-2 inline-flex items-center rounded-sm bg-red/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red"
                      >
                        stuck
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-meta">{p.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`status ${
                        p.status === "active"
                          ? "active"
                          : p.status === "revoked"
                            ? "risk"
                            : ""
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-meta tabular-nums">
                    {p.pods.length}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {p.roles.map((role) => (
                        <span
                          key={role}
                          className={`inline-flex items-center rounded-sm px-2.5 py-0.5 text-xs font-medium ${roleBadgeClass(role)}`}
                        >
                          {role}
                        </span>
                      ))}
                      {p.roles.length === 0 && (
                        <span className="text-xs text-meta">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-2">
                        {!isOrg && p.status === "inactive" && (
                          <button
                            type="button"
                            onClick={() => runReconciler(p.participant_id)}
                            disabled={isReconciling}
                            title="Re-evaluate this participant's cycle_enrollments.status against current pod-membership reality"
                            className="rounded-card bg-red/10 px-3 py-1 text-xs font-semibold tracking-tight text-red transition-all duration-150 hover:bg-red/15 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isReconciling ? "Reconciling…" : "Run reconciler"}
                          </button>
                        )}
                        <Link
                          href={`/admin/participants/${p.participant_id}/permissions`}
                          className="rounded-card bg-teal/10 px-3 py-1 text-xs font-semibold tracking-tight text-teal-deep transition-all duration-150 hover:bg-teal/20 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                        >
                          Permissions
                        </Link>
                      </div>
                      {showRowError && (
                        <p className="text-xs text-red">{rowError.message}</p>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
