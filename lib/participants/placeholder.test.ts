import { describe, expect, it } from "vitest";
import { hasPlaceholderName, isPlaceholderValue } from "./placeholder";

describe("isPlaceholderValue", () => {
  it("matches the migration script's 'Unknown' stub in any case, trimmed", () => {
    expect(isPlaceholderValue("Unknown")).toBe(true);
    expect(isPlaceholderValue("unknown")).toBe(true);
    expect(isPlaceholderValue("  UNKNOWN  ")).toBe(true);
  });

  it("does not match real names containing the word", () => {
    expect(isPlaceholderValue("Unknown Rivera")).toBe(false);
    expect(isPlaceholderValue("Knox")).toBe(false);
  });

  it("treats empty/null as non-placeholder (absence is a different problem)", () => {
    expect(isPlaceholderValue("")).toBe(false);
    expect(isPlaceholderValue(null)).toBe(false);
    expect(isPlaceholderValue(undefined)).toBe(false);
  });
});

describe("hasPlaceholderName", () => {
  it("flags when either field is the stub", () => {
    expect(hasPlaceholderName("Unknown", "Rivera")).toBe(true);
    expect(hasPlaceholderName("Maya", "unknown")).toBe(true);
    expect(hasPlaceholderName("Maya", "Rivera")).toBe(false);
  });
});
