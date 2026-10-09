/* Where someone stands on the ambassador ladder — Raise your hand → Get in →
   Get ready → Pass it on — derived from their application row, their role
   grant, and their guide progress. The one definition every ambassador
   surface reads (the hub, the apply flow, the dashboard task, the
   coordinator's list), so they can't disagree.

   Pure module: types + functions only — importable from client components. */

import { AMBASSADOR_AGREEMENT_VERSION, STEPS, fill, stepHref, ui } from "./content";

export const APPLICATION_STATUSES = ["started", "pending", "approved", "declined", "stepped_back"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** An ambassador_applications row (00104). */
export interface AmbassadorApplication {
  id: number;
  participant_id: number;
  lab_id: number | null;
  status: ApplicationStatus;
  oriented_at: string | null;
  quiz_version: string | null;
  quiz_score: number | null;
  quiz_total: number | null;
  quiz_passed_at: string | null;
  agreement_version: string | null;
  agreement_accepted_at: string | null;
  referred_by: string | null;
  referred_by_participant_id: number | null;
  invite_id: number | null;
  submitted_at: string | null;
  decided_at: string | null;
  decided_by: number | null;
  decision_note: string | null;
  ready_at: string | null;
  button_given_at: string | null;
  button_given_by: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * none        — hasn't started.
 * applying    — part way through orientation.
 * pending     — finished; waiting for their coordinator.
 * declined    — the coordinator said not now.
 * ambassador  — holds an active 'ambassador' role grant (the truth: an
 *               admin can grant it without an application).
 * stepped_back — was an ambassador; the role was revoked.
 */
export type AmbassadorStage = "none" | "applying" | "pending" | "declined" | "ambassador" | "stepped_back";

export function ambassadorStage(app: AmbassadorApplication | null, hasRole: boolean): AmbassadorStage {
  if (hasRole) return "ambassador";
  if (!app) return "none";
  switch (app.status) {
    case "started":
      return "applying";
    case "pending":
      return "pending";
    case "declined":
      return "declined";
    case "stepped_back":
      return "stepped_back";
    case "approved":
      // Approved but the grant is gone (revoked outside this flow).
      return "stepped_back";
  }
}

/** The agreement on file is the one presented now. */
export function agreementCurrent(app: Pick<AmbassadorApplication, "agreement_version"> | null): boolean {
  return Boolean(app?.agreement_version && app.agreement_version === AMBASSADOR_AGREEMENT_VERSION);
}

export function quizPassed(app: Pick<AmbassadorApplication, "quiz_passed_at"> | null): boolean {
  return Boolean(app?.quiz_passed_at);
}

/** Orientation is complete enough to submit: the questions and the agreement. */
export function canSubmit(app: AmbassadorApplication | null): boolean {
  return quizPassed(app) && agreementCurrent(app);
}

/** The apply flow's screens, in order — it gives before it takes. */
export const APPLY_STAGES = ["video", "quiz", "agreement", "details", "done"] as const;
export type ApplyStage = (typeof APPLY_STAGES)[number];

/** Where the apply flow resumes. */
export function resumeStage(app: AmbassadorApplication | null): ApplyStage {
  if (!app) return "video";
  if (app.status !== "started") return "done";
  if (!app.oriented_at && !quizPassed(app)) return "video";
  if (!quizPassed(app)) return "quiz";
  if (!agreementCurrent(app)) return "agreement";
  return "details";
}

/** Guide progress: which of the five steps are done, and what's next. */
export interface GuideProgress {
  done: string[];
  count: number;
  total: number;
  complete: boolean;
  /** The first unfinished step, in path order. */
  next: { id: string; title: string; href: string; readTime: number } | null;
}

export function guideProgress(doneIds: Iterable<string>): GuideProgress {
  const done = new Set(doneIds);
  const inPath = STEPS.filter((s) => done.has(s.id)).map((s) => s.id);
  const next = STEPS.find((s) => !done.has(s.id)) ?? null;
  return {
    done: inPath,
    count: inPath.length,
    total: STEPS.length,
    complete: inPath.length === STEPS.length,
    next: next ? { id: next.id, title: next.title, href: stepHref(next.id), readTime: next.readTime } : null,
  };
}

/** The guide Home's one button: Start, Continue: <step>, or — once all five
 *  are done — "Tell your coordinator you're ready" (an action, no href). */
export function guidePrimary(p: GuideProgress, readyAt: string | null): { label: string; href: string | null; action: "ready" | null } | null {
  if (p.next) {
    return p.count === 0
      ? { label: ui.home.start, href: p.next.href, action: null }
      : { label: fill(ui.home.continue, { title: p.next.title }), href: p.next.href, action: null };
  }
  if (!readyAt) return { label: ui.home.claim, href: null, action: "ready" };
  return null;
}
