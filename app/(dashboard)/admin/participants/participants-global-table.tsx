"use client";

import { useState } from "react";
import Link from "next/link";
import type { GlobalParticipant } from "./page";

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-yellow-500/15 text-yellow-300",
  admin: "bg-teal/15 text-aqua",
  developer: "bg-purple-500/15 text-purple-300",
  moderator: "bg-blue-500/15 text-blue-300",
  observer: "bg-white/10 text-cloud/60",
};

export default function ParticipantsGlobalTable({
  participants,
}: {
  participants: GlobalParticipant[];
}) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const filtered = participants.filter((p) => {
    const name = p.preferred_name
      ? `${p.preferred_name} ${p.last_name}`
      : `${p.first_name} ${p.last_name}`;
    const matchesSearch =
      !search ||
      name.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase());

    const matchesRole =
      roleFilter === "all" ||
      (roleFilter === "moderator" && p.moderator_pods.length > 0) ||
      (roleFilter === "none" &&
        p.roles.length === 0 &&
        p.moderator_pods.length === 0) ||
      p.roles.includes(roleFilter);

    return matchesSearch && matchesRole;
  });

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search participants"
          className="rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-cloud/40 transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          aria-label="Role filter"
          className="rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-2 text-sm text-white transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
        >
          <option value="all">All roles</option>
          <option value="owner">Owners</option>
          <option value="admin">Admins</option>
          <option value="developer">Developers</option>
          <option value="observer">Observers</option>
          <option value="moderator">Moderators</option>
          <option value="none">No role</option>
        </select>
        <span className="text-sm text-cloud/60 tabular-nums">
          {filtered.length} of {participants.length}
        </span>
      </div>

      {/* Table */}
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
                Roles
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-cloud/60">
                Cycles
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-cloud/60">
                Moderating
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-cloud/60">
                Joined
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-cloud/60" />
            </tr>
          </thead>
          <tbody className="divide-y divide-whisper">
            {filtered.map((p) => {
              const displayName = p.preferred_name
                ? `${p.preferred_name} ${p.last_name}`
                : `${p.first_name} ${p.last_name}`;

              // Show all roles as badges
              const displayRoles = [...p.roles];
              if (
                p.moderator_pods.length > 0 &&
                !displayRoles.includes("moderator")
              ) {
                displayRoles.push("moderator");
              }

              return (
                <tr
                  key={p.id}
                  className="transition-colors duration-150 hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3 font-medium text-cloud">
                    {displayName}
                  </td>
                  <td className="px-4 py-3 text-cloud/60">{p.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {displayRoles.map((role) => (
                        <span
                          key={role}
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            ROLE_COLORS[role] ?? "bg-white/10 text-cloud/60"
                          }`}
                        >
                          {role}
                        </span>
                      ))}
                      {displayRoles.length === 0 && (
                        <span className="text-xs text-cloud/60">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {p.cycles.map((c) => (
                        <span
                          key={c.cycle_id}
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            c.status === "active"
                              ? "bg-teal/15 text-aqua"
                              : c.status === "revoked"
                                ? "bg-red/15 text-red-300"
                                : "bg-white/10 text-cloud/60"
                          }`}
                        >
                          {c.cycle_name || `Cycle ${c.cycle_id}`}
                        </span>
                      ))}
                      {p.cycles.length === 0 && (
                        <span className="text-xs text-cloud/60">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {p.moderator_pods.map((mp) => (
                        <span
                          key={mp.pod_id}
                          className="inline-flex items-center rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-300"
                        >
                          {mp.pod_name}
                        </span>
                      ))}
                      {p.moderator_pods.length === 0 && (
                        <span className="text-xs text-cloud/60">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-cloud/60 tabular-nums">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/participants/${p.id}/permissions`}
                      className="rounded bg-teal/20 px-3 py-1 text-xs font-semibold tracking-tight text-aqua transition-all duration-150 hover:bg-teal/30 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
                    >
                      Permissions
                    </Link>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-sm text-cloud/60"
                >
                  No participants match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
