"use client";

import { useState } from "react";

/* The tester's reset card (testing pathway, 00042) — visible only on
   is_test accounts. One press (plus a typed confirm — this deletes the
   whole account journey) wipes everything and lands back on /register to
   walk the onboarding again. The tester grant is email-keyed, so the flag
   comes back automatically on re-registration. */

export default function TesterResetCard() {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reset() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/testing/reset", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Reset failed — try again.");
        return;
      }
      // Row is gone; the next navigation replays onboarding from the top.
      window.location.href = "/register";
    } catch {
      setError("Reset failed — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6 rounded-card border border-dashed border-ink/25 bg-paper px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">
            Tester account
            <span className="ml-2 rounded-sm bg-ink/[0.06] px-2 py-0.5 text-xs font-medium text-meta">
              hidden from rosters
            </span>
          </p>
          <p className="mt-0.5 text-xs text-meta">
            Reset wipes this account&rsquo;s entire journey — profile, cycle,
            pods, logs — so you can walk the onboarding again from the top.
          </p>
        </div>
        {!confirming ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setConfirming(true)}
          >
            Reset my journey
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-sm"
              style={{ background: "var(--red)", color: "#fff" }}
              disabled={busy}
              onClick={reset}
            >
              {busy ? "Resetting…" : "Yes — wipe it all"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              Keep it
            </button>
          </div>
        )}
      </div>
      {error && (
        <p className="mt-2 text-xs text-red" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
