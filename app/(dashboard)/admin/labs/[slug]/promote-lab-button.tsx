"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/* Promote a waitlist lab to active (docs/LOCAL_LABS.md). Confirms the side
   effect — waitlist signups become active-lab members — then POSTs the
   admin-only promote route and refreshes. Mirrors the LabLeadsPanel action
   pattern (inline busy/error, router.refresh). Rendered only for
   status='waitlist' labs inside the requireAdmin-gated /admin tree. */
export default function PromoteLabButton({
  labId,
  labName,
  waiting,
}: {
  labId: number;
  labName: string;
  waiting: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function promote() {
    if (
      !confirm(
        `Promote ${labName} to an active lab? Its ${waiting} waitlist ${
          waiting === 1 ? "signup" : "signups"
        } will become active members who can join a cycle.`
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/labs/${labId}/promote`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data?.error === "string" ? data.error : "Failed to promote lab");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={promote}
        disabled={busy}
        className="rounded-card bg-teal/10 px-3 py-1.5 text-sm font-semibold tracking-tight text-teal-deep transition-all duration-150 hover:bg-teal/20 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
      >
        {busy ? "Promoting…" : "Promote to active"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red">
          {error}
        </p>
      )}
    </div>
  );
}
