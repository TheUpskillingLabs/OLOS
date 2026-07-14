import { describe, it, expect } from "vitest";
import {
  learningLogSchema,
  weeklyV2Error,
  legacyError,
  looksLikeWeeklyV2,
  sharedParagraph,
  type LearningLogInput,
} from "./learning-logs";
import { HOURS_BUCKETS } from "@/lib/cycles/hours";

const v1Payload = {
  clarity: 4,
  alignment: 3,
  is_blocked: false,
  accomplished: "the auth flow",
  exploring: "RLS policies",
  next_focus: "the moderator dashboard",
  share_publicly: false,
};

const v2Payload = {
  is_blocked: false,
  hours_bucket: "5–8 hrs / week",
  collab_rating: 4,
  progress_rating: 3,
  contribution: "Drafted the pod's problem statement",
  learned: "How RLS policies compose",
  capability_rating: 4,
  energy_rating: 5,
  share_publicly: false,
};

const parse = (p: unknown) => learningLogSchema.parse(p) as LearningLogInput;

describe("learningLogSchema (superset)", () => {
  it("accepts a legacy v1 payload", () => {
    expect(() => parse(v1Payload)).not.toThrow();
  });

  it("accepts a weekly v2 payload", () => {
    expect(() => parse(v2Payload)).not.toThrow();
  });

  it("stays strict — unknown keys rejected", () => {
    expect(() => parse({ ...v2Payload, kind: "weekly" })).toThrow();
  });

  it("accepts every onboarding hours bucket, byte-exact (en-dash, 00082)", () => {
    for (const bucket of HOURS_BUCKETS) {
      expect(() => parse({ ...v2Payload, hours_bucket: bucket })).not.toThrow();
    }
    expect(HOURS_BUCKETS).toEqual([
      "2–4 hrs / week",
      "5–8 hrs / week",
      "8+ hrs / week",
    ]);
  });

  it("rejects a hyphen lookalike bucket", () => {
    expect(() =>
      parse({ ...v2Payload, hours_bucket: "5-8 hrs / week" })
    ).toThrow();
  });

  it("rejects out-of-range ratings", () => {
    expect(() => parse({ ...v2Payload, energy_rating: 0 })).toThrow();
    expect(() => parse({ ...v2Payload, collab_rating: 6 })).toThrow();
  });

  it("feeling_word must be a single word", () => {
    expect(() => parse({ ...v2Payload, feeling_word: "energized" })).not.toThrow();
    expect(() => parse({ ...v2Payload, feeling_word: "very tired" })).toThrow();
  });

  it("recognition caps at 300 chars", () => {
    expect(() =>
      parse({ ...v2Payload, recognition: "x".repeat(301) })
    ).toThrow();
  });
});

describe("weeklyV2Error", () => {
  it("passes a complete v2 payload", () => {
    expect(weeklyV2Error(parse(v2Payload))).toBeNull();
  });

  it.each([
    ["hours_bucket", { hours_bucket: undefined }],
    ["collab_rating", { collab_rating: undefined }],
    ["progress_rating", { progress_rating: undefined }],
    ["contribution", { contribution: "  " }],
    ["learned", { learned: null }],
    ["capability_rating", { capability_rating: undefined }],
    ["energy_rating", { energy_rating: undefined }],
  ])("requires %s", (_field, patch) => {
    expect(weeklyV2Error(parse({ ...v2Payload, ...patch }))).toBeTruthy();
  });

  it("requires both stuck follow-ups when stuck", () => {
    const stuck = { ...v2Payload, is_blocked: true };
    expect(weeklyV2Error(parse(stuck))).toBeTruthy();
    expect(
      weeklyV2Error(parse({ ...stuck, stuck_tried: "Tried X, broke at Y" }))
    ).toBeTruthy();
    expect(
      weeklyV2Error(
        parse({
          ...stuck,
          stuck_tried: "Tried X, broke at Y",
          blocker_context: "A pairing session",
        })
      )
    ).toBeNull();
  });

  it("optional items 8/9 don't gate", () => {
    expect(
      weeklyV2Error(
        parse({ ...v2Payload, feeling_word: null, recognition: null })
      )
    ).toBeNull();
  });
});

describe("legacyError", () => {
  it("passes v1, rejects a missing health check", () => {
    expect(legacyError(parse(v1Payload))).toBeNull();
    expect(legacyError(parse({ ...v1Payload, clarity: undefined }))).toBeTruthy();
  });
});

describe("looksLikeWeeklyV2", () => {
  it("tells the instruments apart", () => {
    expect(looksLikeWeeklyV2(parse(v2Payload))).toBe(true);
    expect(looksLikeWeeklyV2(parse(v1Payload))).toBe(false);
  });
});

describe("sharedParagraph", () => {
  it("v1 composition unchanged (regression pin)", () => {
    expect(sharedParagraph(parse(v1Payload))).toBe(
      "This week, I figured out the auth flow " +
        "I’m currently exploring RLS policies " +
        "Next week, my focus is the moderator dashboard"
    );
  });

  it("weekly_v2 composes from contribution + learned only", () => {
    expect(sharedParagraph(parse(v2Payload), "weekly_v2")).toBe(
      "This week: Drafted the pod's problem statement " +
        "One thing I figured out: How RLS policies compose"
    );
  });

  it("weekly_v2 with neither field → empty (no share row)", () => {
    expect(
      sharedParagraph(
        parse({ ...v2Payload, contribution: undefined, learned: undefined }),
        "weekly_v2"
      )
    ).toBe("");
  });
});
