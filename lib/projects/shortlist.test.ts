import { describe, it, expect } from "vitest";
import {
  computeShortlistCap,
  extractProposalText,
  tallyProjectVotes,
  rankProposals,
  selectShortlistProposals,
  type ProposalRow,
} from "./shortlist";

const proposal = (
  id: number,
  created_at: string,
  data: unknown = { description: `Proposal ${id}` }
): ProposalRow => ({
  id,
  proposal_text: null,
  proposal_data: data,
  created_at,
});

describe("computeShortlistCap", () => {
  it("floors the enrollment division", () => {
    // floor(7 / 3) = 2
    expect(
      computeShortlistCap({ max_projects: 10, project_min: 3 }, 7)
    ).toBe(2);
  });

  it("caps at max_projects when enrollment math allows more", () => {
    expect(
      computeShortlistCap({ max_projects: 1, project_min: 1 }, 100)
    ).toBe(1);
  });

  it("uses the enrollment math when it is the binding constraint", () => {
    expect(
      computeShortlistCap({ max_projects: 10, project_min: 3 }, 6)
    ).toBe(2);
  });

  it("clamps project_min of 0 to 1 (no divide-by-zero)", () => {
    expect(
      computeShortlistCap({ max_projects: 5, project_min: 0 }, 4)
    ).toBe(4);
  });

  it("clamps negative project_min to 1", () => {
    expect(
      computeShortlistCap({ max_projects: 5, project_min: -2 }, 3)
    ).toBe(3);
  });

  it("returns 0 with zero active enrollments", () => {
    expect(
      computeShortlistCap({ max_projects: 5, project_min: 2 }, 0)
    ).toBe(0);
  });
});

describe("extractProposalText", () => {
  it("prefers proposal_data.description over everything", () => {
    expect(
      extractProposalText("legacy", {
        description: "desc",
        summary: "sum",
        title: "title",
        name: "name",
      })
    ).toBe("desc");
  });

  it("falls through description → summary → title → name → proposal_text", () => {
    expect(extractProposalText("legacy", { summary: "sum" })).toBe("sum");
    expect(extractProposalText("legacy", { title: "title" })).toBe("title");
    expect(extractProposalText("legacy", { name: "name" })).toBe("name");
    expect(extractProposalText("legacy", {})).toBe("legacy");
  });

  it("uses proposal_text when proposal_data is null", () => {
    expect(extractProposalText("legacy", null)).toBe("legacy");
  });

  it("returns empty string when nothing is available", () => {
    expect(extractProposalText(null, null)).toBe("");
    expect(extractProposalText(null, {})).toBe("");
  });
});

describe("tallyProjectVotes / rankProposals", () => {
  it("sums votes per proposal and ranks desc with created_at asc tiebreak", () => {
    const tally = tallyProjectVotes([
      { solution_proposal_id: 1, vote_count: 2 },
      { solution_proposal_id: 1, vote_count: 1 },
      { solution_proposal_id: 2, vote_count: 3 },
      { solution_proposal_id: 3, vote_count: 4 },
    ]);
    expect(tally).toEqual({ 1: 3, 2: 3, 3: 4 });

    const ranked = rankProposals(tally, [
      proposal(1, "2026-01-02T00:00:00Z"),
      proposal(2, "2026-01-01T00:00:00Z"),
      proposal(3, "2026-01-03T00:00:00Z"),
    ]);
    // 3 leads on votes; 1 and 2 tie at 3 votes → 2 wins on earlier created_at
    expect(ranked.map((r) => r.solution_proposal_id)).toEqual([3, 2, 1]);
  });
});

describe("selectShortlistProposals", () => {
  const proposals = [
    proposal(1, "2026-01-01T00:00:00Z"),
    proposal(2, "2026-01-02T00:00:00Z"),
    proposal(3, "2026-01-03T00:00:00Z"),
  ];
  const votesFor = (counts: Record<number, number>) =>
    Object.entries(counts).map(([id, vote_count]) => ({
      solution_proposal_id: Number(id),
      vote_count,
    }));

  it("threshold split (>= eligible) then slices to the computed cap", () => {
    const result = selectShortlistProposals(
      votesFor({ 1: 5, 2: 3, 3: 6 }),
      proposals,
      { project_vote_threshold: 5, max_projects: 10, project_min: 3 },
      7 // cap = min(10, floor(7/3)) = 2
    );
    expect(result.shortlistCap).toBe(2);
    expect(result.eligible.map((e) => e.solution_proposal_id)).toEqual([3, 1]);
    expect(result.ineligible.map((e) => e.solution_proposal_id)).toEqual([2]);
    expect(result.toCreate.map((t) => t.solution_proposal_id)).toEqual([3, 1]);
  });

  it("cap of 0 (zero enrollments) shortlists nothing even with eligible proposals", () => {
    const result = selectShortlistProposals(
      votesFor({ 1: 9 }),
      proposals,
      { project_vote_threshold: 1, max_projects: 5, project_min: 2 },
      0
    );
    expect(result.eligible).toHaveLength(1);
    expect(result.toCreate).toEqual([]);
  });

  it("cap binds tighter than eligibility", () => {
    const result = selectShortlistProposals(
      votesFor({ 1: 5, 2: 6, 3: 7 }),
      proposals,
      { project_vote_threshold: 1, max_projects: 1, project_min: 1 },
      50
    );
    expect(result.toCreate.map((t) => t.solution_proposal_id)).toEqual([3]);
  });

  it("carries extracted proposal text into the ranking", () => {
    const result = selectShortlistProposals(
      votesFor({ 1: 5 }),
      [proposal(1, "2026-01-01T00:00:00Z", { description: "Build a solar map" })],
      { project_vote_threshold: 1, max_projects: 5, project_min: 1 },
      10
    );
    expect(result.toCreate[0].text).toBe("Build a solar map");
  });
});
