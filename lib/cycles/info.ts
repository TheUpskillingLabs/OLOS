// Cycle information-page content. Admins may author per-cycle copy
// (cycles.description / cycles.what_you_build); when a field is blank we fall
// back to the standard "how a Build Cycle works" copy so every cycle has a
// complete info page even before anyone edits it.

export const CYCLE_INFO_FALLBACK = {
  description:
    "A Build Cycle is a twelve week process where you explore a problem space deeply, join a small pod to take on a problem that matters to you, and ship something real with a team – all supported by mentors and the broader Labs community.",
  whatYouBuild:
    "You'll build and showcase your work as you go, culminating in a demo at the Summit. You walk away with something real, proof of it on your profile, and a new network of people who have seen what you're capable of.",
  // Generic theme copy — used when a cycle has no admin-authored
  // theme_description (cycle_config, 00084). Per-cycle copy overrides it.
  themeDescription:
    "Every Build Cycle takes on one theme — the problem space this cohort explores together. Pods form around specific problems in that space and build real solutions, all aided by AI. You don't need a specific background to join — just curiosity to explore the space and a willingness to build something useful for the people around you.",
} as const;

export interface CycleInfoContent {
  description: string;
  whatYouBuild: string;
  themeDescription: string;
}

export function cycleInfoContent(cycle: {
  description?: string | null;
  what_you_build?: string | null;
  // Theme copy lives on cycle_config (00084), so it's passed in alongside the
  // cycles-table fields rather than read off the cycle row.
  theme_description?: string | null;
}): CycleInfoContent {
  return {
    description: cycle.description?.trim() || CYCLE_INFO_FALLBACK.description,
    whatYouBuild:
      cycle.what_you_build?.trim() || CYCLE_INFO_FALLBACK.whatYouBuild,
    themeDescription:
      cycle.theme_description?.trim() || CYCLE_INFO_FALLBACK.themeDescription,
  };
}
