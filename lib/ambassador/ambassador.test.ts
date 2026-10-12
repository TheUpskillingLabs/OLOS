import { describe, expect, it } from "vitest";
import { apply, STEPS, publicQuiz, AMBASSADOR_AGREEMENT_VERSION } from "./content";
import { gradeQuiz } from "./quiz";
import { parseInline, parseMarkdown } from "./markdown";
import {
  ambassadorStage,
  canSubmit,
  guidePrimary,
  guideProgress,
  resumeStage,
  type AmbassadorApplication,
} from "./status";

const key = apply.quiz.questions.map((q) => q.answer);

function app(over: Partial<AmbassadorApplication> = {}): AmbassadorApplication {
  return {
    id: 1, participant_id: 1, lab_id: null, status: "started",
    oriented_at: null, quiz_version: null, quiz_score: null, quiz_total: null, quiz_passed_at: null,
    agreement_version: null, agreement_accepted_at: null, referred_by: null, referred_by_participant_id: null,
    invite_id: null, submitted_at: null, decided_at: null, decided_by: null, decision_note: null,
    ready_at: null, button_given_at: null, button_given_by: null,
    created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z",
    ...over,
  };
}

describe("gradeQuiz", () => {
  it("passes a perfect paper and returns every explanation", () => {
    const r = gradeQuiz(key)!;
    expect(r).toMatchObject({ score: key.length, total: key.length, passed: true });
    expect(r.results.every((x) => x.right && x.note.length > 0)).toBe(true);
  });

  it("passes at exactly the pass mark", () => {
    const answers = key.map((a, i) => (i < key.length - apply.quiz.pass ? (a + 1) % 4 : a));
    const r = gradeQuiz(answers)!;
    expect(r.score).toBe(apply.quiz.pass);
    expect(r.passed).toBe(true);
  });

  it("fails below the mark and gives hints, never the answer, for wrong ones", () => {
    const answers = key.map((a, i) => (i < 3 ? (a + 1) % 4 : a));
    const r = gradeQuiz(answers)!;
    expect(r.passed).toBe(false);
    expect(r.results[0]).toEqual({ right: false, note: apply.quiz.questions[0].hint });
    expect(r.results[5]).toEqual({ right: true, note: "" });
  });

  it("rejects malformed answers", () => {
    expect(gradeQuiz([0, 1])).toBeNull();
    expect(gradeQuiz(key.map(() => 99))).toBeNull();
    expect(gradeQuiz(key.map(() => 0.5))).toBeNull();
  });

  it("publicQuiz never ships answers or explanations", () => {
    const json = JSON.stringify(publicQuiz());
    expect(json).not.toContain('"answer"');
    expect(json).not.toContain('"why"');
  });
});

describe("ambassador stage", () => {
  it("a role grant wins over any application state", () => {
    expect(ambassadorStage(null, true)).toBe("ambassador");
    expect(ambassadorStage(app({ status: "declined" }), true)).toBe("ambassador");
  });

  it("maps application statuses", () => {
    expect(ambassadorStage(null, false)).toBe("none");
    expect(ambassadorStage(app(), false)).toBe("applying");
    expect(ambassadorStage(app({ status: "pending" }), false)).toBe("pending");
    expect(ambassadorStage(app({ status: "declined" }), false)).toBe("declined");
    expect(ambassadorStage(app({ status: "approved" }), false)).toBe("stepped_back");
  });

  it("resumes the apply flow at the first unfinished screen", () => {
    expect(resumeStage(null)).toBe("video");
    expect(resumeStage(app({ oriented_at: "x" }))).toBe("quiz");
    expect(resumeStage(app({ oriented_at: "x", quiz_passed_at: "x" }))).toBe("agreement");
    expect(resumeStage(app({ quiz_passed_at: "x", agreement_version: "old-v0" }))).toBe("agreement");
    expect(resumeStage(app({ quiz_passed_at: "x", agreement_version: AMBASSADOR_AGREEMENT_VERSION }))).toBe("details");
    expect(resumeStage(app({ status: "pending" }))).toBe("done");
  });

  it("can submit only with a pass and the current agreement", () => {
    expect(canSubmit(app({ quiz_passed_at: "x" }))).toBe(false);
    expect(canSubmit(app({ quiz_passed_at: "x", agreement_version: "old-v0" }))).toBe(false);
    expect(canSubmit(app({ quiz_passed_at: "x", agreement_version: AMBASSADOR_AGREEMENT_VERSION }))).toBe(true);
  });
});

describe("guide progress", () => {
  it("counts only steps on the path and finds the next one in order", () => {
    const p = guideProgress([STEPS[1].id, "not-a-step"]);
    expect(p.count).toBe(1);
    expect(p.next?.id).toBe(STEPS[0].id);
    expect(guidePrimary(p, null)?.href).toBe(`/ambassador/guide/${STEPS[0].id}`);
  });

  it("offers Start first, then the ready action, then nothing", () => {
    expect(guidePrimary(guideProgress([]), null)?.label).toBe("Start");
    const all = guideProgress(STEPS.map((s) => s.id));
    expect(all.complete).toBe(true);
    expect(guidePrimary(all, null)).toMatchObject({ action: "ready", href: null });
    expect(guidePrimary(all, "2026-10-01T00:00:00Z")).toBeNull();
  });
});

describe("step markdown", () => {
  it("parses every step without an unknown block", () => {
    for (const s of STEPS) expect(() => parseMarkdown(s.body, s.id)).not.toThrow();
  });

  it("parses headings, quotes, lists, blocks and inline marks", () => {
    const b = parseMarkdown("## One\n\nHello **there** and *you*.\n\n> \"Quote\"\n\n- a\n- [b](https://x.org)\n\n<!-- ladder -->");
    expect(b.map((x) => x.kind)).toEqual(["h2", "p", "quote", "ul", "block"]);
    expect(parseInline("a **b** c")).toEqual([
      { kind: "text", text: "a " },
      { kind: "strong", children: [{ kind: "text", text: "b" }] },
      { kind: "text", text: " c" },
    ]);
  });

  it("throws on an unknown block, naming it", () => {
    expect(() => parseMarkdown("<!-- ladderr -->", "labs")).toThrow(/ladderr.*labs/);
  });
});
