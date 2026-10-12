"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Admin control for `cycle_config.invite_only` (migration 00104,
 * docs/ORG_CYCLES.md §5a). Participant cycles only — org cycles are
 * invite-only by construction. Same PATCH-and-refresh shape as
 * cycle-log-gate-form.tsx.
 */
export default function CycleInviteOnlyForm({
  cycleId,
  inviteOnly,
}: {
  cycleId: number;
  inviteOnly: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);

    const res = await fetch(`/api/cycles/${cycleId}/config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite_only: !inviteOnly }),
    });

    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to update registration mode");
    }
  }

  const readout = inviteOnly
    ? "Invite only — members join through admin invitations (Admin → People → Invitations, cycle-only invite). Self-serve registration is off and invitees skip the cycle agreement."
    : "Open — anyone in an active Local Lab can register while the registration window is open.";

  return (
    <div className="rounded-card border border-ink/10 bg-white p-4 shadow-card">
      <h3 className="mb-3 text-sm font-semibold tracking-tight text-ink">
        Registration mode
      </h3>
      <p className="mb-4 text-sm text-charcoal">{readout}</p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className="btn btn-teal px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Saving…" : inviteOnly ? "Open registration" : "Make invite only"}
        </button>
        {error && (
          <span role="alert" className="text-sm text-red">
            {error}
          </span>
        )}
      </div>
      <p className="mt-3 text-xs text-meta">
        Invite-only hides the Join / Register prompts and closes the join
        ceremony, agreement, and pod sign-up to anyone not already enrolled.
        Members already in the cycle are unaffected.
      </p>
    </div>
  );
}
