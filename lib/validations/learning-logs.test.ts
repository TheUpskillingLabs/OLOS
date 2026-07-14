import { describe, it, expect } from "vitest";
import { baselineSchema, learningLogSchema } from "./learning-logs";

const validBaseline = {
  ai_usage_frequency: 3,
  work_shift_outlook: "More automation of routine work.",
  role_change_outlook: "More orchestration, less rote execution.",
  skills_readiness: 4,
  learning_confidence: 5,
  judgment_confidence: 3,
  autonomy: 4,
  peer_investment: 2,
};

const validWeekly = {
  clarity: 4,
  alignment: 3,
  is_blocked: false,
  share_publicly: false,
};

describe("baselineSchema", () => {
  it("accepts a fully valid baseline", () => {
    expect(baselineSchema.safeParse(validBaseline).success).toBe(true);
  });

  it("rejects null, omitted, or blank free-text fields (required)", () => {
    const { work_shift_outlook, role_change_outlook, ...rest } = validBaseline;
    void work_shift_outlook;
    void role_change_outlook;
    expect(baselineSchema.safeParse(rest).success).toBe(false);
    expect(
      baselineSchema.safeParse({
        ...rest,
        work_shift_outlook: null,
        role_change_outlook: null,
      }).success
    ).toBe(false);
    expect(
      baselineSchema.safeParse({
        ...validBaseline,
        work_shift_outlook: "   ",
      }).success
    ).toBe(false);
  });

  it("rejects a scale value out of the 1–5 range", () => {
    expect(
      baselineSchema.safeParse({ ...validBaseline, autonomy: 6 }).success
    ).toBe(false);
    expect(
      baselineSchema.safeParse({ ...validBaseline, skills_readiness: 0 }).success
    ).toBe(false);
  });

  it("rejects a non-integer scale value", () => {
    expect(
      baselineSchema.safeParse({ ...validBaseline, ai_usage_frequency: 2.5 })
        .success
    ).toBe(false);
  });

  it("rejects unknown keys (strict)", () => {
    expect(
      baselineSchema.safeParse({ ...validBaseline, extra: "nope" }).success
    ).toBe(false);
  });
});

describe("learningLogSchema baseline integration", () => {
  it("still accepts a baseline-less weekly body", () => {
    expect(learningLogSchema.safeParse(validWeekly).success).toBe(true);
  });

  it("accepts a body carrying a valid baseline", () => {
    expect(
      learningLogSchema.safeParse({ ...validWeekly, baseline: validBaseline })
        .success
    ).toBe(true);
  });

  it("rejects a body carrying an invalid baseline", () => {
    expect(
      learningLogSchema.safeParse({
        ...validWeekly,
        baseline: { ...validBaseline, peer_investment: 9 },
      }).success
    ).toBe(false);
  });
});
