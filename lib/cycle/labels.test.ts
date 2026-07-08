import { describe, it, expect } from "vitest";
import { podNoun, moderatorNoun, cycleStatusVariant } from "./labels";

describe("podNoun / moderatorNoun", () => {
  it("speaks Workstream/Co-lead for org cycles", () => {
    expect(podNoun("org")).toBe("Workstream");
    expect(podNoun("org", true)).toBe("Workstreams");
    expect(moderatorNoun("org")).toBe("Co-lead");
    expect(moderatorNoun("org", true)).toBe("Co-leads");
  });

  it("speaks Pod/Poderator for open cycles and unknown modes", () => {
    expect(podNoun("open")).toBe("Pod");
    expect(podNoun(null, true)).toBe("Pods");
    expect(moderatorNoun(undefined)).toBe("Poderator");
    expect(moderatorNoun("closed", true)).toBe("Poderators");
  });
});

describe("cycleStatusVariant", () => {
  it("covers every lifecycle state", () => {
    expect(cycleStatusVariant("active")).toBe("active");
    expect(cycleStatusVariant("upcoming")).toBe("forming");
    expect(cycleStatusVariant("closing")).toBe("forming");
    expect(cycleStatusVariant("draft")).toBe("draft");
    expect(cycleStatusVariant("closed")).toBe("inactive");
    expect(cycleStatusVariant("archived")).toBe("inactive");
  });

  it("falls back to inactive for legacy/unknown states", () => {
    expect(cycleStatusVariant("bogus")).toBe("inactive");
  });
});
