import { describe, it, expect } from "vitest";
import { nameFallback } from "./names";

// nameFallback is the offline path used whenever generateName (the Anthropic
// call) throws — e.g. no ANTHROPIC_API_KEY. pods.name / projects.name are
// VARCHAR(40), so staying within 40 chars is load-bearing.

describe("nameFallback", () => {
  it("truncates long text to a word boundary within 40 chars", () => {
    const text =
      "Improve neighborhood solar adoption through shared bulk purchasing";
    const result = nameFallback(text);
    expect(result).toBe("Improve neighborhood solar adoption");
    expect(result.length).toBeLessThanOrEqual(40);
  });

  it("returns short text unchanged", () => {
    expect(nameFallback("Solar Co-op")).toBe("Solar Co-op");
  });

  it("returns the raw 40-char slice when there is no whitespace to trim to", () => {
    const text = "a".repeat(60);
    // The trailing-word regex requires whitespace; with none in the first 40
    // chars it does not match, so the full slice is kept (documented
    // current behavior).
    expect(nameFallback(text)).toBe("a".repeat(40));
  });

  it("trims leading/trailing whitespace", () => {
    expect(nameFallback("  Solar Co-op  ")).toBe("Solar Co-op");
  });

  it("handles the empty string", () => {
    expect(nameFallback("")).toBe("");
  });

  it("never exceeds 40 characters (DB column limit)", () => {
    const samples = [
      "word ".repeat(30),
      "x".repeat(100),
      "short",
      "exactly-forty-characters-aaaaaaaaaaaaaaa word",
    ];
    for (const s of samples) {
      expect(nameFallback(s).length).toBeLessThanOrEqual(40);
    }
  });
});
