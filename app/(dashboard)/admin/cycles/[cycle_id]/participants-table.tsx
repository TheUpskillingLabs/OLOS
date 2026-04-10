"use client";

import Link from "next/link";
import type { ParticipantRow } from "./page";

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-yellow-500/15 text-yellow-300",
  admin: "bg-teal/15 text-aqua",
  developer: "bg-purple-500/15 text-purple-300",
  moderator: "bg-blue-500/15 text-blue-300",
  observer: "bg-white/10 text-cloud/60",
};

export default function ParticipantsTable({
  participants,
}: {
  participants: ParticipantRow[];
}) {
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
              Roles
            </th>
            <th className="px-4 py-3 text-right font-medium text-cloud/60" />
          </tr>
        </thead>
        <tbody className="divide-y divide-whisper">
          {participants.map((p) => {
            const displayName = p.preferred_name
              ? `${p.preferred_name} ${p.last_name}`
              : `${p.first_name} ${p.last_name}`;

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
                  <div className="flex flex-wrap gap-1">
                    {p.roles.map((role) => (
                      <span
                        key={role}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          ROLE_COLORS[role] ?? "bg-white/10 text-cloud/60"
                        }`}
                      >
                        {role}
                      </span>
                    ))}
                    {p.roles.length === 0 && (
                      <span className="text-xs text-cloud/30">—</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/participants/${p.participant_id}/permissions`}
                    className="rounded px-2.5 py-1 text-xs font-medium text-aqua ring-1 ring-teal/40 hover:bg-teal/10"
                  >
                    Permissions
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
