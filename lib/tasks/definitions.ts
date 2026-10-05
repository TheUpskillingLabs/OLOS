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
  firstLog: 32,
  /** Open windows sort here + their close order (earliest close first). */
  windowBase: 40,
  leadership: 50,
  /** Admin-authored tasks (custom_tasks) — unless pinned, which sorts at
      the `pinned` band above. */
  custom: 55,
  whatsNext: 60,
  /** Checklist rows — ordered among themselves, never in the queue. */
  setupBase: 90,
  /** "Still open" rows, in source order (#412). */
  openNowBase: 200,
  /** Readiness steps, in ladder order (#413). */
  prepareBase: 300,
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

  /* ── The between-cycles surfaces (#412, #413;
        docs/requirements/between-cycles-dashboard.md §2–§3) ──────────── */

  /** "Get ready" — the readiness card. copy: K8 #457 — placeholder titles
      and why-lines from docs/roadmap/pre-registration-persona.md §4.2 until
      the knowledge repo's readiness-ladder.md is wired in verbatim. */
  prepare: {
    headingFor: (cycleName: string | null) =>
      cycleName ? `Get ready for ${cycleName}` : "Get ready for the next Build Cycle",
    progress: (done: number, shown: number) => `${done} of ${shown} ready`,
    legend: "✓ we can see it's done · ○ your word is enough",
    skip: "Not for me",
    unskip: "Undo",
    markDone: "Done",
    unmark: "Undo",
    steps: {
      lab: {
        title: "Join a Local Lab",
        waitlistTitle: (city: string) => `You're on the ${city} list`,
        why: "Your lab is where your pod will form.",
        minutes: 1,
        cta: "Find your lab",
      },
      register: {
        title: (cycleName: string) => `Pre-register for ${cycleName}`,
        why: "It saves your place, and the people who register are the ones pods form from.",
        minutes: 5,
        cta: "Pre-register",
      },
      dates: {
        title: "Save the key dates",
        why: "Kickoff, the Sprint, the Hackathon and the Showcase — put them in your calendar now.",
        minutes: 1,
        cta: "See the dates",
      },
      slack: {
        title: "Join Slack and say hello in #intros",
        why: "Everything between sessions happens there.",
        minutes: 10,
        cta: "Join Slack",
      },
      github: {
        title: "Add your GitHub username",
        why: "Your pod's work will live on GitHub — and it's where AI work gets shared.",
        minutes: 10,
        cta: "Add it",
      },
      assistant: {
        title: "Set up an AI assistant you can use",
        why: "You'll bring your own — here's how to pick one and use it safely.",
        minutes: 15,
        cta: "Read the guide",
      },
      primer: {
        title: (cycleName: string) => `Read the primer for ${cycleName}`,
        why: "Why this theme, and what earlier cycles learned.",
        minutes: 15,
        cta: "Read it",
      },
      card: {
        title: "Complete your directory card",
        why: "A headline, a photo, and what you're here for — so future pod-mates can find you.",
        minutes: 5,
        cta: "Edit your card",
      },
      videos: {
        title: "Watch the welcome videos",
        why: "How The Labs works, and how to find your way around OLOS.",
        minutes: 20,
        cta: "Watch",
      },
    },
  },

  /** "Still open" — things worth doing now (#412). */
  openNow: {
    heading: "Still open",
    event: { cta: "See details" },
    allEvents: {
      title: "All workshops and events",
      detail: "Free and open to everyone.",
      cta: "Browse",
    },
    lookBack: {
      title: (cycleName: string) => `See what ${cycleName} built`,
      detail: "The pods, the projects, and what they learned.",
      cta: "Look back",
    },
    survey: {
      title: "Add an observation to the field survey",
      detail: "Tell us about a problem you see near you. It shapes what future cycles work on.",
      cta: "Take the survey",
    },
    story: {
      title: (memberName: string) => `Read ${memberName}'s story`,
      detail: "A story from a member of The Labs.",
      cta: "Read",
    },
    library: {
      title: "Browse the Learning Library",
      detail: "Guides, recordings and templates from past cycles — free to use.",
      cta: "Browse",
    },
  },
} as const;

/** The Slack checklist row shipped in PR #287 (deployed 2026-07-21) —
    members created before then were onboarded without it; only newer
    signups see the row. */
export const SLACK_ROW_SINCE_ISO = "2026-07-21T00:00:00Z";

export const SLACK_INVITE_FALLBACK =
  "https://join.slack.com/t/theupskillinglabs/shared_invite/zt-44hwu2dcz-VgHsBzuxUwJASbyxlqlmSQ";

/** Dismissal key for permanently hiding the completed checklist (the
    "Setup · All done" strip's Hide control) — how the checklist finally
    disappears (docs/feedback-running-list.md: "define when the To Do list
    fully dismisses"). Safe to make permanent because the row set is
    account-scoped and stable. */
export const CHECKLIST_HIDE_KEY = "setup:checklist";
