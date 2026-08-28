"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/* Self-serve exit, on the project page itself (success-team feedback,
   ratified 2026-08-27): a member shouldn't have to back out to the dashboard
   and re-enter the registration page to leave a project. Withdrawal is
   allowed any time the cycle is live — the DELETE route enforces that (and
   stamps left_at, so the leave is audited); this button only renders for an
   active member of the project. Two-step confirm, no modal: the destructive
   action arms on first click and fires on the second, mirroring the calm
   button grammar used elsewhere. */
export default function WithdrawButton({ projectId }: { projectId: number }) {
  const router = useRouter();
  const [arming, setArming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function withdraw() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/register`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Could not withdraw. Try again.");
        setArming(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Try again.");
      setArming(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {!arming ? (
        <button
          type="button"
          onClick={() => setArming(true)}
          className="btn btn-ghost btn-sm"
        >
          Withdraw from project
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={withdraw}
            disabled={busy}
            className="btn btn-sm border border-red/30 bg-red/10 text-red transition-colors duration-150 hover:bg-red/20 disabled:opacity-50"
          >
            {busy ? "Withdrawing..." : "Confirm withdraw"}
          </button>
          <button
            type="button"
            onClick={() => setArming(false)}
            disabled={busy}
            className="text-sm text-slate transition-colors duration-150 hover:text-ink"
          >
            Keep my spot
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-red">
          {error}
        </p>
      )}
    </div>
  );
}
