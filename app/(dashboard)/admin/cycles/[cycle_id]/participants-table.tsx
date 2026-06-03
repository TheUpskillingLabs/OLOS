"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ParticipantRow } from "./page";

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-yellow-500/15 text-yellow-300",
  admin: "bg-teal/15 text-aqua",
  developer: "bg-purple-500/15 text-purple-300",
  moderator: "bg-blue-500/15 text-blue-300",
  observer: "bg-white/10 text-cloud/60",
};

interface Props {
  participants: ParticipantRow[];
  cycleId: number;
}

export default function ParticipantsTable({ participants, cycleId }: Props) {
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
    return <p className="text-sm text-cloud/60">No participants enrolled.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-cloud/80">
          <input
            type="checkbox"
            checked={stuckOnly}
            onChange={(e) => setStuckOnly(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-whisper bg-white/[0.04] text-teal focus:ring-1 focus:ring-teal focus:ring-offset-0"
          />
          <span>
            Show only stuck-inactive
            <span className="ml-1 text-cloud/50 tabular-nums">
              ({stuckCount})
            </span>
          </span>
        </label>
        {stuckOnly && stuckCount === 0 && (
          <span className="text-xs text-cloud/60">
            No stuck-inactive participants — every inactive row has an
            access_revocations entry.
          </span>
        )}
      </div>

      <div className="overflow-hidden rounded-md border border-whisper">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.04]">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-cloud/60">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-cloud/60">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-cloud/60">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-cloud/60">
                Pods
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-cloud/60">
                Roles
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-cloud/60" />
            </tr>
          </thead>
          <tbody className="divide-y divide-whisper">
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
                  className="transition-colors duration-150 hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3 font-medium text-cloud">
                    {displayName}
                    {isStuck && (
                      <span
                        title="Inactive with no revocation row — likely never activated"
                        className="ml-2 inline-flex items-center rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-yellow-300"
                      >
                        stuck
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-cloud/60">{p.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        p.status === "active"
                          ? "bg-teal/20 text-aqua"
                          : p.status === "revoked"
                            ? "bg-red/20 text-red-300"
                            : "bg-white/10 text-cloud/60"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-cloud/60 tabular-nums">
                    {p.pods.length}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {p.roles.map((role) => (
                        <span
                          key={role}
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            ROLE_COLORS[role] ?? "bg-white/10 text-cloud/60"
                          }`}
                        >
                          {role}
                        </span>
                      ))}
                      {p.roles.length === 0 && (
                        <span className="text-xs text-cloud/60">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-2">
                        {p.status === "inactive" && (
                          <button
                            type="button"
                            onClick={() => runReconciler(p.participant_id)}
                            disabled={isReconciling}
                            title="Re-evaluate this participant's cycle_enrollments.status against current pod-membership reality"
                            className="rounded bg-yellow-500/20 px-3 py-1 text-xs font-semibold tracking-tight text-yellow-300 transition-all duration-150 hover:bg-yellow-500/30 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 focus-visible:ring-offset-2 focus-visible:ring-offset-midnight disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isReconciling ? "Reconciling…" : "Run reconciler"}
                          </button>
                        )}
                        <Link
                          href={`/admin/participants/${p.participant_id}/permissions`}
                          className="rounded bg-teal/20 px-3 py-1 text-xs font-semibold tracking-tight text-aqua transition-all duration-150 hover:bg-teal/30 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
                        >
                          Permissions
                        </Link>
                      </div>
                      {showRowError && (
                        <p className="text-xs text-red-300">{rowError.message}</p>
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
