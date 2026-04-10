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
          className="rounded-md border border-whisper bg-transparent px-3 py-2 text-sm text-white placeholder:text-cloud/30 focus:border-teal/50 focus:outline-none"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-md border border-whisper bg-transparent px-3 py-2 text-sm text-white focus:border-teal/50 focus:outline-none"
        >
          <option value="all">All roles</option>
          <option value="owner">Owners</option>
          <option value="admin">Admins</option>
          <option value="developer">Developers</option>
          <option value="observer">Observers</option>
          <option value="moderator">Moderators</option>
          <option value="none">No role</option>
        </select>
        <span className="text-sm text-cloud/40">
          {filtered.length} of {participants.length}
        </span>
      </div>

      {/* Table */}
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
                Roles
              </th>
              <th className="px-4 py-3 text-left font-medium text-cloud/60">
                Cycles
              </th>
              <th className="px-4 py-3 text-left font-medium text-cloud/60">
                Moderating
              </th>
              <th className="px-4 py-3 text-left font-medium text-cloud/60">
                Joined
              </th>
              <th className="px-4 py-3 text-right font-medium text-cloud/60" />
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
                <tr key={p.id}>
                  <td className="px-4 py-3 font-medium text-white">
                    {displayName}
                  </td>
                  <td className="px-4 py-3 text-cloud/60">{p.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {displayRoles.map((role) => (
                        <span
                          key={role}
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            ROLE_COLORS[role] ?? "bg-white/10 text-cloud/60"
                          }`}
                        >
                          {role}
                        </span>
                      ))}
                      {displayRoles.length === 0 && (
                        <span className="text-xs text-cloud/30">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {p.cycles.map((c) => (
                        <span
                          key={c.cycle_id}
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            c.status === "active"
                              ? "bg-teal/10 text-aqua"
                              : c.status === "revoked"
                                ? "bg-red/10 text-red"
                                : "bg-white/5 text-cloud/40"
                          }`}
                        >
                          {c.cycle_name || `Cycle ${c.cycle_id}`}
                        </span>
                      ))}
                      {p.cycles.length === 0 && (
                        <span className="text-xs text-cloud/30">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {p.moderator_pods.map((mp) => (
                        <span
                          key={mp.pod_id}
                          className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs text-blue-300"
                        >
                          {mp.pod_name}
                        </span>
                      ))}
                      {p.moderator_pods.length === 0 && (
                        <span className="text-xs text-cloud/30">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-cloud/60">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/participants/${p.id}/permissions`}
                      className="rounded px-2.5 py-1 text-xs font-medium text-aqua ring-1 ring-teal/40 hover:bg-teal/10"
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
                  className="px-4 py-8 text-center text-cloud/40"
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
