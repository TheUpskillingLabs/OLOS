import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  AlertTriangle,
  Code2,
  ExternalLink,
  Folder,
  Hash,
  Mail,
  Users,
} from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { resolveUserRoles, isAdmin, isModeratorForPod } from "@/lib/auth/roles";
import { StatusBadge } from "@/app/components/ui";
import { getPodDetail, type PodDetail, type RosterRow } from "@/lib/moderator/pod-detail";
import { phaseGuidance } from "@/lib/moderator/phase-guidance";
import type { Band, Trend } from "@/lib/moderator/pulse-health";
import { RosterTable } from "./roster-table";

export const dynamic = "force-dynamic";

/**
 * Per-pod view (PRD §7.1, §7.2, §7.3, §7.5, §7.6).
 *
 * Composition:
 *   - status header (pod + cycle + phase + pulse-health + close timestamp)
 *   - at-risk nudge cards (read-only — dismiss action is chunk 8)
 *   - phase guidance copy (§7.5 plain-English + close/open timestamps)
 *   - member roster (server-rendered, sorted by joined_at; filter/sort
 *     persistence is step 9)
 *   - pod resources block (§7.6 deep links + missing-resource affordance)
 *
 * Roster rows are inert here. The pulse review side panel is step 4 of
 * the build order.
 */
export default async function ModeratorPodPage({
  params,
}: {
  params: Promise<{ pod_id: string }>;
}) {
  const { pod_id } = await params;
  const podId = Number.parseInt(pod_id, 10);
  if (Number.isNaN(podId)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const serviceClient = createServiceClient();
  const userRoles = await resolveUserRoles(serviceClient, user.id);

  // Pod-scoped auth: admin (any pod) OR active moderator assignment for this pod.
  if (!isAdmin(userRoles) && !isModeratorForPod(userRoles, podId)) {
    redirect("/moderator");
  }

  const detail = await getPodDetail(serviceClient, podId);
  if (!detail) notFound();

  const atRiskMembers = detail.members.filter(
    (m) => m.pulse_status === "at_risk" && !m.is_inactive
  );

  return (
    <div className="space-y-8">
      <BackLink />
      <StatusHeader detail={detail} />

      {atRiskMembers.length > 0 && (
        <AtRiskSection
          members={atRiskMembers}
          podName={detail.name ?? `Pod ${detail.id}`}
          threshold={detail.at_risk_threshold}
        />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <PhaseGuidance detail={detail} />
        <PodResources resources={detail.resources} />
      </div>

      <RosterTable
        members={detail.members}
        podId={detail.id}
        podName={detail.name ?? `Pod ${detail.id}`}
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/moderator"
      className="inline-flex items-center gap-1.5 text-xs text-cloud/60 transition-colors hover:text-cloud"
    >
      ← All pods
    </Link>
  );
}

// ─── Status header (§7.1) ─────────────────────────────────────────────

const POD_STATUS_VARIANT: Record<string, "active" | "forming" | "inactive"> = {
  active: "active",
  forming: "forming",
  closed: "inactive",
  inactive: "inactive",
};

const BAND_TEXT: Record<Band, string> = {
  healthy: "text-white",
  warning: "text-yellow-300",
  critical: "text-red-300",
};

const TREND_ARROW: Record<Trend, string> = {
  up: "↑",
  down: "↓",
  flat: "→",
};

const TREND_COLOR: Record<Trend, string> = {
  up: "text-aqua",
  down: "text-yellow-300",
  flat: "text-cloud/50",
};

function StatusHeader({ detail }: { detail: PodDetail }) {
  const statusVariant = POD_STATUS_VARIANT[detail.status] ?? "inactive";
  return (
    <header>
      <div className="mb-1.5 text-xs uppercase tracking-widest text-cloud/40">
        {detail.cycle_name ? `${detail.cycle_name} · Pod` : "Pod"}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          {detail.name ?? `Pod ${detail.id}`}
        </h1>
        <StatusBadge variant={statusVariant} withDot>
          {detail.status}
        </StatusBadge>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 rounded-md border border-whisper bg-white/[0.02] p-5 sm:grid-cols-3">
        <div>
          <div className="mb-1 text-xs text-cloud/60">Phase</div>
          <div className="text-base font-semibold text-white">
            {detail.phase_display_name ?? "—"}
          </div>
          {detail.phase_close_at && (
            <div className="mt-1 text-xs text-cloud/60">
              {detail.phase_is_active ? "Closes" : "Opens"}:{" "}
              <span className="tabular-nums text-cloud">
                {formatDateTime(
                  detail.phase_is_active
                    ? detail.phase_close_at
                    : detail.phase_open_at ?? detail.phase_close_at
                )}
              </span>
            </div>
          )}
        </div>
        <div>
          <div className="mb-1 text-xs text-cloud/60">Pulse this week</div>
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-2xl font-bold tabular-nums ${BAND_TEXT[detail.band]}`}
            >
              {detail.missing_this_week}
            </span>
            <span className="text-xs text-cloud/50">missing</span>
            <span className={`ml-auto text-xs ${TREND_COLOR[detail.trend]}`}>
              {TREND_ARROW[detail.trend]}
            </span>
          </div>
          <div className="mt-1 text-xs text-cloud/50">
            band: {detail.band}
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs text-cloud/60">Active members</div>
          <div className="text-2xl font-bold tabular-nums text-white">
            {detail.active_member_count}
          </div>
        </div>
      </div>
    </header>
  );
}

// ─── At-risk nudges (§7.2) ────────────────────────────────────────────

function AtRiskSection({
  members,
  podName,
  threshold,
}: {
  members: RosterRow[];
  podName: string;
  threshold: number;
}) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-white">
          At-risk · needs attention
        </h2>
        <span className="text-xs text-cloud/60">
          {threshold}-pulse miss threshold
        </span>
      </div>
      <div className="space-y-3">
        {members.map((m) => (
          <AtRiskCard key={m.participant_id} member={m} podName={podName} />
        ))}
      </div>
    </section>
  );
}

function AtRiskCard({
  member,
  podName,
}: {
  member: RosterRow;
  podName: string;
}) {
  const lastActiveCopy = member.last_activity_at
    ? `last active ${daysAgo(member.last_activity_at)} days ago`
    : "no pulse activity yet";
  return (
    <div className="rounded-md border border-yellow-500/30 bg-yellow-500/[0.06] p-4">
      <div className="flex items-start gap-4">
        <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-white/[0.08] text-sm font-semibold text-cloud">
          {member.initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-sm font-semibold text-white">
              {member.display_name}
            </span>
            {member.availability_snippet && (
              <>
                <span className="text-xs text-cloud/50">·</span>
                <span className="truncate text-xs text-cloud/60">
                  {member.availability_snippet}
                </span>
              </>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-yellow-300">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium">Missed consecutive pulses</span>
            <span className="text-cloud/40">·</span>
            <span className="text-cloud/60">{lastActiveCopy}</span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2 py-0.5 text-cloud/70">
              <Users className="h-3 w-3" />
              {podName}
            </span>
          </div>
        </div>
        {member.email && (
          <a
            href={`mailto:${member.email}`}
            className="rounded bg-teal/20 px-3 py-1.5 text-xs font-medium text-aqua transition-colors hover:bg-teal/30"
          >
            Email
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Phase guidance (§7.5) ───────────────────────────────────────────

function PhaseGuidance({ detail }: { detail: PodDetail }) {
  const guidance = phaseGuidance(
    detail.phase_num as Parameters<typeof phaseGuidance>[0]
  );
  return (
    <div className="rounded-md border border-whisper bg-white/[0.02] p-6 lg:col-span-2">
      <div className="mb-1.5 text-xs uppercase tracking-widest text-teal">
        Phase guidance
      </div>
      <h3 className="mb-4 text-lg font-semibold text-white">
        {detail.phase_display_name ?? "Between phases"}
      </h3>

      {guidance ? (
        <>
          <p className="mb-3 text-sm leading-relaxed text-cloud/85">
            {guidance.description}
          </p>
          {guidance.watchFor && (
            <p className="mb-5 text-sm leading-relaxed text-cloud/70">
              {guidance.watchFor}
            </p>
          )}
        </>
      ) : (
        <p className="mb-5 text-sm leading-relaxed text-cloud/70">
          No active phase right now. Check in with your pod about what&apos;s next.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 border-t border-whisper pt-4">
        <DeadlineCell
          label={detail.phase_is_active ? "Current phase closes" : "Phase opens"}
          when={
            detail.phase_is_active
              ? detail.phase_close_at
              : detail.phase_open_at
          }
          accent={detail.phase_is_active ? "warning" : "muted"}
        />
        <DeadlineCell
          label={detail.phase_is_active ? "Phase opened" : "Phase closes"}
          when={
            detail.phase_is_active
              ? detail.phase_open_at
              : detail.phase_close_at
          }
          accent="muted"
        />
      </div>
    </div>
  );
}

function DeadlineCell({
  label,
  when,
  accent,
}: {
  label: string;
  when: string | null;
  accent: "warning" | "muted";
}) {
  if (!when) {
    return (
      <div>
        <div className="mb-1.5 text-xs uppercase tracking-widest text-cloud/40">
          {label}
        </div>
        <div className="text-sm text-cloud/60">—</div>
      </div>
    );
  }
  const days = daysUntil(when);
  return (
    <div>
      <div className="mb-1.5 text-xs uppercase tracking-widest text-cloud/40">
        {label}
      </div>
      <div className="text-sm tabular-nums text-cloud">{formatDateTime(when)}</div>
      <div
        className={`mt-1 text-xs ${
          accent === "warning" && days >= 0 && days <= 2
            ? "text-yellow-300"
            : "text-cloud/60"
        }`}
      >
        {days < 0
          ? `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`
          : days === 0
            ? "today"
            : `in ${days} day${days === 1 ? "" : "s"}`}
      </div>
    </div>
  );
}

// ─── Pod resources (§7.6) ────────────────────────────────────────────

function PodResources({
  resources,
}: {
  resources: PodDetail["resources"];
}) {
  return (
    <div className="rounded-md border border-whisper bg-white/[0.02] p-6">
      <div className="mb-4 text-xs uppercase tracking-widest text-cloud/40">
        Pod resources
      </div>
      <div className="space-y-2">
        <ResourceLink
          icon={Hash}
          label="Slack channel"
          value={
            resources.slack_channel_id ? `#${resources.slack_channel_id}` : null
          }
          href={
            resources.slack_channel_id
              ? `slack://channel?id=${resources.slack_channel_id}`
              : null
          }
        />
        <ResourceLink
          icon={Folder}
          label="Drive folder"
          value={resources.drive_folder_id}
          href={
            resources.drive_folder_id
              ? `https://drive.google.com/drive/folders/${resources.drive_folder_id}`
              : null
          }
        />
        <ResourceLink
          icon={Code2}
          label="GitHub repo"
          value={resources.github_repo_url}
          href={resources.github_repo_url}
        />
        <ResourceLink
          icon={Mail}
          label="Google Group"
          value={null}
          href={null}
          // Google Group url isn't on the pods table; flagged as missing
          // until §7.6 wiring lands.
        />
      </div>
    </div>
  );
}

function ResourceLink({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Hash;
  label: string;
  value: string | null;
  href: string | null;
}) {
  if (!href) {
    return (
      <div className="-mx-2 flex items-center gap-3 rounded-md border border-yellow-500/20 bg-yellow-500/[0.06] px-3 py-2.5">
        <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded bg-white/[0.04]">
          <Icon className="h-4 w-4 text-cloud/40" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm text-cloud/70">{label}</div>
          <div className="flex items-center gap-1.5 text-xs text-yellow-300/90">
            <AlertTriangle className="h-3 w-3" />
            Missing — contact staff
          </div>
        </div>
      </div>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group -mx-2 flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-white/[0.04]"
    >
      <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded bg-white/[0.06]">
        <Icon className="h-4 w-4 text-cloud/60 transition-colors group-hover:text-aqua" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-cloud transition-colors group-hover:text-white">
          {label}
        </div>
        {value && (
          <div className="truncate text-xs text-cloud/50">{value}</div>
        )}
      </div>
      <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-cloud/30" />
    </a>
  );
}

// ─── Date helpers ────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function daysAgo(iso: string): number {
  const diffMs = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diffMs / 86_400_000));
}

function daysUntil(iso: string): number {
  const diffMs = new Date(iso).getTime() - Date.now();
  return Math.ceil(diffMs / 86_400_000);
}
