"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SyncState =
  | { phase: "idle" }
  | { phase: "running" }
  | { phase: "done"; note: string }
  | { phase: "error"; note: string };

/* Admin header action: pull the Luma calendar into the events cache now
   instead of waiting for the production cron tick. */
export default function SyncEventsButton() {
  const router = useRouter();
  const [state, setState] = useState<SyncState>({ phase: "idle" });

  async function run() {
    setState({ phase: "running" });
    try {
      const res = await fetch("/api/admin/events/sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState({
          phase: "error",
          note: data.error || `Sync failed (${res.status})`,
        });
        return;
      }
      const errs = data.errors?.length ? ` · ${data.errors.length} errors` : "";
      setState({
        phase: "done",
        note: `${data.created ?? 0} new · ${data.updated ?? 0} updated${errs}`,
      });
      router.refresh();
    } catch {
      setState({ phase: "error", note: "Network error — try again." });
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        className="btn btn-ghost px-4 py-2 text-sm"
        onClick={run}
        disabled={state.phase === "running"}
      >
        {state.phase === "running" ? "Syncing…" : "Sync events from Luma"}
      </button>
      {state.phase === "done" && (
        <span className="text-sm text-teal-deep">{state.note} ✓</span>
      )}
      {state.phase === "error" && (
        <span className="text-sm text-red" role="alert">
          {state.note}
        </span>
      )}
    </span>
  );
}
