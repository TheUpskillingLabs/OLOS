import { createServiceClient } from "@/lib/supabase/server";

/* The Baseline Learning Log — a one-time onboarding reflection filed once per
   participant per cycle, BEFORE the weekly ritual begins (roadmap Phase 1). It
   captures where a member is starting from: how they use AI today, how they
   see work and their own role changing, and five self-anchored 1–5 readiness
   scales. It is a learning_logs row with kind='baseline' plus a companion
   baseline_responses row (migration in flight) holding the eight answers.

   Unlike the weekly gate (lib/learning-logs/eligible.ts — active cycle ∩
   active enrollment), a baseline is eligible EARLIER and BROADER: any
   status 'upcoming'|'active', mode='open' cycle the member is enrolled in
   under ANY enrollment status, so long as they haven't already filed one for
   that cycle. Filing is append-only and one-per-cycle (DB UNIQUE on
   participant_id, cycle_id). The pure resolver below is the single
   definition; the route and the dashboard both feed it. */

/** One prompt in the baseline questionnaire, structured so the UI renders the
    whole form from this constant. `key` maps 1:1 onto BaselineAnswers /
    baseline_responses columns; `type` picks the control (choice = the AI-usage
    frequency select, text = free response, scale = the 1–5 agree/disagree
    anchors). */
export interface BaselineQuestion {
  key: keyof BaselineAnswers;
  prompt: string;
  type: "choice" | "text" | "scale";
  /** Attribution note surfaced under the prompt, when adapted from a source. */
  note?: string;
}

export const BASELINE_QUESTIONS: BaselineQuestion[] = [
  {
    key: "ai_usage_frequency",
    prompt: "How often do you currently use AI tools in your work?",
    type: "choice",
  },
  {
    key: "work_shift_outlook",
    prompt: "How do you see AI shifting the nature of work in the next 5 years?",
    type: "text",
  },
  {
    key: "role_change_outlook",
    prompt:
      "How do you see your own role in work changing, and what do you want it to look like?",
    type: "text",
  },
  {
    key: "skills_readiness",
    prompt: "I have the skills I need for where my work is headed.",
    type: "scale",
  },
  {
    key: "learning_confidence",
    prompt: "I feel confident I can learn and use the AI tools my work needs.",
    type: "scale",
  },
  {
    key: "judgment_confidence",
    prompt: "I feel confident knowing when and how to use AI tools.",
    type: "scale",
  },
  {
    key: "autonomy",
    prompt: "I feel a sense of choice and freedom in the work I undertake.",
    type: "scale",
    note: "Adapted from Chen et al., 2015, BPNSF",
  },
  {
    key: "peer_investment",
    prompt: "I have peers who are invested in my growth, and I in theirs.",
    type: "scale",
  },
];

/** The five 1–5 scale items (questions 4–8) share these agree/disagree
    anchors. Exposed so the UI labels the endpoints consistently. */
export const SCALE_ANCHORS: { value: number; label: string }[] = [
  { value: 1, label: "Strongly disagree" },
  { value: 2, label: "Disagree" },
  { value: 3, label: "Neither agree nor disagree" },
  { value: 4, label: "Agree" },
  { value: 5, label: "Strongly agree" },
];

/** The AI-usage frequency choices (question 1). */
export const AI_USAGE_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "Not at all" },
  { value: 2, label: "A few times a month" },
  { value: 3, label: "Weekly" },
  { value: 4, label: "Several times a week" },
  { value: 5, label: "Daily or more" },
];

export interface BaselineAnswers {
  ai_usage_frequency: number;
  work_shift_outlook: string;
  role_change_outlook: string;
  skills_readiness: number;
  learning_confidence: number;
  judgment_confidence: number;
  autonomy: number;
  peer_investment: number;
}

/** A cycle a baseline may be attributed to, as surfaced to the client. */
export interface BaselineCycle {
  id: number;
  name: string;
  status: string;
}

/** Candidate cycle for the pure resolver — carries the two fields the
    eligibility rules read (status, mode) on top of the surfaced shape. */
export interface BaselineCandidateCycle extends BaselineCycle {
  mode: string;
}

/* The single definition of "cycles this member can still file a baseline
   for". Kept free of Supabase imports so the matrix is unit-testable without
   mocks (lib/learning-logs/baseline-logic.test.ts); pendingBaselineCycles
   below is the thin Supabase-reading wrapper that feeds this.

   A candidate is pending iff:
     - its status is 'upcoming' or 'active' (a baseline is filed at/before
       kickoff, so upcoming counts — unlike the weekly gate which needs the
       cycle live), AND
     - its mode is 'open' (baselines are a participant-cycle ritual; org
       workstreams don't run the onboarding reflection), AND
     - the member holds SOME enrollment in it (any status — inactive/pending
       enrollees still file their baseline), AND
     - they have NOT already filed a baseline for it (append-only, one per
       cycle; a completed cycle drops out, which also serves as the route's
       "already completed" guard). */
export function resolvePendingBaselines(
  candidateCycles: BaselineCandidateCycle[],
  enrolledCycleIds: Set<number>,
  completedCycleIds: Set<number>
): BaselineCycle[] {
  return candidateCycles
    .filter(
      (c) =>
        (c.status === "upcoming" || c.status === "active") &&
        c.mode === "open" &&
        enrolledCycleIds.has(c.id) &&
        !completedCycleIds.has(c.id)
    )
    .map((c) => ({ id: c.id, name: c.name, status: c.status }));
}

export async function pendingBaselineCycles(
  participantId: number
): Promise<BaselineCycle[]> {
  const supabase = createServiceClient();

  const { data: cycles } = await supabase
    .from("cycles")
    .select("id, name, status, mode")
    .in("status", ["upcoming", "active"])
    .eq("mode", "open");
  if (!cycles || cycles.length === 0) return [];

  const cycleIds = cycles.map((c) => c.id);

  const [{ data: enrollments }, { data: responses }] = await Promise.all([
    supabase
      .from("cycle_enrollments")
      .select("cycle_id")
      .eq("participant_id", participantId)
      .in("cycle_id", cycleIds),
    // baseline_responses may not be in the generated types yet — query it
    // untyped, the way eligible.ts leans on plain .from() reads.
    supabase
      .from("baseline_responses")
      .select("cycle_id")
      .eq("participant_id", participantId),
  ]);

  const enrolledCycleIds = new Set(
    (enrollments ?? []).map((e) => e.cycle_id as number)
  );
  const completedCycleIds = new Set(
    (responses ?? []).map((r) => r.cycle_id as number)
  );

  return resolvePendingBaselines(
    cycles as BaselineCandidateCycle[],
    enrolledCycleIds,
    completedCycleIds
  );
}
