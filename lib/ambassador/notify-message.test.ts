import { describe, expect, it } from "vitest";
import { coordinatorMessage, type CoordinatorEvent } from "./notify-message";

const EVENTS: CoordinatorEvent[] = ["application_waiting", "invite_waiting", "review_split", "ready_for_button"];

describe("coordinatorMessage", () => {
  it("names the Lab (or HQ) and links to the coordinator page", () => {
    const m = coordinatorMessage("application_waiting", { labName: "Boston", baseUrl: "https://example.org/" });
    expect(m).toContain("(Boston)");
    expect(m).toContain("<https://example.org/ambassador/coordinator|");
    expect(coordinatorMessage("invite_waiting", { labName: null, baseUrl: "https://example.org" })).toContain("(HQ)");
  });

  it("says something different for each event", () => {
    const texts = EVENTS.map((e) => coordinatorMessage(e, { labName: "X", baseUrl: "https://example.org" }));
    expect(new Set(texts).size).toBe(EVENTS.length);
  });

  it("uses the house copy: no banned words, no TUL", () => {
    for (const e of EVENTS) {
      const m = coordinatorMessage(e, { labName: "X", baseUrl: "https://example.org" });
      expect(m).not.toMatch(/\b(course|class|student|lesson|module|TUL)\b/i);
    }
  });
});
