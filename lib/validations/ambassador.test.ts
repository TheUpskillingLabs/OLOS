import { describe, expect, it } from "vitest";
import { ambassadorDecisionSchema } from "./ambassador";

describe("ambassadorDecisionSchema notes", () => {
  it("lets a review note run to 1000 characters (ambassador_reviews.note)", () => {
    expect(ambassadorDecisionSchema.safeParse({ action: "review", decision: "approve", note: "x".repeat(1000) }).success).toBe(true);
  });

  it("caps every other action's note at 500 (ambassador_applications.decision_note is varchar(500))", () => {
    for (const action of ["step_back", "approve", "reopen", "button_given"] as const) {
      expect(ambassadorDecisionSchema.safeParse({ action, note: "x".repeat(500) }).success).toBe(true);
      expect(ambassadorDecisionSchema.safeParse({ action, note: "x".repeat(501) }).success).toBe(false);
    }
  });
});
