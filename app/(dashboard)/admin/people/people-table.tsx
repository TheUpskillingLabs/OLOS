"use client";

import * as React from "react";
import { DataTable } from "@/app/components/ui";
import { roleBadgeClass } from "@/lib/auth/role-colors";
import ParticipantSheet from "./participant-sheet";
import type { Person } from "./types";

/**
 * The merged global participants list. Replaces the two former participant
 * tables (global + cycle-scoped) as the single identity/roles surface — cycle
 * context is a badge, and cycle-scoped remediation (reconciler, revocations)
 * stays in the cycle workspace's People tab. Each row drills into the
 * ParticipantSheet drawer.
 */
export default function PeopleTable({
  people,
  canManageRoles,
}: {
  people: Person[];
  canManageRoles: boolean;
}) {
  const [search, setSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("all");
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const selected = people.find((p) => p.id === selectedId) ?? null;

  const filtered = people.filter((p) => {
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
          placeholder="Search by name or email…"
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
          {filtered.length} of {people.length}
        </span>
      </div>

      <DataTable<Person>
        rows={filtered}
        rowKey={(p) => p.id}
        empty="No participants match your search."
        columns={[
          {
            key: "name",
            header: "Name",
            className: "font-medium text-ink",
            cell: (p) =>
              p.preferred_name
                ? `${p.preferred_name} ${p.last_name}`
                : `${p.first_name} ${p.last_name}`,
          },
          {
            key: "email",
            header: "Email",
            className: "text-meta",
            cell: (p) => p.email,
          },
          {
            key: "roles",
            header: "Roles",
            cell: (p) => {
              const roles = [...p.roles];
              if (p.moderator_pods.length > 0 && !roles.includes("moderator")) {
                roles.push("moderator");
              }
              return (
                <div className="flex flex-wrap gap-1">
                  {roles.map((r) => (
                    <span
                      key={r}
                      className={`inline-flex items-center rounded-sm px-2.5 py-0.5 text-xs font-medium ${roleBadgeClass(r)}`}
                    >
                      {r}
                    </span>
                  ))}
                  {p.is_test && (
                    <span className="inline-flex items-center rounded-sm border border-dashed border-ink/30 px-2.5 py-0.5 text-xs font-medium text-meta">
                      tester
                    </span>
                  )}
                  {roles.length === 0 && !p.is_test && (
                    <span className="text-xs text-meta">—</span>
                  )}
                </div>
              );
            },
          },
          {
            key: "cycles",
            header: "Cycles",
            cell: (p) => (
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
                {p.cycles.length === 0 && <span className="text-xs text-meta">—</span>}
              </div>
            ),
          },
          {
            key: "moderating",
            header: "Moderating",
            cell: (p) => (
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
            ),
          },
          {
            key: "joined",
            header: "Joined",
            className: "text-meta tabular-nums",
            cell: (p) => new Date(p.created_at).toLocaleDateString(),
          },
          {
            key: "actions",
            header: "",
            align: "right",
            cell: (p) => (
              <button
                type="button"
                onClick={() => setSelectedId(p.id)}
                className="rounded-card bg-teal/10 px-3 py-1 text-xs font-semibold tracking-tight text-teal-deep transition-all duration-150 hover:bg-teal/20 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
              >
                Manage
              </button>
            ),
          },
        ]}
      />

      <ParticipantSheet
        person={selected}
        canManageRoles={canManageRoles}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
