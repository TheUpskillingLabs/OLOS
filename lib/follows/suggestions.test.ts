import { describe, it, expect } from "vitest";
import { orderSuggestions, type Suggestion } from "./suggestions";

const mk = (id: number, name: string, reason: string): Suggestion => ({
  id,
  name,
  initials: name.slice(0, 2).toUpperCase(),
  avatarUrl: null,
  handle: null,
  headline: null,
  reason,
});

describe("orderSuggestions", () => {
  it("ranks pod over lab over cycle, then by name", () => {
    const ordered = orderSuggestions([
      mk(1, "Zed", "In your cycle"),
      mk(2, "Ada", "In your lab"),
      mk(3, "Bea", "In your pod"),
      mk(4, "Abe", "In your lab"),
    ]);
    expect(ordered.map((s) => s.id)).toEqual([3, 4, 2, 1]);
  });

  it("sends unknown reasons to the back and does not mutate the input", () => {
    const input = [mk(1, "A", "mystery"), mk(2, "B", "In your pod")];
    const ordered = orderSuggestions(input);
    expect(ordered.map((s) => s.id)).toEqual([2, 1]);
    expect(input.map((s) => s.id)).toEqual([1, 2]);
  });
});
