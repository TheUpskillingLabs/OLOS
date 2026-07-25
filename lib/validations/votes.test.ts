import { describe, expect, it } from "vitest";
import { problemStatementSchema } from "./votes";

/* Pins the proposal_data.statement.repo_url contract: optional, but when
   present it must be a real http(s) URL — it is rendered as an href on the
   ballot, the gallery, and the cycle page, so javascript:/data: schemes
   must fail at the schema, not at render time. */

const base = {
  cycle_id: 3,
  statement_text: "A food truck operator needs to navigate procurement.",
  proposal_data: {
    situation: {
      title: "Procurement locks out the informal economy",
      description:
        "An open, networked condition: city contracts assume a formal back office.",
      openness:
        "Many actors (agencies, operators, banks), no single owner, no known path.",
      paradox:
        "Winning a contract requires the formal infrastructure that only contract revenue would fund.",
    },
    statement: {
      text: "A food truck operator needs to navigate procurement.",
      question: "How might we make procurement navigable?",
    },
  },
};

function withRepoUrl(repo_url?: string) {
  return {
    ...base,
    proposal_data: {
      ...base.proposal_data,
      statement: { ...base.proposal_data.statement, repo_url },
    },
  };
}

describe("problemStatementSchema situation block", () => {
  it("requires a situation title, the one field the lean form collects", () => {
    const missingTitle = {
      ...base,
      proposal_data: {
        ...base.proposal_data,
        situation: { ...base.proposal_data.situation, title: "" },
      },
    };
    expect(problemStatementSchema.safeParse(missingTitle).success).toBe(false);
  });

  it("accepts a lean submission — title only, depth lives in the map", () => {
    const lean = {
      ...base,
      proposal_data: {
        ...base.proposal_data,
        situation: { title: "Procurement locks out the informal economy" },
      },
    };
    expect(problemStatementSchema.safeParse(lean).success).toBe(true);
  });

  it("accepts the optional pressure-test and beneficiaries fields", () => {
    const full = {
      ...base,
      proposal_data: {
        ...base.proposal_data,
        situation: {
          ...base.proposal_data.situation,
          beneficiaries: "Incumbent vendors; the compliance industry.",
          problematization: "Assumes operators want city contracts at all.",
        },
      },
    };
    expect(problemStatementSchema.safeParse(full).success).toBe(true);
  });

  it("still accepts the legacy problem block on old rows (read-only compat)", () => {
    const legacy = {
      ...base,
      proposal_data: {
        ...base.proposal_data,
        problem: {
          who: "a food truck operator",
          need: "navigate procurement",
          barrier: "the form assumes a registered entity",
          success: "she reaches the review stage",
        },
      },
    };
    expect(problemStatementSchema.safeParse(legacy).success).toBe(true);
  });
});

describe("problemStatementSchema repo_url", () => {
  it("accepts a submission without repo_url", () => {
    expect(problemStatementSchema.safeParse(base).success).toBe(true);
  });

  it("accepts an https GitHub URL and keeps it through parse", () => {
    const parsed = problemStatementSchema.parse(
      withRepoUrl("https://github.com/some-org/some-triad-repo")
    );
    expect(parsed.proposal_data?.statement.repo_url).toBe(
      "https://github.com/some-org/some-triad-repo"
    );
  });

  it("rejects non-http(s) schemes even when they parse as URLs", () => {
    expect(
      problemStatementSchema.safeParse(withRepoUrl("javascript:alert(1)"))
        .success
    ).toBe(false);
    expect(
      problemStatementSchema.safeParse(withRepoUrl("data:text/html,hi"))
        .success
    ).toBe(false);
  });

  it("rejects strings that are not URLs at all", () => {
    expect(
      problemStatementSchema.safeParse(withRepoUrl("github dot com")).success
    ).toBe(false);
  });

  it("rejects URLs over 500 characters", () => {
    expect(
      problemStatementSchema.safeParse(
        withRepoUrl("https://github.com/" + "a".repeat(500))
      ).success
    ).toBe(false);
  });
});
