import { describe, it, expect } from "vitest";
import { rankAndSelect, type RankItem } from "./rank";

const item = (
  id: number,
  votes: number,
  createdAt: string
): RankItem => ({
  problem_statement_id: id,
  total_votes: votes,
  created_at: createdAt,
});

describe("rankAndSelect", () => {
  it("sorts by votes desc", () => {
    const { ranked } = rankAndSelect(
      [item(1, 3, "2026-01-01"), item(2, 9, "2026-01-01"), item(3, 5, "2026-01-01")],
      { voteThreshold: 0, maxPods: 10 }
    );
    expect(ranked.map((r) => r.problem_statement_id)).toEqual([2, 3, 1]);
  });

  it("breaks vote ties by earliest created_at", () => {
    const { ranked } = rankAndSelect(
      [item(1, 5, "2026-02-10"), item(2, 5, "2026-01-05"), item(3, 5, "2026-01-31")],
      { voteThreshold: 0, maxPods: 10 }
    );
    expect(ranked.map((r) => r.problem_statement_id)).toEqual([2, 3, 1]);
  });

  it("filters out statements below the threshold", () => {
    const { eligible, ineligible } = rankAndSelect(
      [item(1, 2, "2026-01-01"), item(2, 5, "2026-01-01"), item(3, 4, "2026-01-01")],
      { voteThreshold: 4, maxPods: 10 }
    );
    expect(eligible.map((r) => r.problem_statement_id)).toEqual([2, 3]);
    expect(ineligible.map((r) => r.problem_statement_id)).toEqual([1]);
  });

  it("caps selection at maxPods (the per-lab cap)", () => {
    const { selected } = rankAndSelect(
      [item(1, 9, "2026-01-01"), item(2, 8, "2026-01-01"), item(3, 7, "2026-01-01")],
      { voteThreshold: 1, maxPods: 2 }
    );
    expect(selected.map((r) => r.problem_statement_id)).toEqual([1, 2]);
  });

  it("selects only from eligible (threshold applies before the cap)", () => {
    const { selected } = rankAndSelect(
      [item(1, 9, "2026-01-01"), item(2, 1, "2026-01-01"), item(3, 8, "2026-01-01")],
      { voteThreshold: 5, maxPods: 5 }
    );
    expect(selected.map((r) => r.problem_statement_id)).toEqual([1, 3]);
  });

  it("handles an empty ballot", () => {
    const r = rankAndSelect([], { voteThreshold: 3, maxPods: 4 });
    expect(r.ranked).toEqual([]);
    expect(r.selected).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const input = [item(1, 1, "2026-01-02"), item(2, 9, "2026-01-01")];
    const snapshot = input.map((i) => i.problem_statement_id);
    rankAndSelect(input, { voteThreshold: 0, maxPods: 1 });
    expect(input.map((i) => i.problem_statement_id)).toEqual(snapshot);
  });
});
