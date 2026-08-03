"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

/**
 * Group-level dismiss for the Overview needs-attention rows (design doc §4,
 * settled 2026-08-02: ✕ at both levels). Reuses the existing per-member
 * dismiss endpoint — one POST per nudge key, no new tables — so each member
 * re-surfaces individually when their signal changes, exactly like a
 * per-member dismiss would.
 */
export function GroupDismissButton({
  podId,
  nudgeKeys,
}: {
  podId: number;
  nudgeKeys: string[];
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onClick = async () => {
    setPending(true);
    setError(null);
    try {
      for (const nudgeKey of nudgeKeys) {
        const res = await fetch("/api/moderator/nudges/dismiss", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pod_id: podId, nudge_key: nudgeKey }),
        });
        if (!res.ok && res.status !== 204) {
          throw new Error(`HTTP ${res.status}`);
        }
      }
      router.refresh();
    } catch {
      setError("Couldn't dismiss. Try again.");
      setPending(false);
    }
  };

  if (pending && !error) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={onClick}
        title="Dismiss the whole group until a signal changes"
        aria-label="Dismiss group"
        className="rounded-card p-1 text-meta-soft transition-colors hover:bg-ink/[0.04] hover:text-ink"
      >
        <X className="h-4 w-4" />
      </button>
      {error && <span className="text-xs text-red">{error}</span>}
    </span>
  );
}
