"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format/date";

/**
 * The lab lead's invite surface (PRD-lab-lead-ux Phase 0) — three honest
 * affordances instead of one cycle-agnostic form, because a bare
 * cycle-only invite was structurally ambiguous about what it granted:
 *
 *   1. Poderator (community pod) — targets an open (community-cycle) pod.
 *      No pod_role: this is the legacy poderator-only invite path. Regular
 *      community membership never goes through invitations — it's the
 *      lab's public join link (mode 3).
 *   2. {lab} internal team — targets an org (internal-cycle) run with an
 *      explicit member/co-lead role, mirroring the admin org-cycle invite.
 *   3. Share the join link — no invitation at all; just the lab's public
 *      /local-labs/[slug] URL, which is what actually enrolls community
 *      members (sets their metro_id, enforces windows/pod limits).
 *
 * No role presets, no permission grants — POST /api/invitations rejects
 * those from non-admins, and this form never offers them.
 */

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

type InviteMode = "poderator" | "org" | "join";

export default function LabInviteForm({
  labName,
  labSlug,
  pods,
  invitations,
}: {
  labName: string;
  labSlug: string;
  pods: PodOption[];
  invitations: InvitationRow[];
}) {
  const router = useRouter();
  const [mode, setMode] = React.useState<InviteMode>("poderator");
  const [email, setEmail] = React.useState("");
  const [podId, setPodId] = React.useState("");
  const [podRole, setPodRole] = React.useState<"member" | "co_lead">("member");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState<string | null>(null);
  const [origin, setOrigin] = React.useState("");
  const [copied, setCopied] = React.useState(false);

  // SSR has no window — start empty (a relative fallback URL) and fill in
  // the real origin after mount, so hydration never mismatches. Deferred so
  // it isn't a synchronous setState in the effect body
  // (react-hooks/set-state-in-effect — see ai-summary-block.tsx).
  React.useEffect(() => {
    queueMicrotask(() => setOrigin(window.location.origin));
  }, []);

  const openPods = pods.filter((p) => p.mode === "open");
  const orgPods = pods.filter((p) => p.mode === "org");
  const modePods = mode === "org" ? orgPods : openPods;
  const selectedPod = podId
    ? modePods.find((p) => p.id === parseInt(podId, 10))
    : undefined;

  function switchMode(next: InviteMode) {
    setMode(next);
    setPodId("");
    setPodRole("member");
    setError(null);
    setSent(null);
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !selectedPod) return;
    setBusy(true);
    setError(null);
    setSent(null);
    try {
      // Bare cycle-only invites are structurally impossible from this form —
      // every submit carries a resolved pod_id, and the cycle_id it targets
      // is always derived from that pod, never chosen independently.
      const body: Record<string, unknown> = {
        email,
        cycle_id: selectedPod.cycle_id,
        pod_id: selectedPod.id,
        ...(mode === "org" ? { pod_role: podRole } : {}),
      };
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

  const joinUrl = `${origin}/local-labs/${labSlug}`;

  async function copyJoinLink() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy the link — copy it manually instead.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="seg flex-wrap" role="group" aria-label="Invitation type">
        {(
          [
            { key: "poderator" as const, label: "Poderator (community pod)" },
            { key: "org" as const, label: `${labName} internal team` },
            { key: "join" as const, label: `Share the ${labName} join link` },
          ]
        ).map((v) => (
          <button
            key={v.key}
            type="button"
            className={mode === v.key ? "active" : undefined}
            aria-pressed={mode === v.key}
            onClick={() => switchMode(v.key)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {mode === "join" && (
        <div className="space-y-3 rounded-card border border-ink/10 bg-white p-4 shadow-card">
          <p className="text-sm text-meta">
            Anyone who joins from your lab page becomes a {labName} community
            member — registration windows and pod limits are enforced
            automatically.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              readOnly
              value={joinUrl}
              aria-label="Lab join link"
              onFocus={(e) => e.currentTarget.select()}
              className={`${inputClass} min-w-[260px] flex-1`}
            />
            <button
              type="button"
              onClick={copyJoinLink}
              className="btn btn-ghost px-4 py-1.5 text-sm"
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {mode === "poderator" && (
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
            <label className="text-xs font-medium text-charcoal" htmlFor="lab-inv-pod">
              Pod
            </label>
            <select
              id="lab-inv-pod"
              required
              value={podId}
              onChange={(e) => setPodId(e.target.value)}
              disabled={openPods.length === 0}
              className={inputClass}
            >
              <option value="">Choose…</option>
              {openPods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.cycle_name})
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={busy || !email || !podId}
            className="btn btn-teal px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send invite"}
          </button>
          <p className="w-full text-xs text-meta">
            This invite makes them the pod&rsquo;s poderator — it is not a
            regular-member invite. Community members join through the
            lab&rsquo;s join link.
          </p>
          {openPods.length === 0 && (
            <p className="w-full text-xs text-meta">
              No community pods yet — pods form once enough members register.
            </p>
          )}
          {error && (
            <p role="alert" className="w-full text-xs text-red">
              {error}
            </p>
          )}
          {sent && !error && (
            <p className="w-full text-xs text-teal-deep">Invitation sent to {sent}.</p>
          )}
        </form>
      )}

      {mode === "org" && (
        <form
          onSubmit={invite}
          className="flex flex-wrap items-end gap-3 rounded-card border border-ink/10 bg-white p-4 shadow-card"
        >
          <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
            <label className="text-xs font-medium text-charcoal" htmlFor="lab-inv-org-email">
              Email
            </label>
            <input
              id="lab-inv-org-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-charcoal" htmlFor="lab-inv-org-run">
              Run
            </label>
            <select
              id="lab-inv-org-run"
              required
              value={podId}
              onChange={(e) => setPodId(e.target.value)}
              disabled={orgPods.length === 0}
              className={inputClass}
            >
              <option value="">Choose…</option>
              {orgPods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.cycle_name})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-charcoal" htmlFor="lab-inv-org-role">
              Role
            </label>
            <select
              id="lab-inv-org-role"
              value={podRole}
              onChange={(e) =>
                setPodRole(e.target.value === "co_lead" ? "co_lead" : "member")
              }
              className={inputClass}
            >
              <option value="member">Member</option>
              <option value="co_lead">Co-lead</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={busy || !email || !podId}
            className="btn btn-teal px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send invite"}
          </button>
          {orgPods.length === 0 && (
            <p className="w-full text-xs text-meta">
              No internal runs yet — create your internal cycle and charter
              runs first.
            </p>
          )}
          {error && (
            <p role="alert" className="w-full text-xs text-red">
              {error}
            </p>
          )}
          {sent && !error && (
            <p className="w-full text-xs text-teal-deep">Invitation sent to {sent}.</p>
          )}
        </form>
      )}

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
