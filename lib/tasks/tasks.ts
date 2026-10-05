import { createServiceClient } from "@/lib/supabase/server";
import { getCycleWeek, getCycleWeekStart } from "@/lib/cycle/week";
import {
  resolveWindowStates,
  type WindowState,
} from "@/lib/cycles/windows";
import { dismissedTaskKeys } from "./dismissals";
import { assembleTasks, type TaskInputs } from "./assemble";
import type { Task } from "./types";
import { READINESS_RESOURCE_SLUGS, type ReadinessInputs } from "./readiness";
import type { OpenNowInputs } from "./open-now";
import { getEvents } from "@/lib/content/queries";
import { getPublishedSpotlights } from "@/lib/content/spotlights";

/* The thin Supabase companion to the pure assembler (the gate-logic.ts /
   gate.ts split). The dashboard page already fetches most task signals for
   its own rendering (hero, pod sections, the composer) and passes them
   through — this wrapper only reads what nothing else on the page needs:

     - cycle_phases → resolveWindowStates (the checkWindow-aligned read
       model; the page previously re-derived open-ness from legacy columns
       with its own inline loop)
     - weekly_messages + this week's log count → the "what's next" nudge
       (mirrors the learning-logs POST route's selection)
     - task_dismissals → the member's dismissed occurrence keys

   All three resolve in one Promise.all — no sequential await chain. */

export interface DashboardTaskContext {
  participantId: number;
  profileDone: boolean;
  followsAnyone: boolean;
  slackRowVisible: boolean;
  slackInviteUrl?: string | null;

  activeCycle: {
    id: number;
    name: string;
    mode: string;
    start_date: string | null;
    end_date: string | null;
  } | null;
  /** The active cycle's config row (legacy window columns) — the fallback
      source when the cycle has no phase rows yet. */
  activeCycleConfig: Record<string, string | null> | null;

  registerCycle: { id: number; name: string; upcoming: boolean } | null;
  registerOpen: boolean;
  registerDone: boolean;

  myPodCount: number;
  podLimit: number;
  logCount: number;
  pendingBaseline: { id: number; name: string } | null;
  gate: TaskInputs["gate"];
  leadershipDue: TaskInputs["leadershipDue"];

  /** The member is engaged in the active cycle (dashboard state "active")
      — the only state the what's-next nudge applies to. */
  engaged: boolean;

  /** participants.metro_id. When passed (even null), the wrapper resolves
      whether it is an ACTIVE lab and the Register task is suppressed for a
      member without one (handoff brief §6.2). Omitted = not checked. */
  metroId?: number | null;

  /** The between-cycles surfaces (#412, #413). Omit (or null) for none. */
  betweenCycles?: {
    /** Show "Still open" (the member is between cycles). */
    showOpenNow: boolean;
    /** Show the readiness card (between cycles, or engaged and
        pre-registered for the next cycle — the overlap). */
    showReadiness: boolean;
    upcomingCycle: { id: number; name: string; slug: string | null } | null;
    preRegistered: boolean;
    githubUsername: string | null;
    directoryCardDone: boolean;
    /** The most recent finished open cycle, for "See what {cycle} built". */
    lookBackCycle: { id: number; name: string } | null;
  } | null;

  now?: Date;
}

export interface DashboardTasks {
  tasks: Task[];
  /** The queue's actionable list. */
  queue: Task[];
  /** The Get-set-up rows ([] once the member hides the completed list). */
  checklist: Task[];
  /** The active cycle's window read model — the same states the tasks were
      built from, for callers that also render cycle context. */
  windowStates: WindowState[];
  dismissedKeys: ReadonlySet<string>;
  /** "Still open" rows ([] unless between cycles). */
  openNow: Task[];
  /** Readiness rows, done first ([] unless the card shows). */
  prepare: Task[];
  /** Whether metro_id points at an active lab (null when not checked). */
  labActive: boolean | null;
}

export async function dashboardTasks(
  ctx: DashboardTaskContext
): Promise<DashboardTasks> {
  const supabase = createServiceClient();
  const now = ctx.now ?? new Date();

  const [phasesResult, dismissedKeys, whatsNext, customTasks, between] =
    await Promise.all([
      ctx.activeCycle
        ? supabase
            .from("cycle_phases")
            .select("phase_key, starts_at, ends_at")
            .eq("cycle_id", ctx.activeCycle.id)
        : Promise.resolve({ data: null }),
      dismissedTaskKeys(ctx.participantId),
      resolveWhatsNext(ctx, now),
      resolveCustomTasks(ctx, now),
      resolveBetweenCycles(ctx, now),
    ]);

  const phases = phasesResult.data;
  const windowStates = ctx.activeCycle
    ? resolveWindowStates(
        phases && phases.length > 0 ? phases : null,
        ctx.activeCycleConfig,
        now
      )
    : [];

  const tasks = assembleTasks({
    profileDone: ctx.profileDone,
    followsAnyone: ctx.followsAnyone,
    slackRowVisible: ctx.slackRowVisible,
    slackInviteUrl: ctx.slackInviteUrl,
    activeCycle: ctx.activeCycle
      ? { id: ctx.activeCycle.id, name: ctx.activeCycle.name }
      : null,
    registerCycle: ctx.registerCycle,
    registerOpen: ctx.registerOpen,
    registerDone: ctx.registerDone,
    windowStates,
    myPodCount: ctx.myPodCount,
    podLimit: ctx.podLimit,
    logCount: ctx.logCount,
    pendingBaseline: ctx.pendingBaseline,
    gate: ctx.gate,
    leadershipDue: ctx.leadershipDue,
    whatsNext,
    customTasks,
    dismissedKeys,
    labActive: between.labActive ?? undefined,
    readiness: between.readiness,
    openNow: between.openNow,
  });

  return {
    tasks,
    queue: tasks.filter((t) => t.surface === "queue"),
    checklist: tasks.filter((t) => t.surface === "checklist"),
    windowStates,
    dismissedKeys,
    openNow: tasks.filter((t) => t.surface === "open_now"),
    prepare: tasks.filter((t) => t.surface === "prepare"),
    labActive: between.labActive,
  };
}

/* Between cycles (#412, #413; docs/requirements/between-cycles-dashboard.md
   §2–§3): the lab check every caller that passes metroId gets, plus the
   "Still open" and readiness sources — read only when those surfaces show,
   so the engaged dashboard pays nothing for them. */
const OPEN_NOW_EVENT_WINDOW_DAYS = 30;

async function resolveBetweenCycles(
  ctx: DashboardTaskContext,
  now: Date
): Promise<{
  labActive: boolean | null;
  readiness: ReadinessInputs | null;
  openNow: OpenNowInputs | null;
}> {
  const supabase = createServiceClient();
  const bc = ctx.betweenCycles ?? null;

  const labActivePromise: Promise<boolean | null> =
    ctx.metroId === undefined
      ? Promise.resolve(null)
      : ctx.metroId === null
        ? Promise.resolve(false)
        : Promise.resolve(
            supabase.from("metros").select("status").eq("id", ctx.metroId).maybeSingle()
          ).then(({ data }) => data?.status === "active");

  if (!bc || (!bc.showOpenNow && !bc.showReadiness)) {
    return { labActive: await labActivePromise, readiness: null, openNow: null };
  }

  const candidateSlugs = [
    READINESS_RESOURCE_SLUGS.assistant,
    READINESS_RESOURCE_SLUGS.videos,
    ...(bc.upcomingCycle?.slug
      ? [READINESS_RESOURCE_SLUGS.primerFor(bc.upcomingCycle.slug)]
      : []),
  ];

  const [labActive, waitlistResult, resourcesResult, events, surveyResult, spotlights] =
    await Promise.all([
      labActivePromise,
      bc.showReadiness
        ? supabase
            .from("metro_waitlist_signups")
            .select("created_at, metros(name)")
            .eq("participant_id", ctx.participantId)
            .order("created_at", { ascending: false })
            .limit(1)
        : Promise.resolve({ data: null }),
      bc.showReadiness
        ? supabase
            .from("resources")
            .select("slug")
            .eq("status", "published")
            .in("slug", candidateSlugs)
        : Promise.resolve({ data: null }),
      bc.showOpenNow ? getEvents() : Promise.resolve([]),
      bc.showOpenNow
        ? supabase
            .from("field_surveys")
            .select("share_slug, title")
            .eq("status", "open")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      bc.showOpenNow ? getPublishedSpotlights() : Promise.resolve([]),
    ]);

  let readiness: ReadinessInputs | null = null;
  if (bc.showReadiness) {
    const wl = (waitlistResult.data ?? [])[0] as
      | { metros: { name: string } | { name: string }[] | null }
      | undefined;
    const wlMetro = Array.isArray(wl?.metros) ? wl?.metros[0] : wl?.metros;
    readiness = {
      upcomingCycle: bc.upcomingCycle,
      preRegistered: bc.preRegistered,
      labActive: labActive === true,
      waitlistCity: wlMetro?.name ?? null,
      githubUsername: bc.githubUsername,
      directoryCardDone: bc.directoryCardDone,
      publishedSlugs: new Set(
        ((resourcesResult.data ?? []) as { slug: string }[]).map((r) => r.slug)
      ),
    };
  }

  let openNow: OpenNowInputs | null = null;
  if (bc.showOpenNow) {
    const horizon = now.getTime() + OPEN_NOW_EVENT_WINDOW_DAYS * 24 * 3600 * 1000;
    const upcomingEvents = events
      .filter((e) => {
        const t = Date.parse(e.start_at);
        return t >= now.getTime() && t <= horizon;
      })
      .map((e) => ({
        slug: e.slug,
        name: e.name,
        start_at: e.start_at,
        location_name: e.location_name,
      }));
    const story = spotlights.find((s) => !!s.slug);
    openNow = {
      events: upcomingEvents,
      lookBackCycle: bc.lookBackCycle,
      openSurvey: (surveyResult.data as { share_slug: string; title: string } | null) ?? null,
      story: story?.slug ? { slug: story.slug, name: story.name } : null,
    };
  }

  return { labActive, readiness, openNow };
}

/* Admin-authored tasks (custom_tasks, 00097): live rows inside their
   visibility window, audience-filtered — program-global rows go to
   everyone; cycle-scoped rows only to members engaged in that cycle. */
async function resolveCustomTasks(
  ctx: DashboardTaskContext,
  now: Date
): Promise<TaskInputs["customTasks"]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("custom_tasks")
    .select("id, title, detail, href, cta, cycle_id, starts_at, ends_at, pinned, dismissible")
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  const nowMs = now.getTime();
  return (data ?? [])
    .filter((t) => {
      if (t.cycle_id != null) {
        if (!ctx.engaged || t.cycle_id !== ctx.activeCycle?.id) return false;
      }
      if (t.starts_at && Date.parse(t.starts_at) > nowMs) return false;
      if (t.ends_at && Date.parse(t.ends_at) <= nowMs) return false;
      return true;
    })
    .map((t) => ({
      id: t.id,
      title: t.title,
      detail: t.detail,
      href: t.href,
      cta: t.cta,
      deadline: t.ends_at,
      pinned: t.pinned,
      dismissible: t.dismissible,
    }));
}

/* The per-week "what's next" nudge (weekly_messages — program-global, the
   cycle only supplies which week it is), surfaced only once the member has
   logged this cycle week, for a live open cycle inside its wk0→wk12
   calendar. Mirrors the learning-logs POST route's selection. */
async function resolveWhatsNext(
  ctx: DashboardTaskContext,
  now: Date
): Promise<TaskInputs["whatsNext"]> {
  const cycle = ctx.activeCycle;
  if (
    !ctx.engaged ||
    !cycle ||
    cycle.mode !== "open" ||
    !cycle.start_date ||
    !cycle.end_date
  ) {
    return null;
  }
  const start = new Date(cycle.start_date);
  const end = new Date(cycle.end_date);
  const week = getCycleWeek(now, start, end);
  if (week < 0 || week > 12) return null;

  const supabase = createServiceClient();
  const [{ data: weekMsg }, { count: weekLogCount }] = await Promise.all([
    supabase.from("weekly_messages").select("message").eq("week", week).maybeSingle(),
    supabase
      .from("learning_logs")
      .select("id", { head: true, count: "exact" })
      .eq("participant_id", ctx.participantId)
      .eq("cycle_id", cycle.id)
      .gte("created_at", getCycleWeekStart(week, start, end).toISOString()),
  ]);
  if (weekMsg?.message && (weekLogCount ?? 0) > 0) {
    return { cycleId: cycle.id, week, message: weekMsg.message };
  }
  return null;
}
