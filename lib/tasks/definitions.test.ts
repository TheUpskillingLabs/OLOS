import { describe, expect, it } from "vitest";
import { TASK_COPY } from "./definitions";
import { collectCopyStrings, copyViolations } from "./copy-lint";

describe("the shared copy lint", () => {
  it("flags the banned vocabulary, word-bounded", () => {
    expect(copyViolations("Join the class")).not.toHaveLength(0);
    expect(copyViolations("A TUL workshop")).not.toHaveLength(0);
    expect(copyViolations("Every user can")).not.toHaveLength(0);
    expect(copyViolations("Stay tuned for more")).not.toHaveLength(0);
    expect(copyViolations("Opens soon")).not.toHaveLength(0);
  });

  it("lets the allowed look-alikes through", () => {
    expect(copyViolations("Add your GitHub username")).toEqual([]);
    expect(copyViolations("Write your Leadership Log")).toEqual([]);
    expect(copyViolations("Classify the problem")).toEqual([]);
  });
});

describe("TASK_COPY", () => {
  it("every member-facing task string passes the copy lint", () => {
    const strings = collectCopyStrings(TASK_COPY);
    expect(strings.length).toBeGreaterThan(40);
    const bad = strings
      .map((s) => ({ s, v: copyViolations(s) }))
      .filter((x) => x.v.length > 0);
    expect(bad).toEqual([]);
  });

  it("every readiness step has a title, a one-line why and a time", () => {
    for (const [step, copy] of Object.entries(TASK_COPY.prepare.steps)) {
      const title = typeof copy.title === "function" ? copy.title("Cycle") : copy.title;
      expect(title, step).toBeTruthy();
      expect(copy.why.length, step).toBeGreaterThan(10);
      expect(copy.why.length, `${step}: why is one line`).toBeLessThan(110);
      expect(copy.minutes, step).toBeGreaterThan(0);
      expect(copy.cta, step).toBeTruthy();
    }
  });

  it("names the card for the cycle when one is announced, and the next Build Cycle otherwise", () => {
    expect(TASK_COPY.prepare.headingFor("Spring 2027")).toBe("Get ready for Spring 2027");
    expect(TASK_COPY.prepare.headingFor(null)).toBe("Get ready for the next Build Cycle");
    expect(TASK_COPY.prepare.progress(2, 4)).toBe("2 of 4 ready");
  });
});
