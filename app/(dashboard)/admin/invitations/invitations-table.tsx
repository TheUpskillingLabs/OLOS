"use client";

import { useState } from "react";

type Invitation = {
  id: number;
  email: string;
  token: string;
  permissions: string[];
  role_preset: string | null;
  cycle_id: number | null;
  cycle_name: string | null;
  pod_id: number | null;
  status: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
};

export default function InvitationsTable({
  invitations: initialInvitations,
  cycles,
  pods,
  canManageRoles,
}: {
  invitations: Invitation[];
  cycles: { id: number; name: string }[];
  pods: { id: number; name: string; cycle_name: string }[];
  canManageRoles: boolean;
}) {
  const [invitations, setInvitations] = useState(initialInvitations);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  // Create form state
  const [email, setEmail] = useState("");
  const [rolePreset, setRolePreset] = useState<string>("");
  const [cycleId, setCycleId] = useState<string>("");
  const [podId, setPodId] = useState<string>("");

  const filtered = invitations.filter(
    (i) => statusFilter === "all" || i.status === statusFilter
  );

  async function createInvitation(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);

    const body: Record<string, unknown> = { email };
    if (rolePreset) body.role_preset = rolePreset;
    if (cycleId) body.cycle_id = parseInt(cycleId);
    if (podId) body.pod_id = parseInt(podId);

    const res = await fetch("/api/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setCreating(false);

    if (res.ok) {
      const data = await res.json();
      const cycleName = cycleId
        ? cycles.find((c) => c.id === parseInt(cycleId))?.name ?? null
        : null;
      setInvitations((prev) => [
        {
          ...data,
          permissions: data.permissions ?? [],
          cycle_name: cycleName,
        },
        ...prev,
      ]);
      setEmail("");
      setRolePreset("");
      setCycleId("");
      setPodId("");
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to create invitation");
    }
  }

  async function revokeInvitation(id: number) {
    const res = await fetch(`/api/invitations/${id}`, { method: "PATCH" });
    if (res.ok) {
      setInvitations((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: "revoked" } : i))
      );
    }
  }

  function copyLink(invitation: Invitation) {
    const link = `${window.location.origin}/login?invite=${invitation.token}`;
    navigator.clipboard.writeText(link);
    setCopied(invitation.id);
    setTimeout(() => setCopied(null), 2000);
  }

  const availablePresets = canManageRoles
    ? ["", "observer", "moderator", "admin", "developer", "owner"]
    : ["", "observer", "moderator"];

  return (
    <div className="space-y-6">
      {/* Create form */}
      <div className="rounded-md border border-whisper bg-white/[0.02] p-4">
        <h3 className="mb-3 text-sm font-semibold tracking-tight text-white">
          Create invitation
        </h3>
        <form onSubmit={createInvitation} className="flex flex-wrap items-end gap-3">
          <label className="block flex-1 min-w-[200px]">
            <span className="text-xs font-medium text-cloud/80">Email *</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="name@example.com"
              className="mt-1 block w-full rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-cloud/40 transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-cloud/80">Role Preset</span>
            <select
              value={rolePreset}
              onChange={(e) => setRolePreset(e.target.value)}
              className="mt-1 block rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-2 text-sm text-white transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
            >
              <option value="">No preset</option>
              {availablePresets
                .filter((p) => p !== "")
                .map((p) => (
                  <option key={p} value={p}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </option>
                ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-cloud/80">Cycle</span>
            <select
              value={cycleId}
              onChange={(e) => setCycleId(e.target.value)}
              className="mt-1 block rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-2 text-sm text-white transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
            >
              <option value="">None</option>
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {rolePreset === "moderator" && (
            <label className="block">
              <span className="text-xs font-medium text-cloud/80">Pod</span>
              <select
                value={podId}
                onChange={(e) => setPodId(e.target.value)}
                className="mt-1 block rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-2 text-sm text-white transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
              >
                <option value="">Select pod...</option>
                {pods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.cycle_name})
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="submit"
            disabled={creating}
            className="rounded-md bg-teal px-4 py-2 text-sm font-semibold tracking-tight text-white shadow-[0_1px_4px_rgba(0,148,160,0.2)] transition-all duration-150 ease-spring hover:bg-teal/80 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
          >
            {creating ? "Creating..." : "Create invite"}
          </button>
        </form>
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-300">
            {error}
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Status filter"
          className="rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-2 text-sm text-white transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
        >
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="expired">Expired</option>
          <option value="revoked">Revoked</option>
        </select>
        <span className="text-sm text-cloud/60 tabular-nums">
          {filtered.length} invitation{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-md border border-whisper">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.04]">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-cloud/60">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-cloud/60">
                Preset
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-cloud/60">
                Cycle
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-cloud/60">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-cloud/60">
                Created
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-cloud/60" />
            </tr>
          </thead>
          <tbody className="divide-y divide-whisper">
            {filtered.map((inv) => {
              const isExpired =
                inv.status === "pending" &&
                new Date(inv.expires_at) < new Date();

              return (
                <tr
                  key={inv.id}
                  className="transition-colors duration-150 hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3 font-medium text-cloud">
                    {inv.email}
                  </td>
                  <td className="px-4 py-3">
                    {inv.role_preset ? (
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          inv.role_preset === "owner"
                            ? "bg-yellow-500/15 text-yellow-300"
                            : inv.role_preset === "admin"
                              ? "bg-teal/15 text-aqua"
                              : inv.role_preset === "developer"
                                ? "bg-purple-500/15 text-purple-300"
                                : inv.role_preset === "moderator"
                                  ? "bg-blue-500/15 text-blue-300"
                                  : "bg-white/10 text-cloud/60"
                        }`}
                      >
                        {inv.role_preset}
                      </span>
                    ) : (
                      <span className="text-xs text-cloud/60 tabular-nums">
                        {inv.permissions.length} perm
                        {inv.permissions.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-cloud/60">
                    {inv.cycle_name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        inv.status === "accepted"
                          ? "bg-teal/20 text-aqua"
                          : inv.status === "pending" && !isExpired
                            ? "bg-yellow-500/20 text-yellow-300"
                            : "bg-white/10 text-cloud/60"
                      }`}
                    >
                      {isExpired ? "expired" : inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-cloud/60 tabular-nums">
                    {new Date(inv.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {inv.status === "pending" && !isExpired && (
                        <>
                          <button
                            onClick={() => copyLink(inv)}
                            className="rounded bg-teal/20 px-3 py-1 text-xs font-semibold tracking-tight text-aqua transition-all duration-150 hover:bg-teal/30 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
                          >
                            {copied === inv.id ? "Copied" : "Copy link"}
                          </button>
                          <button
                            onClick={() => revokeInvitation(inv.id)}
                            className="rounded ring-1 ring-whisper px-3 py-1 text-xs font-semibold tracking-tight text-cloud/80 transition-all duration-150 ease-spring hover:bg-red/10 hover:text-red-300 hover:ring-red/30 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
                          >
                            Revoke
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-cloud/60"
                >
                  No invitations match your filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
