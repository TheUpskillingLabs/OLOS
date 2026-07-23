"use client";

import * as React from "react";
import type {
  RecentLog,
  RecentLogsPayload,
} from "@/lib/moderator/recent-logs";

/**
 * Learning Logs feed — the default view of the per-pod "Recent activity"
 * tab. Mirrors RecentPulsesFeed's load/paginate pattern; rendering is
 * inline because log cards are text-first (no survey payload).
 */

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "loaded"; payload: RecentLogsPayload; appending: boolean }
  | { kind: "loading-more"; payload: RecentLogsPayload }
  | { kind: "error"; message: string };

export function RecentLogsFeed({ podId }: { podId: number }) {
  const [state, setState] = React.useState<LoadState>({ kind: "idle" });

  React.useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ kind: "loading" });
    fetch(`/api/moderator/pods/${podId}/recent-logs`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        return (await res.json()) as RecentLogsPayload;
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
        `/api/moderator/pods/${podId}/recent-logs?before=${encodeURIComponent(cursor)}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const next = (await res.json()) as RecentLogsPayload;
      setState({
        kind: "loaded",
        payload: { ...next, logs: [...prev.logs, ...next.logs] },
        appending: true,
      });
    } catch (err) {
      setState({ kind: "error", message: (err as Error).message });
    }
  };

  if (state.kind === "idle" || state.kind === "loading") {
    return <p className="py-6 text-sm text-meta">Loading logs…</p>;
  }
  if (state.kind === "error") {
    return (
      <p className="py-6 text-sm text-red">
        Could not load Learning Logs: {state.message}
      </p>
    );
  }

  const { payload } = state;
  if (payload.logs.length === 0) {
    return (
      <p className="py-6 text-sm text-meta">
        No Learning Logs from this pod yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {payload.logs.map((log, i) => (
        <LogCard key={`${log.participant_id}-${log.created_at}-${i}`} log={log} />
      ))}
      {payload.nextCursor && (
        <button
          type="button"
          onClick={loadMore}
          disabled={state.kind === "loading-more"}
          className="w-full rounded-card border border-ink/10 bg-white px-3 py-2 text-sm text-charcoal shadow-card transition-colors hover:bg-ink/[0.04] disabled:opacity-60"
        >
          {state.kind === "loading-more" ? "Loading…" : "Load older"}
        </button>
      )}
    </div>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function LogCard({ log }: { log: RecentLog }) {
  const fields: { label: string; value: string | null }[] =
    log.schema_version === "v2"
      ? [
          { label: "This week", value: log.contribution },
          { label: "Learned", value: log.learned },
        ]
      : [
          { label: "Accomplished", value: log.accomplished },
          { label: "Exploring", value: log.exploring },
          { label: "Next focus", value: log.next_focus },
        ];
  const filled = fields.filter((f) => f.value?.trim());

  return (
    <div
      className={`rounded-card border p-4 ${
        log.is_blocked
          ? "border-red/20 bg-red/[0.03]"
          : "border-ink/10 bg-white shadow-card"
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal/10 text-xs font-semibold text-teal-deep">
            {log.initials}
          </span>
          <span className="text-sm font-medium text-ink">
            {log.display_name}
          </span>
          {log.is_blocked && (
            <span className="rounded-full bg-red/10 px-2 py-0.5 text-xs font-semibold text-red">
              Blocked
            </span>
          )}
        </span>
        <span className="text-xs text-meta tabular-nums">
          {formatDateTime(log.created_at)}
        </span>
      </div>
      {log.is_blocked && log.blocker_context?.trim() && (
        <p className="mb-3 text-sm text-charcoal">
          <span className="font-semibold text-red">Needs help: </span>
          {log.blocker_context}
        </p>
      )}
      {filled.length > 0 ? (
        <dl className="space-y-2">
          {filled.map((f) => (
            <div key={f.label}>
              <dt className="text-xs uppercase tracking-wide text-meta">
                {f.label}
              </dt>
              <dd className="text-sm text-charcoal">{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-meta">No written answers this week.</p>
      )}
    </div>
  );
}
