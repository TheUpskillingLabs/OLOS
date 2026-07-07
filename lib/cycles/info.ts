// Cycle information-page content. Admins may author per-cycle copy
// (cycles.description / cycles.what_you_build); when a field is blank we fall
// back to the standard "how a Build Cycle works" copy so every cycle has a
// complete info page even before anyone edits it.

export const CYCLE_INFO_FALLBACK = {
  description:
    "A Build Cycle is a thirteen-week sprint where you join a small pod, take on a real problem that matters to you, and ship something with a team — supported by mentors and the whole Labs community.",
  whatYouBuild:
    "You'll go from a problem to a working project: pick a problem the community votes to tackle, form a pod, propose and vote on solutions, then build it and show your work at the closing Showcase. You walk away with something real, proof of it on your profile, and people who've seen what you can do.",
} as const;

export interface CycleInfoContent {
  description: string;
  whatYouBuild: string;
}

export function cycleInfoContent(cycle: {
  description?: string | null;
  what_you_build?: string | null;
}): CycleInfoContent {
  return {
    description: cycle.description?.trim() || CYCLE_INFO_FALLBACK.description,
    whatYouBuild:
      cycle.what_you_build?.trim() || CYCLE_INFO_FALLBACK.whatYouBuild,
  };
}
