/* The pure task assembler — the ONE place that knows what a member's tasks
   are (task-management consolidation, 2026-07). Transcribes the derivations
   that previously lived inline in app/(dashboard)/dashboard/page.tsx as
   three hand-maintained lists (checklistItems / upNextTodos / stripChips),
   which drifted in order, copy, and dismissal rules.

   No Supabase import — unit-testable without mocks (assemble.test.ts);
   lib/tasks/tasks.ts is the thin Supabase-reading companion. Deadlines stay
   raw stored strings; components format them (lib/cycles/lab-time). */

import type { PendingGate } from "@/lib/learning-logs/gate-logic";
import { windowDef, type WindowState } from "@/lib/cycles/windows";
import { parseWindow } from "@/lib/cycles/lab-time";
import type { Task } from "./types";
import { PRIORITY, TASK_COPY, SLACK_INVITE_FALLBACK, CHECKLIST_HIDE_KEY } from "./definitions";
import {
  windowTaskKey,
  weeklyLogTaskKey,
  setupTaskKey,
  cycleSetupTaskKey,
  whatsNextTaskKey,
  leadershipLogTaskKey,
  customTaskKey,
} from "./keys";

export interface TaskInputs {
  /** bio || headline set. */
  profileDone: boolean;
  /** Follows at least one other member (not pages). */
  followsAnyone: boolean;
  /** Member signed up after the Slack row shipped (see the dashboard's
      SLACK_ROW_SINCE cutoff) — older members never see the row. */
  slackRowVisible: boolean;
  /** Slack invite URL (env-configured; fallback baked in). */
  slackInviteUrl?: string | null;

  /** The running open cycle (HQ), if any. */
  activeCycle: { id: number; name: string } | null;
  /** The cohort the member should register for + whether that's a
      pre-registration (upcoming cohort) — the dashboard's registerCycle
      derivation. Null when there is nothing to register for. */
  registerCycle: { id: number; name: string; upcoming: boolean } | null;
  /** The D-10 window admits registration right now. */
  registerOpen: boolean;
  /** Already signed (or actively enrolled). */
  registerDone: boolean;

  /** resolveWindowStates() for the active cycle ([] when no cycle). */
  windowStates: WindowState[];
  myPodCount: number;
  podLimit: number;

  /** Total learning_logs rows — drives the first-log task. */
  logCount: number;
  pendingBaseline: { id: number; name: string } | null;
  gate: { active: boolean; pending: PendingGate[] };
  /** Scopes with an armed window not yet submitted this week. */
  leadershipDue: {
    tier: string;
    cycleId: number;
    podId: number | null;
    labId: number | null;
  }[];

  /** Present only when the member has logged this cycle week and an admin
      message exists for it (the wrapper mirrors the page's guard). */
  whatsNext: { cycleId: number; week: number; message: string } | null;

  /** Admin-authored tasks (custom_tasks, 00097) — already filtered by the
      wrapper to live rows within their visibility window and audience. */
  customTasks: {
    id: number;
    title: string;
    detail: string | null;
    href: string;
    cta: string | null;
    /** ends_at, doubling as the displayed deadline. */
    deadline: string | null;
    pinned: boolean;
    dismissible: boolean;
  }[];

  /** The member's task_dismissals keys. */
  dismissedKeys: ReadonlySet<string>;
}

/** Deterministic order: priority, then earliest deadline, then defId. */
function byQueueOrder(a: Task, b: Task): number {
  if (a.priority !== b.priority) return a.priority - b.priority;
  const aMs = parseWindow(a.deadline)?.getTime() ?? Infinity;
  const bMs = parseWindow(b.deadline)?.getTime() ?? Infinity;
  if (aMs !== bMs) return aMs - bMs;
  return a.defId < b.defId ? -1 : a.defId > b.defId ? 1 : 0;
}

export function assembleTasks(input: TaskInputs): Task[] {
  const tasks: Task[] = [];

  /* ── The blocking weekly gate — always first, every dashboard state ── */
  if (input.gate.active) {
    const first = input.gate.pending[0];
    tasks.push({
      defId: "weekly_log",
      kind: "weekly_log",
      instanceKey: first
        ? weeklyLogTaskKey(first.cycleId, first.dueAt)
        : "weekly_log:unknown",
      eyebrow: TASK_COPY.weeklyLog.eyebrow,
      title: TASK_COPY.weeklyLog.title,
      detail: TASK_COPY.weeklyLog.detail,
      href: "#learning-log",
      hashLink: true,
      cta: TASK_COPY.weeklyLog.cta,
      deadline: null,
      priority: PRIORITY.gate,
      tone: "urgent",
      blocking: true,
      dismissible: false,
      done: false,
      surface: "queue",
    });
  }

  /* ── Register / pre-register (leads the actionable list) ───────────── */
  if (input.registerCycle && input.registerOpen && !input.registerDone) {
    const rc = input.registerCycle;
    tasks.push({
      defId: "register",
      kind: "register",
      instanceKey: cycleSetupTaskKey("register", rc.id),
      title: `Register for ${rc.name}`,
      detail: rc.upcoming
        ? TASK_COPY.register.preDetail
        : TASK_COPY.register.joinDetail,
      href: `/cycles/${rc.id}/join`,
      cta: rc.upcoming ? TASK_COPY.register.preCta : TASK_COPY.register.joinCta,
      deadline: null,
      priority: PRIORITY.register,
      tone: "teal",
      blocking: false,
      dismissible: false,
      done: false,
      surface: "queue",
    });
  }

  /* ── Start-here: baseline, first log ────────────────────────────────── */
  if (input.pendingBaseline) {
    tasks.push({
      defId: "baseline",
      kind: "baseline",
      instanceKey: cycleSetupTaskKey("baseline", input.pendingBaseline.id),
      eyebrow: TASK_COPY.baseline.eyebrow,
      title: TASK_COPY.baseline.title,
      href: "#learning-log",
      hashLink: true,
      cta: TASK_COPY.baseline.cta,
      deadline: null,
      priority: PRIORITY.baseline,
      tone: "teal",
      blocking: false,
      dismissible: false,
      done: false,
      surface: "queue",
    });
  }

  // The first-log nudge — suppressed while the gate is active (the gate
  // card already says "log now"; two cards for one save is clutter).
  if (input.activeCycle && input.logCount === 0 && !input.gate.active) {
    tasks.push({
      defId: "first_log",
      kind: "first_log",
      instanceKey: setupTaskKey("first_log"),
      title: TASK_COPY.firstLog.title,
      href: "#learning-log",
      hashLink: true,
      cta: TASK_COPY.firstLog.cta,
      deadline: null,
      priority: PRIORITY.firstLog,
      tone: "default",
      blocking: false,
      dismissible: false,
      done: false,
      surface: "queue",
    });
  }

  /* ── The six cycle-action windows — open ones only ──────────────────── */
  if (input.activeCycle) {
    for (const state of input.windowStates) {
      if (!state.open) continue;
      // Already at the pod limit → nothing to do at register-pods.
      if (
        state.key === "pod_registration" &&
        input.myPodCount >= input.podLimit
      ) {
        continue;
      }
      const def = windowDef(state.key);
      tasks.push({
        defId: `window:${def.key}`,
        kind: "window",
        instanceKey: windowTaskKey(def.key, input.activeCycle.id),
        title: def.labels.action,
        href: `/cycles/${input.activeCycle.id}/${def.route}`,
        cta: def.taskCta,
        deadline: state.closesAt,
        priority: PRIORITY.windowBase,
        tone: "default",
        blocking: false,
        dismissible: true,
        done: false,
        surface: "queue",
      });
    }
  }

  /* ── Leadership Log (non-blocking weekly duty) ──────────────────────── */
  if (input.leadershipDue.length > 0) {
    const s = input.leadershipDue[0];
    tasks.push({
      defId: "leadership_log",
      kind: "leadership_log",
      instanceKey: leadershipLogTaskKey(s.tier, s.cycleId, s.podId, s.labId),
      eyebrow: TASK_COPY.leadership.eyebrow,
      title: TASK_COPY.leadership.title,
      detail: TASK_COPY.leadership.detail,
      href: "#leadership-log",
      hashLink: true,
      cta: TASK_COPY.leadership.cta,
      deadline: null,
      priority: PRIORITY.leadership,
      tone: "default",
      blocking: false,
      dismissible: false,
      done: false,
      surface: "queue",
    });
  }

  /* ── Admin-authored tasks (custom_tasks) ────────────────────────────── */
  for (const c of input.customTasks) {
    tasks.push({
      defId: `custom:${c.id}`,
      kind: "custom",
      instanceKey: customTaskKey(c.id),
      title: c.title,
      detail: c.detail ?? undefined,
      href: c.href,
      external: /^https?:\/\//i.test(c.href),
      hashLink: c.href.startsWith("#"),
      /* A button label is optional in the admin form but `href` is required,
         so a task authored without one used to render with no action at all
         from md: up -- the CTA row only draws when `cta` is set, and only the
         phone layout makes the title the whole-card tap target (owner flag,
         2026-08-01). Defaulting the label means no combination of admin input
         can produce a card you cannot act on. */
      cta: c.cta ?? "Open",
      deadline: c.deadline,
      priority: c.pinned ? PRIORITY.pinned : PRIORITY.custom,
      tone: c.pinned ? "teal" : "default",
      blocking: false,
      dismissible: c.dismissible,
      done: false,
      surface: "queue",
    });
  }

  /* ── The per-week "what's next" nudge ───────────────────────────────── */
  if (input.whatsNext) {
    tasks.push({
      defId: "whats_next",
      kind: "whats_next",
      instanceKey: whatsNextTaskKey(
        input.whatsNext.cycleId,
        input.whatsNext.week
      ),
      eyebrow: `This week · Week ${input.whatsNext.week}`,
      title: input.whatsNext.message,
      href: "#learning-log",
      hashLink: true,
      deadline: null,
      priority: PRIORITY.whatsNext,
      tone: "teal",
      blocking: false,
      dismissible: true,
      done: false,
      surface: "queue",
    });
  }

  /* ── The Get-set-up checklist (account housekeeping only) ───────────── */
  // Register / pod / baseline / first-log left the checklist for the queue:
  // dated cycle actions aren't housekeeping, and a stable row set is what
  // makes hiding the completed checklist safe (the "To Do list reopens when
  // a new cycle is added" bug class can't recur).
  if (!input.dismissedKeys.has(CHECKLIST_HIDE_KEY)) {
    tasks.push({
      defId: "setup:profile",
      kind: "setup",
      instanceKey: setupTaskKey("profile"),
      title: TASK_COPY.setup.profile.label,
      href: "/profile/edit",
      cta: TASK_COPY.setup.profile.cta,
      deadline: null,
      priority: PRIORITY.setupBase,
      tone: "default",
      blocking: false,
      dismissible: false,
      done: input.profileDone,
      surface: "checklist",
    });
    tasks.push({
      defId: "setup:follow",
      kind: "setup",
      instanceKey: setupTaskKey("follow"),
      title: TASK_COPY.setup.follow.label,
      href: "/directory",
      cta: TASK_COPY.setup.follow.cta,
      deadline: null,
      priority: PRIORITY.setupBase + 1,
      tone: "default",
      blocking: false,
      dismissible: false,
      done: input.followsAnyone,
      surface: "checklist",
    });
    if (input.slackRowVisible) {
      // No server-side "joined Slack" signal exists (issue #189) — the
      // row's done state IS its dismissal row, recorded when the member
      // clicks the invite. Cross-device, unlike the old localStorage flag.
      tasks.push({
        defId: "setup:slack",
        kind: "setup",
        instanceKey: setupTaskKey("slack"),
        title: TASK_COPY.setup.slack.label,
        href: input.slackInviteUrl || SLACK_INVITE_FALLBACK,
        cta: TASK_COPY.setup.slack.cta,
        external: true,
        advisory: true,
        deadline: null,
        priority: PRIORITY.setupBase + 2,
        tone: "default",
        blocking: false,
        dismissible: true,
        done: input.dismissedKeys.has(setupTaskKey("slack")),
        surface: "checklist",
      });
    }
  }

  /* ── Dismissal filter + deterministic order ─────────────────────────── */
  // Only dismissible QUEUE tasks are removed by a dismissal (a dismissed
  // key on a non-dismissible task is inert — defence against stale or
  // forged rows). Checklist rows stay: their dismissal semantics are
  // done-ness (Slack) or the whole-list hide key, handled above.
  return tasks
    .filter(
      (t) =>
        t.surface === "checklist" ||
        !t.dismissible ||
        !input.dismissedKeys.has(t.instanceKey)
    )
    .sort(byQueueOrder);
}
