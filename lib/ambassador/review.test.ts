import { describe, expect, it } from "vitest";
import {
  awaitsReviewer,
  canSeeOtherReviews,
  outcomeLabel,
  reviewBlock,
  reviewOutcome,
  type AmbassadorReview,
} from "./review";

const APPLICANT = 10;
const REFERRER = 11;
const A = 21;
const B = 22;
const ADMIN = 99;

const app = (status: "started" | "pending" | "approved" | "declined" | "stepped_back" = "pending") => ({
  status,
  participant_id: APPLICANT,
  referred_by_participant_id: REFERRER,
});

let nextId = 1;
function review(reviewer_id: number | null, decision: "approve" | "decline", superseded_at: string | null = null): AmbassadorReview {
  return {
    id: nextId++, application_id: 1, reviewer_id, decision, note: null, source: "review",
    created_at: "2026-10-09T00:00:00Z", superseded_at,
  };
}

const reviewer = (id: number, admin = false) => ({ reviewerId: id, reviewerIsAdmin: admin });

describe("reviewOutcome", () => {
  it("needs two reviews before anything is decided", () => {
    expect(reviewOutcome([])).toMatchObject({ state: "open", needed: 2 });
    expect(reviewOutcome([review(A, "approve")])).toMatchObject({ state: "open", needed: 1 });
    expect(reviewOutcome([review(A, "decline")])).toMatchObject({ state: "open", needed: 1 });
  });

  it("two approvals approve; two declines decline", () => {
    expect(reviewOutcome([review(A, "approve"), review(B, "approve")]).state).toBe("approved");
    expect(reviewOutcome([review(A, "decline"), review(B, "decline")]).state).toBe("declined");
  });

  it("a 1–1 split waits for a third review, which decides", () => {
    const split = [review(A, "approve"), review(B, "decline")];
    expect(reviewOutcome(split)).toMatchObject({ state: "split", needed: 1 });
    expect(reviewOutcome([...split, review(ADMIN, "approve")]).state).toBe("approved");
    expect(reviewOutcome([...split, review(ADMIN, "decline")]).state).toBe("declined");
  });

  it("ignores reviews from a superseded round", () => {
    const old = [review(A, "decline", "2026-10-08T00:00:00Z"), review(B, "decline", "2026-10-08T00:00:00Z")];
    expect(reviewOutcome([...old, review(A, "approve")])).toMatchObject({ state: "open", needed: 1 });
  });

  it("labels the queue", () => {
    expect(outcomeLabel(reviewOutcome([]))).toBe("0 of 2 reviews");
    expect(outcomeLabel(reviewOutcome([review(A, "approve")]))).toBe("1 of 2 reviews");
    expect(outcomeLabel(reviewOutcome([review(A, "approve"), review(B, "decline")]))).toBe("Split: needs an admin");
  });
});

describe("reviewBlock", () => {
  it("lets a coordinator review a pending application", () => {
    expect(reviewBlock(app(), [], reviewer(A))).toBeNull();
    expect(awaitsReviewer(app(), [], reviewer(A))).toBe(true);
  });

  it("never lets someone review their own application, or one they referred", () => {
    expect(reviewBlock(app(), [], reviewer(APPLICANT, true))).toBe("own");
    expect(reviewBlock(app(), [], reviewer(REFERRER, true))).toBe("referrer");
  });

  it("one review per reviewer per round", () => {
    expect(reviewBlock(app(), [review(A, "approve")], reviewer(A))).toBe("already_reviewed");
    expect(reviewBlock(app(), [review(A, "approve", "2026-10-08T00:00:00Z")], reviewer(A))).toBeNull();
  });

  it("a split goes to an admin only", () => {
    const split = [review(A, "approve"), review(B, "decline")];
    expect(reviewBlock(app(), split, reviewer(23))).toBe("needs_admin");
    expect(reviewBlock(app(), split, reviewer(ADMIN, true))).toBeNull();
    expect(awaitsReviewer(app(), split, reviewer(23))).toBe(false);
  });

  it("only pending applications take reviews", () => {
    for (const s of ["started", "approved", "declined", "stepped_back"] as const) {
      expect(reviewBlock(app(s), [], reviewer(A))).toBe("closed");
    }
    expect(reviewBlock(app(), [], { reviewerId: null, reviewerIsAdmin: true })).toBe("closed");
  });
});

describe("canSeeOtherReviews", () => {
  it("hides the other reviews until you've recorded yours", () => {
    const one = [review(A, "approve")];
    expect(canSeeOtherReviews(app(), one, reviewer(B))).toBe(false);
    expect(canSeeOtherReviews(app(), [...one, review(B, "decline")], reviewer(B))).toBe(true);
  });

  it("shows both sides of a split to the admin breaking it", () => {
    const split = [review(A, "approve"), review(B, "decline")];
    expect(canSeeOtherReviews(app(), split, reviewer(ADMIN, true))).toBe(true);
    expect(canSeeOtherReviews(app(), split, reviewer(23))).toBe(false);
  });

  it("shows everything once the application is decided", () => {
    expect(canSeeOtherReviews(app("approved"), [review(A, "approve")], reviewer(B))).toBe(true);
  });
});
