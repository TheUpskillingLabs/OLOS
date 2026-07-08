import { describe, expect, it } from "vitest";
import { nextTabValue } from "./tabs-keys";

const VALUES = ["overview", "formation", "people", "configuration"];

describe("nextTabValue", () => {
  it("moves right and left", () => {
    expect(nextTabValue(VALUES, "overview", "ArrowRight")).toBe("formation");
    expect(nextTabValue(VALUES, "people", "ArrowLeft")).toBe("formation");
  });

  it("wraps around at both edges", () => {
    expect(nextTabValue(VALUES, "configuration", "ArrowRight")).toBe(
      "overview"
    );
    expect(nextTabValue(VALUES, "overview", "ArrowLeft")).toBe(
      "configuration"
    );
  });

  it("jumps with Home and End", () => {
    expect(nextTabValue(VALUES, "people", "Home")).toBe("overview");
    expect(nextTabValue(VALUES, "formation", "End")).toBe("configuration");
  });

  it("ignores other keys", () => {
    expect(nextTabValue(VALUES, "overview", "Enter")).toBeNull();
    expect(nextTabValue(VALUES, "overview", "ArrowDown")).toBeNull();
  });

  it("treats an unknown current value as the first tab", () => {
    expect(nextTabValue(VALUES, "missing", "ArrowRight")).toBe("formation");
    expect(nextTabValue(VALUES, "missing", "ArrowLeft")).toBe("configuration");
  });

  it("returns null for an empty tab list", () => {
    expect(nextTabValue([], "x", "ArrowRight")).toBeNull();
  });
});
