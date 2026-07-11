import { describe, expect, it } from "vitest";
import { groupCardsByLab, type PodCard } from "./pods-list";

/** Minimal PodCard fixture — groupCardsByLab only reads id/lab_id/lab_name. */
function card(
  id: number,
  lab_id: number | null,
  lab_name: string | null
): PodCard {
  return { id, lab_id, lab_name } as PodCard;
}

describe("groupCardsByLab", () => {
  it("groups multi-lab input in first-appearance order, preserving input order within groups", () => {
    const cards = [
      card(1, 2, "Baltimore"),
      card(2, null, null),
      card(3, 5, "Detroit"),
      card(4, 2, "Baltimore"),
      card(5, null, null),
    ];
    const groups = groupCardsByLab(cards);

    expect(groups.map((g) => g.key)).toEqual(["2", "hq", "5"]);
    expect(groups.map((g) => g.label)).toEqual(["Baltimore", "HQ", "Detroit"]);
    expect(groups.map((g) => g.cards.map((c) => c.id))).toEqual([
      [1, 4],
      [2, 5],
      [3],
    ]);
  });

  it("falls back to `Lab {id}` when a lab card has no lab_name", () => {
    const groups = groupCardsByLab([
      card(1, 7, null),
      card(2, null, null),
    ]);
    expect(groups[0].label).toBe("Lab 7");
    expect(groups[1].label).toBe("HQ");
  });

  it("returns a single label-null group when all cards share one lab", () => {
    const groups = groupCardsByLab([
      card(1, 3, "Oakland"),
      card(2, 3, "Oakland"),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBeNull();
    expect(groups[0].key).toBe("3");
    expect(groups[0].cards.map((c) => c.id)).toEqual([1, 2]);
  });

  it("returns a single label-null group when all cards have null lab_id", () => {
    const groups = groupCardsByLab([card(1, null, null), card(2, null, null)]);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBeNull();
    expect(groups[0].key).toBe("hq");
    expect(groups[0].cards.map((c) => c.id)).toEqual([1, 2]);
  });

  it("splits mixed null + one lab into two groups, null group labeled HQ", () => {
    const groups = groupCardsByLab([
      card(1, null, null),
      card(2, 4, "Chicago"),
      card(3, null, null),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ key: "hq", label: "HQ" });
    expect(groups[1]).toMatchObject({ key: "4", label: "Chicago" });
    expect(groups[0].cards.map((c) => c.id)).toEqual([1, 3]);
    expect(groups[1].cards.map((c) => c.id)).toEqual([2]);
  });

  it("returns no groups for empty input", () => {
    expect(groupCardsByLab([])).toEqual([]);
  });
});
