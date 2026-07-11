import { describe, it, expect } from "vitest";
import { slugifyHandle, isValidHandle } from "./handle";

describe("slugifyHandle", () => {
  it("lowercases and dashes spaces", () => {
    expect(slugifyHandle("Priya Shah")).toBe("priya-shah");
  });
  it("collapses runs of non-alphanumerics to a single dash", () => {
    expect(slugifyHandle("Jordan  O'Kafor")).toBe("jordan-o-kafor");
  });
  it("trims leading/trailing dashes", () => {
    expect(slugifyHandle("  --Alex--  ")).toBe("alex");
  });
  it("falls back to 'member' when nothing survives", () => {
    expect(slugifyHandle("!!!")).toBe("member");
    expect(slugifyHandle("")).toBe("member");
  });
  it("caps length at 40 with no trailing dash", () => {
    const out = slugifyHandle("a".repeat(60));
    expect(out.length).toBeLessThanOrEqual(40);
    expect(out.endsWith("-")).toBe(false);
  });
});

describe("isValidHandle", () => {
  it("accepts lowercase slugs with internal dashes", () => {
    expect(isValidHandle("priya-shah")).toBe(true);
    expect(isValidHandle("m1")).toBe(true);
  });
  it("rejects uppercase, leading dash, underscores, empty, and >50", () => {
    expect(isValidHandle("Priya")).toBe(false);
    expect(isValidHandle("-lead")).toBe(false);
    expect(isValidHandle("ab_cd")).toBe(false);
    expect(isValidHandle("")).toBe(false);
    expect(isValidHandle("a".repeat(51))).toBe(false);
  });
});
