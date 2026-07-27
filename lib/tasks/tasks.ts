import { createServiceClient } from "@/lib/supabase/server";
import { getCycleWeek, getCycleWeekStart } from "@/lib/cycle/week";
import {
  resolveWindowStates,
  type WindowState,
} from "@/lib/cycles/windows";
import { dismissedTaskKeys } from "./dismissals";
import { assembleTasks, type TaskInputs } from "./assemble";
import type { Task } from "./types";

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
  fieldSurvey: { id: number; title: string; shareSlug: string } | null;
  surveyContributed: boolean;

  /** The member is engaged in the active cycle (dashboard state "active")
      — the only state the what's-next nudge applies to. */
  engaged: boolean;

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
}

export async function dashboardTasks(
  ctx: DashboardTaskContext
): Promise<DashboardTasks> {
  const supabase = createServiceClient();
  const now = ctx.now ?? new Date();

  const [phasesResult, dismissedKeys, whatsNext] = await Promise.all([
    ctx.activeCycle
      ? supabase
          .from("cycle_phases")
          .select("phase_key, starts_at, ends_at")
          .eq("cycle_id", ctx.activeCycle.id)
      : Promise.resolve({ data: null }),
    dismissedTaskKeys(ctx.participantId),
    resolveWhatsNext(ctx, now),
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
    fieldSurvey: ctx.fieldSurvey,
    surveyContributed: ctx.surveyContributed,
    whatsNext,
    dismissedKeys,
  });

  return {
    tasks,
    queue: tasks.filter((t) => t.surface === "queue"),
    checklist: tasks.filter((t) => t.surface === "checklist"),
    windowStates,
    dismissedKeys,
  };
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
