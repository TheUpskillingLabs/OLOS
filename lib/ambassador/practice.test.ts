import { describe, expect, it } from "vitest";
import { dealRound, hasMore, isRoundDone, swipeRating, visibleStack } from "./practice";

const cards = [
  { id: "a", core: true },
  { id: "b", core: true },
  { id: "c", core: true },
  { id: "d", core: false },
  { id: "e", core: false },
];

describe("dealRound", () => {
  it("keeps original order with no checks", () => {
    expect(dealRound(cards, {}, true).map((c) => c.id)).toEqual(["a", "b", "c"]);
  });
  it("puts not-yet cards first, stably", () => {
    expect(dealRound(cards, { b: "not", c: "not", a: "had" }, true).map((c) => c.id)).toEqual(["b", "c", "a"]);
  });
  it("deals only the other set for More situations", () => {
    expect(dealRound(cards, { e: "not" }, false).map((c) => c.id)).toEqual(["e", "d"]);
  });
  it("does not mutate the input", () => {
    const copy = [...cards];
    dealRound(cards, { c: "not" }, true);
    expect(cards).toEqual(copy);
  });
});

describe("round helpers", () => {
  it("shows at most three cards from the position", () => {
    expect(visibleStack([1, 2, 3, 4, 5], 1)).toEqual([2, 3, 4]);
    expect(visibleStack([1, 2], 1)).toEqual([2]);
    expect(visibleStack([1, 2], 2)).toEqual([]);
  });
  it("knows when a round is done", () => {
    expect(isRoundDone([1, 2], 1)).toBe(false);
    expect(isRoundDone([1, 2], 2)).toBe(true);
  });
  it("detects a remaining round", () => {
    expect(hasMore(cards)).toBe(true);
    expect(hasMore(cards.slice(0, 3))).toBe(false);
  });
  it("commits swipes past the threshold only", () => {
    expect(swipeRating(111)).toBe("had");
    expect(swipeRating(-111)).toBe("not");
    expect(swipeRating(110)).toBeNull();
    expect(swipeRating(-40)).toBeNull();
  });
});
