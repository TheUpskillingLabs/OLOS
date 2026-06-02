"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

/**
 * Dismiss button for an at-risk nudge card.
 *
 * Posts to /api/moderator/nudges/dismiss with { pod_id, nudge_key },
 * then triggers a router refresh so the dismissed nudge disappears
 * from the server-rendered list. The nudge will re-fire automatically
 * when the consecutive-miss run starts over after a recovery (the
 * derived nudge_key changes — see lib/moderator/nudges.ts).
 *
 * Optimistic hide: the button hides itself locally while the request
 * is in flight to avoid flicker. On error it restores and surfaces an
 * inline message.
 */
export function DismissButton({
  podId,
  nudgeKey,
}: {
  podId: number;
  nudgeKey: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onClick = async () => {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/moderator/nudges/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pod_id: podId, nudge_key: nudgeKey }),
      });
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setPending(false);
    }
  };

  if (pending) return null;

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="text-xs text-red-300" title={error}>
          retry
        </span>
      )}
      <button
        onClick={onClick}
        aria-label="Dismiss nudge"
        title="Dismiss this nudge — it will re-fire if the condition re-trips"
        className="rounded p-1.5 text-cloud/40 transition-colors hover:bg-white/[0.04] hover:text-cloud/70"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
