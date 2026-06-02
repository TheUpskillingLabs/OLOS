"use client";

import * as React from "react";
import { Sheet } from "@/app/components/ui";
import type { RosterRow } from "@/lib/moderator/pod-detail";
import type {
  PulseHistoryPayload,
  PulseResponse,
} from "@/lib/moderator/pulse-responses";

/**
 * Pulse review side panel (PRD §7.4 + §7.9.1 aggregate).
 *
 * Fetches the member's pulse history on open. Read-only — no mutations,
 * no outreach from inside OLOS (per PRD §7.4). The Slack DM affordance
 * is intentionally a deep link; OLOS does not send anything.
 *
 * Inactive state when no member is selected. Re-fetches whenever
 * `member` changes (clicking a different roster row).
 */

const AI_LEVEL_LABEL: Record<string, string> = {
  new: "New to AI",
  consumer: "AI consumer",
  builder: "AI builder",
  shipper: "AI shipper",
};

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "loaded"; data: PulseHistoryPayload }
  | { kind: "error"; message: string };

export function PulseReviewPanel({
  open,
  onClose,
  member,
  podId,
  podName,
}: {
  open: boolean;
  onClose: () => void;
  member: RosterRow | null;
  podId: number;
  podName: string;
}) {
  const [state, setState] = React.useState<LoadState>({ kind: "idle" });
  const [showFullCycle, setShowFullCycle] = React.useState(false);

  // Fetch whenever the selected member changes while the panel is open.
  // The pre-fetch state resets (`loading`, `showFullCycle = false`) and
  // the resolved state are all inside this effect; the React 19 lint
  // rule against synchronous setState in effects is flagged because of
  // those resets, but this is the canonical fetch-on-prop-change pattern
  // for a controlled drawer and the alternatives (Suspense + use(),
  // remount-via-key) are heavier than warranted here.
  React.useEffect(() => {
    if (!open || !member) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ kind: "loading" });
    setShowFullCycle(false);
    fetch(
      `/api/moderator/pods/${podId}/pulse-responses/${member.participant_id}`
    )
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        return (await res.json()) as PulseHistoryPayload;
      })
      .then((data) => {
        if (!cancelled) setState({ kind: "loaded", data });
      })
      .catch((err: Error) => {
        if (!cancelled) setState({ kind: "error", message: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [open, member, podId]);

  if (!member) return null;

  const aiLevel = AI_LEVEL_LABEL[member.ai_experience_level] ?? member.ai_experience_level;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={member.display_name}
      description={`${podName} · ${aiLevel}${member.availability_snippet ? ` · ${member.availability_snippet}` : ""}`}
      footer={
        <div className="flex items-center justify-between text-xs text-cloud/60">
          <span>Read-only — OLOS doesn&apos;t send messages.</span>
          {member.email && (
            <a
              href={`mailto:${member.email}`}
              className="rounded bg-teal/20 px-3 py-1.5 text-xs font-medium text-aqua transition-colors hover:bg-teal/30"
            >
              Email member
            </a>
          )}
        </div>
      }
    >
      <div className="px-6 py-5">
        {state.kind === "loading" && (
          <div className="text-sm text-cloud/60">Loading pulse history…</div>
        )}
        {state.kind === "error" && (
          <div className="rounded-md border border-red-500/30 bg-red-500/[0.06] p-4 text-sm text-red-300">
            Couldn&apos;t load pulse history: {state.message}
          </div>
        )}
        {state.kind === "loaded" && (
          <PanelBody
            data={state.data}
            showFullCycle={showFullCycle}
            onExpand={() => setShowFullCycle(true)}
          />
        )}
      </div>
    </Sheet>
  );
}

function PanelBody({
  data,
  showFullCycle,
  onExpand,
}: {
  data: PulseHistoryPayload;
  showFullCycle: boolean;
  onExpand: () => void;
}) {
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  const cutoff = fourWeeksAgo.toISOString().slice(0, 10);

  const responses = showFullCycle
    ? data.responses
    : data.responses.filter((r) => r.scheduled_date >= cutoff);

  const hiddenCount = data.responses.length - responses.length;

  return (
    <div className="space-y-6">
      <IndividualAggregateBlock data={data} />

      <section>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-widest text-cloud/40">
          Responses
        </h3>
        {responses.length === 0 ? (
          <div className="rounded-md border border-whisper bg-white/[0.02] p-4 text-sm text-cloud/60">
            No pulses in this range.
          </div>
        ) : (
          <div className="space-y-3">
            {responses.map((r) => (
              <ResponseCard key={r.scheduled_date} response={r} />
            ))}
          </div>
        )}

        {!showFullCycle && hiddenCount > 0 && (
          <button
            onClick={onExpand}
            className="mt-3 text-xs text-aqua transition-colors hover:text-white"
          >
            Show full cycle history ({hiddenCount} more)
          </button>
        )}
      </section>
    </div>
  );
}

function IndividualAggregateBlock({ data }: { data: PulseHistoryPayload }) {
  const { aggregate } = data;
  return (
    <section className="rounded-md border border-teal/20 bg-teal/[0.04] p-4">
      <div className="mb-3 text-xs uppercase tracking-widest text-aqua/80">
        Across this cycle
      </div>

      <div className="mb-4">
        <div className="mb-1.5 text-xs text-cloud/60">Engagement trajectory</div>
        {aggregate.trajectory.length === 0 ? (
          <div className="text-xs text-cloud/50">No pulses yet.</div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            {aggregate.trajectory.map((dot) => (
              <span
                key={dot.scheduled_date}
                title={`${dot.scheduled_date}: ${dot.submitted ? "submitted" : "missed"}`}
                className={`h-2.5 w-2.5 rounded-full ${
                  dot.submitted
                    ? "bg-aqua"
                    : "border border-cloud/40 bg-transparent"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-1.5 text-xs text-cloud/60">Top AI tools</div>
        {aggregate.topTools.length === 0 ? (
          <div className="text-xs text-cloud/50">None reported.</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {aggregate.topTools.map((t) => (
              <span
                key={t.tool}
                className="inline-flex items-center gap-1.5 rounded-full bg-teal/15 px-2.5 py-0.5 text-xs text-aqua"
              >
                {t.tool}
                <span className="tabular-nums opacity-80">{t.count}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ResponseCard({ response }: { response: PulseResponse }) {
  const submitted = response.completed_at !== null;
  const sr = (response.survey_responses ?? {}) as Record<string, unknown>;
  return (
    <div
      className={`rounded-md border p-4 ${
        submitted
          ? "border-whisper bg-white/[0.02]"
          : "border-yellow-500/20 bg-yellow-500/[0.04]"
      }`}
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="text-sm font-medium text-white tabular-nums">
          {formatDate(response.scheduled_date)}
        </div>
        <div
          className={`text-xs ${
            submitted ? "text-aqua" : "text-yellow-300"
          }`}
        >
          {submitted
            ? `submitted ${formatTime(response.completed_at!)}`
            : "missed"}
        </div>
      </div>

      {submitted && <ResponseFields sr={sr} />}
    </div>
  );
}

function ResponseFields({ sr }: { sr: Record<string, unknown> }) {
  return (
    <dl className="space-y-2.5 text-xs">
      <TextField sr={sr} keyName="accomplishment" label="What I did" />
      <TextField sr={sr} keyName="highlight" label="Highlight" />
      <TextField sr={sr} keyName="challenge" label="Challenge" />
      <TextField sr={sr} keyName="blockers" label="Blockers" />
      <TextField sr={sr} keyName="tailwinds" label="Tailwinds" />
      <TextField sr={sr} keyName="mitigation_strategy" label="Mitigation" />
      <TextField sr={sr} keyName="anything_else" label="Anything else" />
      <ArrayField sr={sr} keyName="tools_used" label="Tools used" />
    </dl>
  );
}

function TextField({
  sr,
  keyName,
  label,
}: {
  sr: Record<string, unknown>;
  keyName: string;
  label: string;
}) {
  const v = sr[keyName];
  if (typeof v !== "string" || !v.trim()) return null;
  return (
    <div>
      <dt className="mb-0.5 text-cloud/45 uppercase tracking-widest text-[10px]">
        {label}
      </dt>
      <dd className="whitespace-pre-wrap text-cloud/85">{v}</dd>
    </div>
  );
}

function ArrayField({
  sr,
  keyName,
  label,
}: {
  sr: Record<string, unknown>;
  keyName: string;
  label: string;
}) {
  const v = sr[keyName];
  if (!Array.isArray(v) || v.length === 0) return null;
  return (
    <div>
      <dt className="mb-0.5 text-cloud/45 uppercase tracking-widest text-[10px]">
        {label}
      </dt>
      <dd className="flex flex-wrap gap-1.5">
        {v
          .filter((x): x is string => typeof x === "string" && !!x.trim())
          .map((tool) => (
            <span
              key={tool}
              className="rounded-full bg-white/[0.06] px-2 py-0.5 text-cloud/80"
            >
              {tool}
            </span>
          ))}
      </dd>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
