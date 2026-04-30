// Single source of truth for all user-facing strings on the pulse-check page.
// Keep questions short and direct; helper text adds warmth.
// Validation errors should be specific, never generic.

export const copy = {
  page: {
    title: "Pulse Check",
    subtitle:
      "A weekly check-in with The Labs — what you made, what's in the way, and what you need next.",
    notRegistered:
      "You need to finish registration before you can submit a pulse check.",
  },

  status: {
    deadline: (date: string) => `Your next pulse check is due by ${date}.`,
    cycleLabel: (cycleName: string) => `Active cycle: ${cycleName}`,
    consequenceTitle: "Pulse checks keep your access active",
    consequenceBody:
      "Going more than 7 days without checking in pauses your access to Labs infrastructure — pod GitHub repos, shared docs, Slack, and Google Groups. A check-in turns it back on right away.",
  },

  context: {
    sectionTitle: "Where you're checking in from",
    podLabel: "Pod",
    podPlaceholder: "— None —",
    projectLabel: "Project",
    projectPlaceholder: "— None —",
  },

  reflection: {
    sectionTitle: "Energy & reflection",

    energy: {
      label: "How's your energy this week?",
      levels: ["Very Low", "Low", "Moderate", "High", "Very High"] as const,
    },

    accomplishment: {
      label: "What did you accomplish this week?",
      helper:
        "Big or small — a working prototype, a clearer problem statement, a tough conversation, anything that moved you forward.",
      placeholder: "I…",
      error: {
        required:
          "Please describe at least one thing you accomplished — even a small one.",
        tooLong: "Keep this under 2,000 characters.",
      },
    },

    highlight: {
      label: "What was the highlight of your week?",
      helper:
        "A win, a moment of clarity, a conversation that stuck with you.",
    },

    challenge: {
      label: "What's challenging you right now?",
      helper:
        "Something that's hard, frustrating, or keeping you up at night.",
    },
  },

  forces: {
    sectionTitle: "Headwinds & tailwinds",

    blockers: {
      label: "What's blocking your progress?",
      helper:
        "Technical obstacles, time constraints, unclear next steps, missing resources — anything in the way.",
    },

    tailwinds: {
      label: "What's giving you momentum?",
      helper:
        "People, tools, wins, or insights that are accelerating your progress.",
    },

    mitigation: {
      label: "How are you working with these forces?",
      helper:
        "What are you doing to chip away at the headwinds and lean into the tailwinds?",
    },
  },

  engagement: {
    sectionTitle: "Labs engagement",

    aiTools: {
      label: "AI tools you used this week",
      helper:
        "Start typing to see suggestions, or add your own. Press Enter to add a tag.",
      placeholderEmpty: "Try Claude Code, Cursor, ChatGPT…",
    },

    benefits: {
      label: "What did The Labs give you this week?",
      helper: "Pick up to three.",
      maxNote: "max 3",
    },

    newConnections: {
      label:
        "How many new connections did you make through The Labs this week?",
      choices: ["0", "1", "2", "3", "4", "5+"] as const,
    },
  },

  nominations: {
    collapsedTitle: "Know someone who should be part of The Labs?",
    collapsedHint: "Nominate an upskiller, mentor, or advisor",
    sectionTitle: "Nominations",
    hideLabel: "Hide",
    cardLabel: (n: number) => `Nomination ${n}`,
    removeLabel: "Remove",
    addLabel: "+ Add another nomination",

    name: {
      label: "Name",
      error: { required: "Please add the person's name." },
    },
    email: { label: "Email" },
    linkedin: {
      label: "LinkedIn",
      placeholder: "https://linkedin.com/in/…",
    },
    type: {
      label: "Best fit as a…",
      options: [
        { value: "upskiller", label: "Upskiller" },
        { value: "mentor", label: "Mentor" },
        { value: "advisor", label: "Advisor" },
      ] as const,
    },
    reason: {
      label: "Why should The Labs know them?",
      helper:
        "A sentence or two on what they're working on or what they'd bring.",
      error: { required: "Please share a quick note on why we should know them." },
    },
  },

  closing: {
    label: "Anything else you'd like us to know?",
    helper:
      "Feedback on The Labs, ideas you're chewing on, concerns, or anything that doesn't fit above.",
  },

  submit: {
    idle: "Submit pulse check",
    submitting: "Submitting…",
    genericError: "Something went wrong on our end. Please try again.",
    duplicateError:
      "Looks like you already submitted a pulse check today — thanks for checking in.",
  },

  confirmation: {
    title: "Pulse check submitted",
    body: "Thanks for checking in. Your access stays active for another 7 days.",
    nominationThanks: (count: number) =>
      ` We received ${count} nomination${count === 1 ? "" : "s"} — thanks for spreading the word.`,
    primaryCta: "Return to dashboard",
    secondaryCta: "Submit another pulse check",
  },

  history: {
    title: "Previous check-ins",
    energyChip: (level: number, label: string) => `Energy ${level}/5 (${label})`,
    fields: {
      highlight: "Highlight",
      challenge: "Challenge",
      blockers: "Blockers",
      tailwinds: "Tailwinds",
      mitigation: "Working with these forces",
    },
  },

  locked: {
    title: "Your access is paused",
    body: "It's been more than 7 days since your last pulse check, so your access to Labs infrastructure is on hold. Submit a check-in below and you're back in immediately.",
    note: "Until you check in, the rest of OLOS is locked.",
  },

  nav: {
    ok: "Pulse Check",
    threeDay: "Due in 3 days",
    oneDay: "Due tomorrow",
    overdue: "Overdue — submit now",
  },
} as const;

export type EnergyLevelLabels = typeof copy.reflection.energy.levels;
export type NewConnectionChoices = typeof copy.engagement.newConnections.choices;
