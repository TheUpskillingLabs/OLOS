import { describe, expect, it } from "vitest";
import { safeReturnTo } from "./return-to";

describe("safeReturnTo", () => {
  it("allows ambassador paths", () => {
    expect(safeReturnTo("/ambassador/apply")).toBe("/ambassador/apply");
    expect(safeReturnTo("/ambassador")).toBe("/ambassador");
    expect(safeReturnTo(encodeURIComponent("/ambassador/apply?x=1"))).toBe("/ambassador/apply?x=1");
  });

  it("rejects everything else", () => {
    for (const bad of [
      null,
      "",
      "https://evil.example/ambassador",
      "//evil.example/ambassador",
      "/\\evil.example",
      "/ambassadorx",
      "/admin",
      "/ambassador/../admin",
      "ambassador/apply",
      "/ambassador/apply\n",
    ]) {
      expect(safeReturnTo(bad)).toBeNull();
    }
  });
});
