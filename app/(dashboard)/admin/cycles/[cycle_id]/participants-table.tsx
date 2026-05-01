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
          {participants.map((p) => {
            const displayName = p.preferred_name
              ? `${p.preferred_name} ${p.last_name}`
              : `${p.first_name} ${p.last_name}`;

            return (
              <tr
                key={p.participant_id}
                className="transition-colors duration-150 hover:bg-white/[0.02]"
              >
                <td className="px-4 py-3 font-medium text-cloud">
                  {displayName}
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
                  <Link
                    href={`/admin/participants/${p.participant_id}/permissions`}
                    className="rounded bg-teal/20 px-3 py-1 text-xs font-semibold tracking-tight text-aqua transition-all duration-150 hover:bg-teal/30 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
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
