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
    return <p className="text-sm text-zinc-500">No participants enrolled.</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 dark:bg-zinc-800">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">
              Name
            </th>
            <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">
              Email
            </th>
            <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">
              Status
            </th>
            <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">
              Pods
            </th>
            <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">
              Role
            </th>
            <th className="px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
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
                <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                  {displayName}
                </td>
                <td className="px-4 py-3 text-zinc-500">{p.email}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.status === "active"
                        ? "bg-green-100 text-green-800"
                        : p.status === "revoked"
                          ? "bg-red-100 text-red-700"
                          : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-500">{p.pods.length}</td>
                <td className="px-4 py-3">
                  {(topRole ?? justGranted) && (
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900 dark:text-purple-200">
                      {justGranted && !topRole ? "observer" : topRole}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {errors[p.participant_id] && (
                    <span className="mr-2 text-xs text-red-600">
                      {errors[p.participant_id]}
                    </span>
                  )}
                  {!alreadyElevated && !justGranted && (
                    <button
                      onClick={() => grantObserver(p.participant_id)}
                      disabled={loadingIds.has(p.participant_id)}
                      className="rounded px-2.5 py-1 text-xs font-medium text-zinc-600 ring-1 ring-zinc-300 hover:bg-zinc-50 disabled:opacity-50 dark:text-zinc-400 dark:ring-zinc-700 dark:hover:bg-zinc-800"
                    >
                      {loadingIds.has(p.participant_id) ? "…" : "Grant Observer"}
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
