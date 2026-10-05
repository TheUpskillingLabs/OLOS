/* The central Task type — the single shape every member-facing task surface
   renders from (task-management consolidation, 2026-07).

   A Task is an OCCURRENCE: `instanceKey` (lib/tasks/keys.ts) names the
   specific recurrence a dismissal applies to, so recurring tasks re-fire
   under a new key with no timers. `surface` splits the two homes: "queue"
   tasks render in the dashboard's Up-next list (and drop out when done);
   "checklist" tasks are the Get-set-up rows (rendered when done, with a
   strikethrough).

   Pure module: types only — no Supabase, importable from client
   components. */

export type TaskKind =
  /** The blocking weekly Learning Log gate — urgent, never dismissible. */
  | "weekly_log"
  /** Register / pre-register for the cohort. */
  | "register"
  /** The one-time Week-0 baseline log. */
  | "baseline"
  /** Save your first Learning Log. */
  | "first_log"
  /** One of the six cycle-action windows (lib/cycles/windows.ts). */
  | "window"
  /** The admin-authored per-week nudge (weekly_messages). */
  | "whats_next"
  /** The org lead tiers' weekly Leadership Log (non-blocking). */
  | "leadership_log"
  /** An admin-authored task (custom_tasks, 00097 — /admin/tasks). */
  | "custom"
  /** Account housekeeping checklist rows (profile, follow, Slack). */
  | "setup"
  /** A readiness-ladder step (the between-cycles "Get ready" card, #413). */
  | "prepare"
  /** A "Still open" row — something worth doing now (#412). */
  | "open_now";

export type TaskTone = "urgent" | "teal" | "default";

export interface Task {
  /** Stable definition id — "window:voting", "setup:profile", "weekly_log". */
  defId: string;
  kind: TaskKind;
  /** Occurrence key — the dismissal/recurrence unit (lib/tasks/keys.ts). */
  instanceKey: string;
  /** Optional label line above the title ("Due", "Start here", "Leadership"). */
  eyebrow?: string;
  title: string;
  detail?: string;
  href: string;
  /** In-page anchors (#learning-log) must render as plain <a>: a Next
      <Link> soft-nav never fires hashchange, and the feed composer opens
      its Learning Log tab on hashchange. */
  hashLink?: boolean;
  /** Opens in a new tab (the Slack invite). */
  external?: boolean;
  cta?: string;
  secondaryHref?: string;
  secondaryCta?: string;
  /** The window-close / due instant as stored (naive-UTC string) — the
      component formats it via lib/cycles/lab-time; callers never do. */
  deadline: string | null;
  /** Sort weight — lower leads the queue. Bands in lib/tasks/definitions.ts. */
  priority: number;
  /** Derived from kind, never per-callsite. */
  tone: TaskTone;
  /** The weekly gate only — the layout redirect's visual counterpart. */
  blocking: boolean;
  dismissible: boolean;
  /** Checklist row with no server-side completion signal (Slack, #189):
      counted but excluded from the all-done math. */
  advisory?: boolean;
  /** Checklist rows render when done (strikethrough); queue tasks with
      done=true are simply not emitted. */
  done: boolean;
  /** Where the task renders: the Up-next queue, the Get-set-up checklist,
      or the between-cycles surfaces (docs/requirements/between-cycles-dashboard.md):
      "open_now" = the "Still open" list, "prepare" = the readiness card. */
  surface: "queue" | "checklist" | "open_now" | "prepare";

  /* ── Readiness-ladder fields ("prepare" rows; optional elsewhere) ── */
  /** One line: why this step matters (rationale before every ask). */
  why?: string;
  /** Rough minutes it takes — shown, never enforced. */
  minutes?: number;
  /** ✓ the platform can see it's done (a record), vs ○ the member's word. */
  verified?: boolean;
  /** Self-attested steps offer a reversible "Not for me". */
  skippable?: boolean;
  /** The member chose "Not for me" (counts toward progress, reversible). */
  skipped?: boolean;
  /** The dismissal key that records a skip (`…:skip`), when skippable. */
  skipKey?: string;
}
