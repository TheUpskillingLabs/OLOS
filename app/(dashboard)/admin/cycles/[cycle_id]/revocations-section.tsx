"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ParticipantRow } from "./page";

type Revocation = {
  participant_id: number;
  reason: string;
  revocation_scope: string;
  revoked_at: string;
  revoked_systems: string[];
};

const REASON_LABELS: Record<string, string> = {
  not_in_pod: "Not in pod",
  missed_pulse_checks: "Missed pulse checks",
  reactivated: "Reactivated",
};

export default function RevocationsSection({
  cycleId,
  initialRevocations,
  participants,
}: {
  cycleId: number;
  initialRevocations: Revocation[];
  participants: ParticipantRow[];
}) {
  const [revocations, setRevocations] = useState(initialRevocations);
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkResult, setCheckResult] = useState<{
    count: number;
  } | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [reactivatingIds, setReactivatingIds] = useState<Set<number>>(
    new Set()
  );
  const [reactivatedIds, setReactivatedIds] = useState<Set<number>>(new Set());
  const [reactivateErrors, setReactivateErrors] = useState<
    Record<number, string>
  >({});
  const router = useRouter();

  const nameMap = new Map(
    participants.map((p) => [
      p.participant_id,
      p.preferred_name
        ? `${p.preferred_name} ${p.last_name}`
        : `${p.first_name} ${p.last_name}`,
    ])
  );

  async function runCheck() {
    if (
      !confirm(
        "Run inactivity check? This may revoke access for inactive participants."
      )
    )
      return;

    setCheckLoading(true);
    setCheckError(null);
    setCheckResult(null);

    const res = await fetch(`/api/revocations/check/${cycleId}`, {
      method: "POST",
    });
    setCheckLoading(false);

    if (res.ok) {
      const data = await res.json();
      const count = data.transitioned_to_inactive?.length ?? 0;
      setCheckResult({ count });

      // Refresh revocations list
      const revRes = await fetch(`/api/revocations/${cycleId}`);
      if (revRes.ok) setRevocations(await revRes.json());
      if (count > 0) router.refresh();
    } else {
      const data = await res.json();
      setCheckError(data.error ?? "Check failed");
    }
  }

  async function reactivate(participantId: number) {
    setReactivatingIds((prev) => new Set(prev).add(participantId));
    setReactivateErrors((prev) => {
      const next = { ...prev };
      delete next[participantId];
      return next;
    });

    const res = await fetch(`/api/revocations/reactivate/${participantId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cycle_id: cycleId }),
    });

    setReactivatingIds((prev) => {
      const next = new Set(prev);
      next.delete(participantId);
      return next;
    });

    if (res.ok) {
      setReactivatedIds((prev) => new Set(prev).add(participantId));
      router.refresh();
    } else {
      const data = await res.json();
      setReactivateErrors((prev) => ({
        ...prev,
        [participantId]: data.error ?? "Failed",
      }));
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={runCheck}
          disabled={checkLoading}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {checkLoading ? "Checking…" : "Run Inactivity Check"}
        </button>
        {checkResult && (
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            {checkResult.count === 0
              ? "No new revocations."
              : `${checkResult.count} participant${checkResult.count !== 1 ? "s" : ""} revoked.`}
          </span>
        )}
        {checkError && (
          <span className="text-sm text-red-600">{checkError}</span>
        )}
      </div>

      {revocations.length === 0 ? (
        <p className="text-sm text-zinc-500">No revocations for this cycle.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">
                  Participant
                </th>
                <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">
                  Reason
                </th>
                <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">
                  Revoked
                </th>
                <th className="px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
              {revocations.map((rev, i) => {
                const name =
                  nameMap.get(rev.participant_id) ??
                  `Participant ${rev.participant_id}`;
                const isReactivated = reactivatedIds.has(rev.participant_id);
                return (
                  <tr key={i}>
                    <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">
                      {name}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {REASON_LABELS[rev.reason] ?? rev.reason}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(rev.revoked_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {reactivateErrors[rev.participant_id] && (
                        <span className="mr-2 text-xs text-red-600">
                          {reactivateErrors[rev.participant_id]}
                        </span>
                      )}
                      {isReactivated ? (
                        <span className="text-xs text-green-600">
                          Reactivated
                        </span>
                      ) : (
                        <button
                          onClick={() => reactivate(rev.participant_id)}
                          disabled={reactivatingIds.has(rev.participant_id)}
                          className="rounded px-2.5 py-1 text-xs font-medium text-zinc-600 ring-1 ring-zinc-300 hover:bg-zinc-50 disabled:opacity-50 dark:text-zinc-400 dark:ring-zinc-700 dark:hover:bg-zinc-800"
                        >
                          {reactivatingIds.has(rev.participant_id)
                            ? "…"
                            : "Reactivate"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
