/* Two reviewers decide an ambassador application (00105). The rules every
   review surface reads — the coordinator queue, the review page, the review
   route, the dashboard's "waiting for you" count — so they can't disagree:

     - Two approvals approve; two declines decline.
     - A 1–1 split waits for a third review from an admin, which decides.
     - Nobody reviews their own application, or one they referred.
     - Each reviewer decides on their own: the other reviews stay hidden until
       you've recorded yours (an admin breaking a split sees both).
     - An invited applicant skips this: a second coordinator approves the
       invite instead (00106), and the invitee is in once onboarding is done
       (admitInvitee in lib/ambassador/data.ts). These rules cover open
       applications.

   Pure module: types + functions only — importable from client components. */

import type { AmbassadorApplication } from "./status";

export const REVIEWS_REQUIRED = 2;

export const REVIEW_DECISIONS = ["approve", "decline"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

/** An ambassador_reviews row (00105). */
export interface AmbassadorReview {
  id: number;
  application_id: number;
  reviewer_id: number | null;
  decision: ReviewDecision;
  note: string | null;
  source: "review" | "invite";
  created_at: string;
  superseded_at: string | null;
}

export const REVIEW_SELECT = "id, application_id, reviewer_id, decision, note, source, created_at, superseded_at";

/** Only the current round counts; reopened rounds are history. */
export function activeReviews<T extends Pick<AmbassadorReview, "superseded_at">>(reviews: T[]): T[] {
  return reviews.filter((r) => !r.superseded_at);
}

export type ReviewOutcome =
  | { state: "open"; approvals: number; declines: number; needed: number }
  | { state: "split"; approvals: number; declines: number; needed: 1 }
  | { state: "approved" | "declined"; approvals: number; declines: number; needed: 0 };

/** Where the current round stands. */
export function reviewOutcome(reviews: Pick<AmbassadorReview, "decision" | "superseded_at">[]): ReviewOutcome {
  const active = activeReviews(reviews);
  const approvals = active.filter((r) => r.decision === "approve").length;
  const declines = active.filter((r) => r.decision === "decline").length;
  if (approvals >= REVIEWS_REQUIRED) return { state: "approved", approvals, declines, needed: 0 };
  if (declines >= REVIEWS_REQUIRED) return { state: "declined", approvals, declines, needed: 0 };
  if (approvals + declines >= REVIEWS_REQUIRED) return { state: "split", approvals, declines, needed: 1 };
  return { state: "open", approvals, declines, needed: REVIEWS_REQUIRED - approvals - declines };
}

/** Why this person can't review this application now, or null if they can. */
export type ReviewBlock = "closed" | "own" | "referrer" | "already_reviewed" | "needs_admin";

export const REVIEW_BLOCK_MESSAGE: Record<ReviewBlock, string> = {
  closed: "This application isn't waiting for a review.",
  own: "Someone else reviews your own application.",
  referrer: "You brought them in, so two other people review it.",
  already_reviewed: "You've reviewed this one. It's waiting on another reviewer.",
  needs_admin: "The two reviews disagree. An admin makes the call.",
};

export interface ReviewerContext {
  reviewerId: number | null;
  reviewerIsAdmin: boolean;
}

type ReviewApp = Pick<AmbassadorApplication, "status" | "participant_id" | "referred_by_participant_id">;
type ReviewRow = Pick<AmbassadorReview, "reviewer_id" | "decision" | "superseded_at">;

export function reviewBlock(app: ReviewApp, reviews: ReviewRow[], who: ReviewerContext): ReviewBlock | null {
  if (app.status !== "pending" || who.reviewerId == null) return "closed";
  if (who.reviewerId === app.participant_id) return "own";
  if (app.referred_by_participant_id != null && who.reviewerId === app.referred_by_participant_id) return "referrer";
  if (activeReviews(reviews).some((r) => r.reviewer_id === who.reviewerId)) return "already_reviewed";
  const outcome = reviewOutcome(reviews);
  if (outcome.state === "split" && !who.reviewerIsAdmin) return "needs_admin";
  if (outcome.state === "approved" || outcome.state === "declined") return "closed";
  return null;
}

/** This application is waiting on this reviewer (the dashboard count). */
export function awaitsReviewer(app: ReviewApp, reviews: ReviewRow[], who: ReviewerContext): boolean {
  return reviewBlock(app, reviews, who) === null;
}

/** Independence: the other reviews show once you've recorded yours, or to an
 *  admin breaking a split. */
export function canSeeOtherReviews(app: ReviewApp, reviews: ReviewRow[], who: ReviewerContext): boolean {
  if (app.status !== "pending") return true;
  if (who.reviewerId != null && activeReviews(reviews).some((r) => r.reviewer_id === who.reviewerId)) return true;
  return who.reviewerIsAdmin && reviewOutcome(reviews).state === "split";
}

/** "1 of 2 reviews", "Split: needs an admin", … for the queue. */
export function outcomeLabel(outcome: ReviewOutcome): string {
  switch (outcome.state) {
    case "open":
      return `${REVIEWS_REQUIRED - outcome.needed} of ${REVIEWS_REQUIRED} reviews`;
    case "split":
      return "Split: needs an admin";
    case "approved":
      return "Approved";
    case "declined":
      return "Not now";
  }
}
