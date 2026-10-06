"use client";

import { useState } from "react";
import { withCycleIntent } from "@/lib/participants/role-intents";

/* One tap onto the waitlist for the next public Build Cycle
   (role_intents ∋ 'cycle'; lib/cycles/whats-next.ts). PATCHes the member's
   own row through the existing /api/participants/{id} route with the whole
   intents array (lib/participants/role-intents.ts). Optimistic, with an
   undo; a failed save — offline, or an admin "viewing as" (writes are
   blocked) — rolls back and says so. */

export default function WaitlistButton({
  participantId,
  intents,
  joinLabel,
  onLabel,
  promise,
}: {
  participantId: number;
  intents: string[];
  joinLabel: string;
  onLabel: string;
  promise: string;
}) {
  const [current, setCurrent] = useState<string[]>(intents);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const on = current.includes("cycle");

  const toggle = async (next: boolean) => {
    const prev = current;
    const body = withCycleIntent(prev, next);
    setCurrent(body);
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/participants/${participantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role_intents: body }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setCurrent(prev);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const btn =
    "min-h-11 rounded-card px-4 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal disabled:opacity-60";

  return (
    <div>
      {on ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-sm font-semibold text-teal-deep" role="status">
            {onLabel} ✓
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => toggle(false)}
            className={`${btn} px-2 text-xs text-meta hover:text-ink`}
          >
            Undo
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => toggle(true)}
          className={`${btn} bg-teal-deep text-white hover:bg-teal`}
        >
          {joinLabel}
        </button>
      )}
      {on && <p className="mt-1 text-xs text-meta">{promise}</p>}
      {failed && (
        <p className="mt-1 text-xs text-meta" role="status">
          That didn&apos;t save. Check your connection and try again.
        </p>
      )}
    </div>
  );
}
