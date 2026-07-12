import { describe, expect, it } from "vitest";
import { metroLabel } from "./metros-label";

describe("metroLabel", () => {
  it("joins name and state", () => {
    expect(metroLabel("Baltimore", "MD")).toBe("Baltimore, MD");
  });

  it("skips the state when the name already embeds it", () => {
    expect(metroLabel("Washington, DC", "DC")).toBe("Washington, DC");
    expect(metroLabel("Washington, DC", "dc")).toBe("Washington, DC");
  });

  it("handles missing parts", () => {
    expect(metroLabel("Washington", null)).toBe("Washington");
    expect(metroLabel("Washington", "")).toBe("Washington");
    expect(metroLabel(null, "MD")).toBe("MD");
    expect(metroLabel("", "MD")).toBe("MD");
    expect(metroLabel(null, null)).toBe("");
  });
});
