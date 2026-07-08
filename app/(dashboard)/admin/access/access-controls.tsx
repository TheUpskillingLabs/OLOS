"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/**
 * Interactive grant/revoke for the Access console. All mutations hit
 * /api/access/roles, which routes through the single attenuating write path
 * (lib/auth/grants.ts) — so the UI never needs to know the rules; the server
 * returns a clear error if a grant isn't permitted.
 */

export type ParticipantOption = { id: number; name: string };

const inputClass =
  "rounded-card border border-ink/10 bg-white px-3 py-1.5 text-base text-ink transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal";

export function GrantRoleForm({
  participants,
  canGrantOwner,
}: {
  participants: ParticipantOption[];
  canGrantOwner: boolean;
}) {
  const router = useRouter();
  const [participantId, setParticipantId] = React.useState("");
  const [role, setRole] = React.useState("admin");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!participantId) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/access/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participant_id: parseInt(participantId, 10), role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ ok: false, text: typeof data?.error === "string" ? data.error : "Grant failed" });
        return;
      }
      setMsg({ ok: true, text: data.alreadyActive ? "Already held." : "Role granted." });
      setParticipantId("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mb-8 flex flex-wrap items-end gap-2 rounded-card border border-ink/10 bg-white p-4 shadow-card"
    >
      <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
        <label className="text-xs font-medium text-charcoal" htmlFor="grant-person">
          Grant a role to
        </label>
        <select
          id="grant-person"
          value={participantId}
          onChange={(e) => setParticipantId(e.target.value)}
          className={inputClass}
        >
          <option value="">Choose a person…</option>
          {participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-charcoal" htmlFor="grant-role">
          Role
        </label>
        <select
          id="grant-role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className={inputClass}
        >
          <option value="admin">Admin</option>
          <option value="developer">Developer</option>
          <option value="observer">Observer</option>
          {canGrantOwner && <option value="owner">Owner</option>}
        </select>
      </div>
      <button
        type="submit"
        disabled={busy || !participantId}
        className="btn btn-teal px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Granting…" : "Grant"}
      </button>
      {msg && (
        <p
          role={msg.ok ? "status" : "alert"}
          className={`w-full text-xs ${msg.ok ? "text-teal-deep" : "text-red"}`}
        >
          {msg.text}
        </p>
      )}
    </form>
  );
}

export function RoleRevokeButton({
  participantId,
  role,
  name,
}: {
  participantId: number;
  role: string;
  name: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function revoke() {
    if (!confirm(`Revoke ${role} from ${name}?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/access/roles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participant_id: participantId, role }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data?.error === "string" ? data.error : "Revoke failed");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={revoke}
        disabled={busy}
        className="rounded-card ring-1 ring-ink/10 px-2.5 py-1 text-xs font-semibold tracking-tight text-charcoal transition-all duration-150 hover:bg-red/10 hover:text-red hover:ring-red/30 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
      >
        {busy ? "…" : "Revoke"}
      </button>
      {error && <span className="text-[10px] text-red">{error}</span>}
    </span>
  );
}
