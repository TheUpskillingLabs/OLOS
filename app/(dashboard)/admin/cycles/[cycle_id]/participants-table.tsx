"use client";

import { useState } from "react";
import type { ParticipantRow } from "./page";

export default function ParticipantsTable({
  participants,
}: {
  participants: ParticipantRow[];
}) {
  const [grantedIds, setGrantedIds] = useState<Set<number>>(new Set());
  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set());
  const [errors, setErrors] = useState<Record<number, string>>({});

  async function grantObserver(participantId: number) {
    setLoadingIds((prev) => new Set(prev).add(participantId));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[participantId];
      return next;
    });

    const res = await fetch("/api/roles/observer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participant_id: participantId }),
    });

    setLoadingIds((prev) => {
      const next = new Set(prev);
      next.delete(participantId);
      return next;
    });

    if (res.ok) {
      setGrantedIds((prev) => new Set(prev).add(participantId));
    } else {
      const data = await res.json();
      setErrors((prev) => ({
        ...prev,
        [participantId]: data.error ?? "Failed",
      }));
    }
  }

  if (participants.length === 0) {
    return <p className="text-sm text-cloud/60">No participants enrolled.</p>;
  }

  return (
    <div className="overflow-hidden rounded-md border border-whisper">
      <table className="w-full text-sm">
        <thead className="bg-white/[0.04]">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-cloud/60">
              Name
            </th>
            <th className="px-4 py-3 text-left font-medium text-cloud/60">
              Email
            </th>
            <th className="px-4 py-3 text-left font-medium text-cloud/60">
              Status
            </th>
            <th className="px-4 py-3 text-left font-medium text-cloud/60">
              Pods
            </th>
            <th className="px-4 py-3 text-left font-medium text-cloud/60">
              Role
            </th>
            <th className="px-4 py-3 text-right font-medium text-cloud/60" />
          </tr>
        </thead>
        <tbody className="divide-y divide-whisper">
          {participants.map((p) => {
            const displayName = p.preferred_name
              ? `${p.preferred_name} ${p.last_name}`
              : `${p.first_name} ${p.last_name}`;

            const alreadyElevated = p.roles.some((r) =>
              ["owner", "admin", "observer"].includes(r)
            );
            const justGranted = grantedIds.has(p.participant_id);

            const topRole = p.roles.includes("owner")
              ? "owner"
              : p.roles.includes("admin")
                ? "admin"
                : p.roles.includes("observer")
                  ? "observer"
                  : null;

            return (
              <tr key={p.participant_id}>
                <td className="px-4 py-3 font-medium text-white">
                  {displayName}
                </td>
                <td className="px-4 py-3 text-cloud/60">{p.email}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.status === "active"
                        ? "bg-teal/20 text-aqua"
                        : p.status === "revoked"
                          ? "bg-red/20 text-red"
                          : "bg-white/10 text-cloud/60"
                    }`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-cloud/60">{p.pods.length}</td>
                <td className="px-4 py-3">
                  {(topRole ?? justGranted) && (
                    <span className="rounded-full bg-teal/15 px-2 py-0.5 text-xs font-medium text-aqua">
                      {justGranted && !topRole ? "observer" : topRole}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {errors[p.participant_id] && (
                    <span className="mr-2 text-xs text-red">
                      {errors[p.participant_id]}
                    </span>
                  )}
                  {!alreadyElevated && !justGranted && (
                    <button
                      onClick={() => grantObserver(p.participant_id)}
                      disabled={loadingIds.has(p.participant_id)}
                      className="rounded px-2.5 py-1 text-xs font-medium text-cloud/60 ring-1 ring-whisper hover:bg-white/[0.04] hover:text-cloud disabled:opacity-50"
                    >
                      {loadingIds.has(p.participant_id)
                        ? "…"
                        : "Grant Observer"}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
