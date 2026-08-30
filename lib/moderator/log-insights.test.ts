import { describe, it, expect } from "vitest";
import {
  assignPseudonyms,
  buildLogEntries,
  buildLogInsightsBundle,
  LOG_INSIGHTS_PROMPT,
  type LogInsightRow,
} from "./log-insights";

const base: LogInsightRow = {
  participant_id: 0,
  created_at: "2026-08-22T13:00:00Z",
  kind: "weekly",
  is_blocked: false,
  progress_rating: null,
  energy_rating: null,
  work_summary: null,
  work_progress: null,
  work_blockers: null,
  stuck_tried: null,
  learned: null,
  contribution: null,
  recognition: null,
  clarity: null,
  alignment: null,
  accomplished: null,
  exploring: null,
  next_focus: null,
  blocker_context: null,
};

describe("assignPseudonyms", () => {
  it("is stable across input order (sorted by participant_id)", () => {
    const a = assignPseudonyms([42, 7, 99, 7]);
    const b = assignPseudonyms([99, 42, 7]);
    expect(a.get(7)).toBe("Member A");
    expect(a.get(42)).toBe("Member B");
    expect(a.get(99)).toBe("Member C");
    expect(b).toEqual(a);
  });

  it("rolls to double letters past 26 members", () => {
    const ids = Array.from({ length: 28 }, (_, i) => i + 1);
    const m = assignPseudonyms(ids);
    expect(m.get(26)).toBe("Member Z");
    expect(m.get(27)).toBe("Member AA");
    expect(m.get(28)).toBe("Member AB");
  });
});

describe("buildLogEntries", () => {
  it("labels with pseudonym, date, kind, present ratings, and BLOCKED", () => {
    const [e] = buildLogEntries([
      {
        ...base,
        participant_id: 5,
        is_blocked: true,
        progress_rating: 4,
        energy_rating: 2,
        work_blockers: "  waiting on data access  ",
      },
    ]);
    expect(e.label).toContain("Member A");
    expect(e.label).toContain("weekly");
    expect(e.label).toContain("progress 4/5");
    expect(e.label).toContain("energy 2/5");
    expect(e.label).toContain("BLOCKED");
    expect(e.label).not.toContain("clarity");
    expect(e.text).toBe("Blockers: waiting on data access");
  });

  it("renders v1 fields for older rows and skips empty strings", () => {
    const [e] = buildLogEntries([
      {
        ...base,
        participant_id: 9,
        clarity: 3,
        alignment: 5,
        accomplished: "shipped the survey",
        exploring: "   ",
      },
    ]);
    expect(e.label).toContain("clarity 3/5");
    expect(e.label).toContain("alignment 5/5");
    expect(e.text).toBe("Accomplished: shipped the survey");
    expect(e.text).not.toContain("Exploring");
  });

  it("never leaks a participant_id into label or text", () => {
    const entries = buildLogEntries([
      { ...base, participant_id: 12345, work_summary: "hello" },
    ]);
    expect(entries[0].label).not.toContain("12345");
    expect(entries[0].text).not.toContain("12345");
  });
});

describe("buildLogInsightsBundle", () => {
  it("starts with the meta-prompt, separates with ---, includes every entry", () => {
    const entries = buildLogEntries([
      { ...base, participant_id: 1, work_summary: "first" },
      { ...base, participant_id: 2, work_summary: "second" },
    ]);
    const bundle = buildLogInsightsBundle(entries);
    expect(bundle.startsWith(LOG_INSIGHTS_PROMPT)).toBe(true);
    expect(bundle).toContain("\n\n---\n\n");
    expect(bundle).toContain("first");
    expect(bundle).toContain("second");
    expect(bundle.indexOf("first")).toBeGreaterThan(bundle.indexOf("---"));
  });

  it("marks ratings-only entries instead of emitting empty text", () => {
    const bundle = buildLogInsightsBundle(
      buildLogEntries([{ ...base, participant_id: 3, progress_rating: 5 }])
    );
    expect(bundle).toContain("(ratings only — no written reflection)");
  });
});
