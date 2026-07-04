"use client";

import { useState } from "react";
import Link from "next/link";
import type { GlobalParticipant } from "./page";

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-ink/10 text-ink",
  admin: "bg-teal/10 text-teal-deep",
  developer: "bg-forest/10 text-forest",
  moderator: "bg-navy/10 text-navy",
  observer: "bg-ink/[0.04] text-meta",
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
          className="rounded-card border border-ink/10 bg-white px-3 py-2 text-base text-ink placeholder:text-meta transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          aria-label="Role filter"
          className="rounded-card border border-ink/10 bg-white px-3 py-2 text-base text-ink transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
        >
          <option value="all">All roles</option>
          <option value="owner">Owners</option>
          <option value="admin">Admins</option>
          <option value="developer">Developers</option>
          <option value="observer">Observers</option>
          <option value="moderator">Moderators</option>
          <option value="none">No role</option>
        </select>
        <span className="text-sm text-meta tabular-nums">
          {filtered.length} of {participants.length}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-card border border-ink/10 bg-white shadow-card">
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
                Roles
              </th>
              <th className="lbl px-4 py-3 text-left">
                Cycles
              </th>
              <th className="lbl px-4 py-3 text-left">
                Moderating
              </th>
              <th className="lbl px-4 py-3 text-left">
                Joined
              </th>
              <th className="lbl px-4 py-3 text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
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
                  className="transition-colors duration-150 hover:bg-ink/[0.02]"
                >
                  <td className="px-4 py-3 font-medium text-ink">
                    {displayName}
                  </td>
                  <td className="px-4 py-3 text-meta">{p.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {displayRoles.map((role) => (
                        <span
                          key={role}
                          className={`inline-flex items-center rounded-sm px-2.5 py-0.5 text-xs font-medium ${
                            ROLE_COLORS[role] ?? "bg-ink/[0.04] text-meta"
                          }`}
                        >
                          {role}
                        </span>
                      ))}
                      {p.is_test && (
                        <span className="inline-flex items-center rounded-sm border border-dashed border-ink/30 px-2.5 py-0.5 text-xs font-medium text-meta">
                          tester
                        </span>
                      )}
                      {displayRoles.length === 0 && !p.is_test && (
                        <span className="text-xs text-meta">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {p.cycles.map((c) => (
                        <span
                          key={c.cycle_id}
                          className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ${
                            c.status === "active"
                              ? "bg-teal/10 text-teal-deep"
                              : c.status === "revoked"
                                ? "bg-red/10 text-red"
                                : "bg-ink/[0.04] text-meta"
                          }`}
                        >
                          {c.cycle_name || `Cycle ${c.cycle_id}`}
                        </span>
                      ))}
                      {p.cycles.length === 0 && (
                        <span className="text-xs text-meta">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {p.moderator_pods.map((mp) => (
                        <span
                          key={mp.pod_id}
                          className="inline-flex items-center rounded-sm bg-navy/10 px-2 py-0.5 text-xs font-medium text-navy"
                        >
                          {mp.pod_name}
                        </span>
                      ))}
                      {p.moderator_pods.length === 0 && (
                        <span className="text-xs text-meta">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-meta tabular-nums">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/participants/${p.id}/permissions`}
                      className="rounded-card bg-teal/10 px-3 py-1 text-xs font-semibold tracking-tight text-teal-deep transition-all duration-150 hover:bg-teal/20 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
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
                  className="px-4 py-8 text-center text-sm text-meta"
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
