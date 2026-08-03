import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { RosterRow } from "@/lib/moderator/pod-detail";
import type { BlockedMember } from "@/lib/moderator/log-health";
import { DismissButton } from "./dismiss-button";
import { GroupDismissButton } from "./group-dismiss-button";

/**
 * The Overview triage list (design doc §3/§4): ONE row per signal instead of
 * one card per member — the live pod's sixteen identical at-risk cards
 * collapse into a single expandable group with a facepile, "Email all"
 * (mailto: with every address in BCC — settled 2026-08-02, no new email
 * infrastructure), and dismiss at both the group and member level. Trending
 * members, blocked logs, and unread feedback get their own rows with jump
 * links. Unblock what you can, grade nothing.
 */

function mailtoAll(emails: string[]): string {
  // BCC so members don't see each other's addresses. Note: some mail
  // clients cap mailto URLs around 2k chars; fine at pod scale.
  return `mailto:?bcc=${emails.map(encodeURIComponent).join(",")}`;
}

function Facepile({ members }: { members: RosterRow[] }) {
  const shown = members.slice(0, 5);
  const extra = members.length - shown.length;
  return (
    <span className="inline-flex items-center align-middle">
      {shown.map((m) => (
        <span
          key={m.participant_id}
          className="-ml-1.5 grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-teal/15 text-[9px] font-bold text-teal-deep first:ml-0"
        >
          {m.initials}
        </span>
      ))}
      {extra > 0 && (
        <span className="-ml-1.5 grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-ink/[0.06] text-[9px] font-bold text-meta">
          +{extra}
        </span>
      )}
    </span>
  );
}

export function NeedsAttention({
  podId,
  atRisk,
  trending,
  blocked,
  newFeedbackCount,
  threshold,
}: {
  podId: number;
  atRisk: RosterRow[];
  trending: RosterRow[];
  blocked: BlockedMember[];
  newFeedbackCount: number;
  threshold: number;
}) {
  const total = atRisk.length + trending.length + blocked.length + newFeedbackCount;
  if (total === 0) {
    return (
      <section className="mb-6 rounded-card border border-ink/10 bg-white p-5 shadow-card">
        <h2 className="t-h3 text-ink">Needs attention</h2>
        <p className="mt-2 text-sm text-meta">
          Nothing right now — everyone&rsquo;s logging and nothing is flagged.
        </p>
      </section>
    );
  }

  const atRiskEmails = atRisk
    .map((m) => m.email)
    .filter((e): e is string => !!e);
  const nudgeKeys = atRisk
    .map((m) => m.nudge_key)
    .filter((k): k is string => !!k);

  const base = `/moderator/pods/${podId}`;

  return (
    <section className="mb-6 rounded-card border border-ink/10 border-l-[3px] border-l-red bg-white p-5 shadow-card">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="t-h3 text-ink">Needs attention</h2>
        <span className="text-xs text-meta">{threshold}-log miss threshold</span>
      </div>

      <div className="mt-2 divide-y divide-ink/10">
        {/* ── At-risk group: one row for the whole cohort ── */}
        {atRisk.length > 0 && (
          <details className="group py-3">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3">
              <span className="rounded-sm bg-red/10 px-2 py-0.5 text-[10px] font-bold tracking-wide text-red">
                AT RISK
              </span>
              <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                {atRisk.length} {atRisk.length === 1 ? "member" : "members"}
                <Facepile members={atRisk} />
              </span>
              <span className="min-w-[200px] flex-1 text-sm text-slate">
                Missed consecutive Learning Logs
                <span className="ml-1 text-xs text-meta-soft group-open:hidden">
                  · expand
                </span>
              </span>
              <span className="flex items-center gap-2.5">
                {atRiskEmails.length > 0 && (
                  <a
                    href={mailtoAll(atRiskEmails)}
                    className="rounded-card bg-teal-deep px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-teal"
                  >
                    Email all {atRiskEmails.length}
                  </a>
                )}
                <Link
                  href={`${base}/roster`}
                  className="text-xs font-semibold text-teal-deep hover:brightness-110"
                >
                  View in roster →
                </Link>
                {nudgeKeys.length > 0 && (
                  <GroupDismissButton podId={podId} nudgeKeys={nudgeKeys} />
                )}
              </span>
            </summary>
            <ul className="ml-2 mt-2 space-y-1 border-l-2 border-ink/10 pl-4">
              {atRisk.map((m) => (
                <li key={m.participant_id} className="flex items-center gap-3 py-1 text-sm">
                  <span className="min-w-[120px] font-semibold text-ink">
                    {m.display_name}
                  </span>
                  <span className="flex-1 text-slate">
                    {m.last_activity_at
                      ? `last active ${daysAgoLabel(m.last_activity_at)}`
                      : "no log activity yet"}
                  </span>
                  {m.email && (
                    <a
                      href={`mailto:${m.email}`}
                      className="rounded-card border border-teal/40 px-2.5 py-1 text-xs font-medium text-teal-deep transition-colors hover:bg-teal/10"
                    >
                      Email
                    </a>
                  )}
                  {m.nudge_key && (
                    <DismissButton podId={podId} nudgeKey={m.nudge_key} />
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}

        {/* ── Trending: one miss from at-risk ── */}
        {trending.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 py-3">
            <span className="rounded-sm bg-amber-100 px-2 py-0.5 text-[10px] font-bold tracking-wide text-amber-700">
              TRENDING
            </span>
            <span className="text-sm font-semibold text-ink">
              {trending.map((m) => m.display_name).join(", ")}
            </span>
            <span className="min-w-[160px] flex-1 text-sm text-slate">
              One miss from at-risk
            </span>
            <Link
              href={`${base}/roster`}
              className="text-xs font-semibold text-teal-deep hover:brightness-110"
            >
              View →
            </Link>
          </div>
        )}

        {/* ── Blocked: latest log says stuck, in their own words ── */}
        {blocked.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 py-3">
            <span className="rounded-sm bg-amber-100 px-2 py-0.5 text-[10px] font-bold tracking-wide text-amber-700">
              BLOCKED
            </span>
            <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
              {blocked.map((b) => b.display_name).join(", ")}
            </span>
            <span className="min-w-[160px] flex-1 truncate text-sm text-slate">
              {blocked[0].blocker_context
                ? `“${blocked[0].blocker_context}”`
                : "Latest log flagged blocked"}
            </span>
            <Link
              href={`${base}/logs`}
              className="text-xs font-semibold text-teal-deep hover:brightness-110"
            >
              Open logs →
            </Link>
          </div>
        )}

        {/* ── Unread feedback ── */}
        {newFeedbackCount > 0 && (
          <div className="flex flex-wrap items-center gap-3 py-3">
            <span className="rounded-sm bg-teal/10 px-2 py-0.5 text-[10px] font-bold tracking-wide text-teal-deep">
              FEEDBACK
            </span>
            <span className="text-sm font-semibold text-ink">
              {newFeedbackCount} new {newFeedbackCount === 1 ? "item" : "items"}
            </span>
            <span className="min-w-[160px] flex-1 text-sm text-slate">
              Flagged through the feedback widget
            </span>
            <Link
              href={`${base}/feedback`}
              className="text-xs font-semibold text-teal-deep hover:brightness-110"
            >
              Read →
            </Link>
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-meta-soft">
        Dismissing hides a member (or the group) until the signal changes.
        Unblock what you can, grade nothing.
      </p>
    </section>
  );
}

function daysAgoLabel(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "1 day ago" : `${days} days ago`;
}
