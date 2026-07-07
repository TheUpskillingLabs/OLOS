"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/app/components/ui";
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
  const [checkResult, setCheckResult] = useState<{ count: number } | null>(
    null
  );
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
          className="btn btn-ghost px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {checkLoading ? "Checking…" : "Run inactivity check"}
        </button>
        {checkResult && (
          <span className="text-sm text-charcoal tabular-nums">
            {checkResult.count === 0
              ? "No new revocations."
              : `${checkResult.count} participant${checkResult.count !== 1 ? "s" : ""} revoked.`}
          </span>
        )}
        {checkError && (
          <span role="alert" className="text-sm text-red">
            {checkError}
          </span>
        )}
      </div>

      <DataTable<Revocation>
        rows={revocations}
        rowKey={(_rev, i) => i}
        empty="No revocations for this cycle."
        columns={[
          {
            key: "participant",
            header: "Participant",
            className: "font-medium text-ink",
            cell: (rev) =>
              nameMap.get(rev.participant_id) ?? `Participant ${rev.participant_id}`,
          },
          {
            key: "reason",
            header: "Reason",
            className: "text-meta",
            cell: (rev) => REASON_LABELS[rev.reason] ?? rev.reason,
          },
          {
            key: "revoked",
            header: "Revoked",
            className: "text-meta tabular-nums",
            cell: (rev) => new Date(rev.revoked_at).toLocaleDateString(),
          },
          {
            key: "actions",
            header: "",
            align: "right",
            cell: (rev) => {
              const isReactivated = reactivatedIds.has(rev.participant_id);
              return (
                <>
                  {reactivateErrors[rev.participant_id] && (
                    <span role="alert" className="mr-2 text-xs text-red">
                      {reactivateErrors[rev.participant_id]}
                    </span>
                  )}
                  {isReactivated ? (
                    <span className="text-xs font-medium text-teal-deep">
                      Reactivated
                    </span>
                  ) : (
                    <button
                      onClick={() => reactivate(rev.participant_id)}
                      disabled={reactivatingIds.has(rev.participant_id)}
                      className="btn btn-ghost px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {reactivatingIds.has(rev.participant_id) ? "…" : "Reactivate"}
                    </button>
                  )}
                </>
              );
            },
          },
        ]}
      />
    </div>
  );
}
