/* Task copy + priority bands — every non-window task string lives here
   (window labels/CTAs live on the registry, lib/cycles/windows.ts, because
   windows are a cycle concept consumed by non-task surfaces too). The
   dashboard page carries no inline task copy anymore.

   Pure module: constants only. */

/** The queue's one global sort order, both breakpoints (the mobile strip is
    the same list in the same order — one component, CSS layout switch). */
export const PRIORITY = {
  /** The blocking weekly Learning Log gate — always first. */
  gate: 0,
  /** Reserved: the post-ignition non-dismissible "Your project" card
      (docs/audit/DESIGN_INTENT.md) pins here when it ships. */
  pinned: 10,
  /** Registration leads the actionable list (July 2026 feedback:
      "registration comes first"). */
  register: 20,
  baseline: 30,
  surveyContribute: 31,
  firstLog: 32,
  /** Open windows sort here + their close order (earliest close first). */
  windowBase: 40,
  leadership: 50,
  surveyShare: 52,
  whatsNext: 60,
  /** Checklist rows — ordered among themselves, never in the queue. */
  setupBase: 90,
} as const;

export const TASK_COPY = {
  weeklyLog: {
    eyebrow: "Due",
    title: "Your weekly Learning Log is due",
    detail: "Save it below and everything unlocks.",
    cta: "Log now",
  },
  baseline: {
    eyebrow: "Start here",
    title: "Complete your Cycle onboarding Learning Log",
    cta: "Log",
  },
  firstLog: {
    title: "Save your first Learning Log",
    cta: "Log",
  },
  surveyContribute: {
    eyebrow: "Start here · Field survey",
    detail:
      "Every Build Cycle starts in the field. Add what you're seeing, then share the survey with people close to the problem — your observations shape the problems this cycle takes on.",
    cta: "Contribute an observation",
    secondaryCta: "See what the cycle is finding",
  },
  surveyShare: {
    eyebrow: "Field survey · Contributed ✓",
    title: "Share the insights survey with a friend",
    detail:
      "More voices from the field keep the cycle pointed at real problems.",
    cta: "Open survey",
    secondaryCta: "Explore the answers so far",
  },
  leadership: {
    eyebrow: "Leadership",
    title: "Write your Leadership Log",
    detail: "Your weekly team reflection.",
    cta: "Write it",
  },
  register: {
    preDetail: "Pre-register now to claim your spot.",
    joinDetail: "Complete this form to join the cycle.",
    preCta: "Pre-register",
    joinCta: "Register",
  },
  setup: {
    profile: { label: "Add your bio and headline", cta: "Edit" },
    follow: { label: "Follow people you know", cta: "Find" },
    slack: { label: "Join the Slack", cta: "Join" },
  },
  windowDetailPrefix: "Open now — closes",
} as const;

export const SLACK_INVITE_FALLBACK =
  "https://join.slack.com/t/theupskillinglabs/shared_invite/zt-44hwu2dcz-VgHsBzuxUwJASbyxlqlmSQ";

/** Dismissal key for permanently hiding the completed checklist (the
    "Setup · All done" strip's Hide control) — how the checklist finally
    disappears (docs/feedback-running-list.md: "define when the To Do list
    fully dismisses"). Safe to make permanent because the row set is
    account-scoped and stable. */
export const CHECKLIST_HIDE_KEY = "setup:checklist";
