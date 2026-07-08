"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format/date";

/**
 * The lab lead's invite surface — a deliberately slim cousin of the admin
 * InvitationsTable: email + target cycle + optional pod (+ role on org
 * pods). No role presets, no permission grants — POST /api/invitations
 * rejects those from non-admins, and this form never offers them.
 */

type CycleOption = { id: number; name: string; mode: string };
type PodOption = {
  id: number;
  name: string;
  cycle_id: number;
  cycle_name: string;
  mode: string;
};
type InvitationRow = {
  id: number;
  email: string;
  status: string;
  pod_role: string | null;
  created_at: string;
  cycle_name: string;
};

const inputClass =
  "rounded-card border border-ink/10 bg-white px-3 py-1.5 text-base text-ink placeholder:text-meta transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal";

export default function LabInviteForm({
  cycles,
  pods,
  invitations,
}: {
  cycles: CycleOption[];
  pods: PodOption[];
  invitations: InvitationRow[];
}) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [cycleId, setCycleId] = React.useState("");
  const [podId, setPodId] = React.useState("");
  const [podRole, setPodRole] = React.useState("member");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState<string | null>(null);

  const selectedCycleId = cycleId ? parseInt(cycleId, 10) : null;
  const cyclePods = pods.filter(
    (p) => selectedCycleId === null || p.cycle_id === selectedCycleId
  );
  const selectedPod = podId ? pods.find((p) => p.id === parseInt(podId, 10)) : undefined;
  const isOrgPod = selectedPod?.mode === "org";

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !cycleId) return;
    setBusy(true);
    setError(null);
    setSent(null);
    try {
      const body: Record<string, unknown> = {
        email,
        cycle_id: parseInt(cycleId, 10),
      };
      if (podId) {
        body.pod_id = parseInt(podId, 10);
        if (isOrgPod) body.pod_role = podRole;
      }
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data?.error === "string" ? data.error : "Failed to create invitation"
        );
        return;
      }
      const sendRes = await fetch(`/api/invitations/${data.id}/send`, {
        method: "POST",
      });
      if (!sendRes.ok) {
        const sendData = await sendRes.json().catch(() => ({}));
        setError(
          typeof sendData?.error === "string"
            ? sendData.error
            : "Invitation created but the email failed to send"
        );
      } else {
        setSent(email);
      }
      setEmail("");
      setPodId("");
      setPodRole("member");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={invite}
        className="flex flex-wrap items-end gap-3 rounded-card border border-ink/10 bg-white p-4 shadow-card"
      >
        <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
          <label className="text-xs font-medium text-charcoal" htmlFor="lab-inv-email">
            Email
          </label>
          <input
            id="lab-inv-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-charcoal" htmlFor="lab-inv-cycle">
            Cycle
          </label>
          <select
            id="lab-inv-cycle"
            required
            value={cycleId}
            onChange={(e) => {
              setCycleId(e.target.value);
              setPodId("");
            }}
            className={inputClass}
          >
            <option value="">Choose…</option>
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.mode === "org" ? " (internal)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-charcoal" htmlFor="lab-inv-pod">
            Pod (optional)
          </label>
          <select
            id="lab-inv-pod"
            value={podId}
            onChange={(e) => setPodId(e.target.value)}
            className={inputClass}
          >
            <option value="">None</option>
            {cyclePods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.cycle_name})
              </option>
            ))}
          </select>
        </div>
        {podId && isOrgPod && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-charcoal" htmlFor="lab-inv-role">
              Workstream role
            </label>
            <select
              id="lab-inv-role"
              value={podRole}
              onChange={(e) => setPodRole(e.target.value)}
              className={inputClass}
            >
              <option value="member">Member</option>
              <option value="co_lead">Co-lead</option>
            </select>
          </div>
        )}
        <button
          type="submit"
          disabled={busy || !email || !cycleId}
          className="btn btn-teal px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send invite"}
        </button>
        {error && (
          <p role="alert" className="w-full text-xs text-red">
            {error}
          </p>
        )}
        {sent && !error && (
          <p className="w-full text-xs text-teal-deep">Invitation sent to {sent}.</p>
        )}
      </form>

      {invitations.length > 0 && (
        <div className="overflow-x-auto rounded-card border border-ink/10 bg-white shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-ink/[0.02]">
              <tr>
                <th className="lbl px-4 py-3 text-left">Email</th>
                <th className="lbl px-4 py-3 text-left">Cycle</th>
                <th className="lbl px-4 py-3 text-left">Role</th>
                <th className="lbl px-4 py-3 text-left">Status</th>
                <th className="lbl px-4 py-3 text-left">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {invitations.map((inv) => (
                <tr key={inv.id} className="transition-colors duration-150 hover:bg-ink/[0.02]">
                  <td className="px-4 py-3 font-medium text-ink">{inv.email}</td>
                  <td className="px-4 py-3 text-meta">{inv.cycle_name}</td>
                  <td className="px-4 py-3 text-meta">
                    {inv.pod_role === "co_lead"
                      ? "Co-lead"
                      : inv.pod_role === "member"
                        ? "Member"
                        : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`status ${inv.status === "accepted" ? "active" : inv.status === "pending" ? "soon" : ""}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-meta tabular-nums">
                    {formatDate(inv.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
