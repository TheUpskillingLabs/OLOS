"use client";

import * as React from "react";
import type {
  RecentPulse,
  RecentPulsesPayload,
} from "@/lib/moderator/recent-pulses";
import { PulseResponseCard } from "../../_components/pulse-response-card";

/**
 * "Recent pulses" feed (PRD §7.4 — read-only access to pulse responses).
 *
 * Loads on first mount via /api/moderator/pods/[pod_id]/recent-pulses,
 * shows newest-first. Cursor pagination via `Load older` — pushes the
 * oldest visible completed_at back into the API.
 *
 * The feed is intentionally simple: no filtering by member here (the
 * Members tab already lets you scope to one person via the side panel).
 * If/when cross-member filtering matters, add a select above the list.
 */

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "loaded"; payload: RecentPulsesPayload; appending: boolean }
  | { kind: "loading-more"; payload: RecentPulsesPayload }
  | { kind: "error"; message: string };

export function RecentPulsesFeed({ podId }: { podId: number }) {
  const [state, setState] = React.useState<LoadState>({ kind: "idle" });

  // Initial load.
  React.useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ kind: "loading" });
    fetch(`/api/moderator/pods/${podId}/recent-pulses`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        return (await res.json()) as RecentPulsesPayload;
      })
      .then((payload) => {
        if (!cancelled)
          setState({ kind: "loaded", payload, appending: false });
      })
      .catch((err: Error) => {
        if (!cancelled) setState({ kind: "error", message: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [podId]);

  const loadMore = async () => {
    if (state.kind !== "loaded" || !state.payload.nextCursor) return;
    const cursor = state.payload.nextCursor;
    const prev = state.payload;
    setState({ kind: "loading-more", payload: prev });
    try {
      const res = await fetch(
        `/api/moderator/pods/${podId}/recent-pulses?before=${encodeURIComponent(cursor)}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const next = (await res.json()) as RecentPulsesPayload;
      setState({
        kind: "loaded",
        payload: {
          ...next,
          pulses: [...prev.pulses, ...next.pulses],
        },
        appending: true,
      });
    } catch (err) {
      setState({ kind: "error", message: (err as Error).message });
    }
  };

  if (state.kind === "loading") {
    return <div className="text-sm text-cloud/60">Loading pulses…</div>;
  }
  if (state.kind === "error") {
    return (
      <div className="rounded-md border border-red-500/30 bg-red-500/[0.06] p-4 text-sm text-red-300">
        Couldn&apos;t load recent pulses: {state.message}
      </div>
    );
  }
  if (state.kind === "idle") return null;

  const payload =
    state.kind === "loading-more" ? state.payload : state.payload;
  const isLoadingMore = state.kind === "loading-more";

  if (payload.pulses.length === 0) {
    return (
      <div className="rounded-md border border-whisper bg-white/[0.02] p-6 text-center text-sm text-cloud/60">
        No submitted pulses in this pod yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {payload.pulses.map((p) => (
        <FeedCard key={`${p.participant_id}:${p.completed_at}`} pulse={p} />
      ))}

      {payload.nextCursor && (
        <button
          onClick={loadMore}
          disabled={isLoadingMore}
          className="w-full rounded-md border border-whisper bg-white/[0.02] py-2 text-xs text-aqua transition-colors hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoadingMore ? "Loading…" : "Load older"}
        </button>
      )}
    </div>
  );
}

function FeedCard({ pulse }: { pulse: RecentPulse }) {
  return (
    <PulseResponseCard
      response={{
        scheduled_date: pulse.scheduled_date,
        completed_at: pulse.completed_at,
        survey_responses: pulse.survey_responses,
      }}
      header={
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-white/[0.08] text-xs font-semibold text-cloud">
            {pulse.initials}
          </div>
          <div className="text-sm font-medium text-white">
            {pulse.display_name}
          </div>
        </div>
      }
    />
  );
}
