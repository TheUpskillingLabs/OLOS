"use client";

import { useState } from "react";
import type { GlobalParticipant } from "./page";

export default function ParticipantsGlobalTable({
  participants,
  isOwnerUser,
}: {
  participants: GlobalParticipant[];
  isOwnerUser: boolean;
}) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set());
  const [grantedAdminIds, setGrantedAdminIds] = useState<Set<number>>(
    new Set()
  );
  const [grantedObserverIds, setGrantedObserverIds] = useState<Set<number>>(
    new Set()
  );
  const [errors, setErrors] = useState<Record<number, string>>({});

  const filtered = participants.filter((p) => {
    const name = p.preferred_name
      ? `${p.preferred_name} ${p.last_name}`
      : `${p.first_name} ${p.last_name}`;
    const matchesSearch =
      !search ||
      name.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase());

    const effectiveRoles = [...p.roles];
    if (grantedAdminIds.has(p.id) && !effectiveRoles.includes("admin"))
      effectiveRoles.push("admin");
    if (grantedObserverIds.has(p.id) && !effectiveRoles.includes("observer"))
      effectiveRoles.push("observer");

    const matchesRole =
      roleFilter === "all" ||
      (roleFilter === "moderator" && p.moderator_pods.length > 0) ||
      (roleFilter === "none" &&
        effectiveRoles.length === 0 &&
        p.moderator_pods.length === 0) ||
      effectiveRoles.includes(roleFilter);

    return matchesSearch && matchesRole;
  });

  async function grantRole(
    participantId: number,
    role: "admin" | "observer"
  ) {
    setLoadingIds((prev) => new Set(prev).add(participantId));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[participantId];
      return next;
    });

    const res = await fetch(`/api/roles/${role}`, {
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
      if (role === "admin") {
        setGrantedAdminIds((prev) => new Set(prev).add(participantId));
      } else {
        setGrantedObserverIds((prev) => new Set(prev).add(participantId));
      }
    } else {
      const data = await res.json();
      setErrors((prev) => ({
        ...prev,
        [participantId]: data.error ?? "Failed",
      }));
    }
  }

  function getTopRole(p: GlobalParticipant): string | null {
    if (grantedAdminIds.has(p.id)) return "admin";
    if (p.roles.includes("owner")) return "owner";
    if (p.roles.includes("admin")) return "admin";
    if (grantedObserverIds.has(p.id)) return "observer";
    if (p.roles.includes("observer")) return "observer";
    if (p.moderator_pods.length > 0) return "moderator";
    return null;
  }

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
                Role
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
              const topRole = getTopRole(p);
              const hasElevated =
                p.roles.includes("owner") ||
                p.roles.includes("admin") ||
                grantedAdminIds.has(p.id);

              return (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-medium text-white">
                    {displayName}
                  </td>
                  <td className="px-4 py-3 text-cloud/60">{p.email}</td>
                  <td className="px-4 py-3">
                    {topRole && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          topRole === "owner"
                            ? "bg-yellow-500/15 text-yellow-300"
                            : topRole === "admin"
                              ? "bg-teal/15 text-aqua"
                              : topRole === "moderator"
                                ? "bg-blue-500/15 text-blue-300"
                                : "bg-white/10 text-cloud/60"
                        }`}
                      >
                        {topRole}
                      </span>
                    )}
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
                    {errors[p.id] && (
                      <span className="mr-2 text-xs text-red">
                        {errors[p.id]}
                      </span>
                    )}
                    <div className="flex items-center justify-end gap-2">
                      {!hasElevated &&
                        !p.roles.includes("observer") &&
                        !grantedObserverIds.has(p.id) && (
                          <button
                            onClick={() => grantRole(p.id, "observer")}
                            disabled={loadingIds.has(p.id)}
                            className="rounded px-2.5 py-1 text-xs font-medium text-cloud/60 ring-1 ring-whisper hover:bg-white/[0.04] hover:text-cloud disabled:opacity-50"
                          >
                            {loadingIds.has(p.id) ? "…" : "Observer"}
                          </button>
                        )}
                      {isOwnerUser && !hasElevated && (
                        <button
                          onClick={() => grantRole(p.id, "admin")}
                          disabled={loadingIds.has(p.id)}
                          className="rounded px-2.5 py-1 text-xs font-medium text-aqua ring-1 ring-teal/40 hover:bg-teal/10 hover:text-white disabled:opacity-50"
                        >
                          {loadingIds.has(p.id) ? "…" : "Admin"}
                        </button>
                      )}
                    </div>
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
