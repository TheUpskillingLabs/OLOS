import { describe, it, expect } from "vitest";
import {
  resolvePendingBaselines,
  type BaselineCandidateCycle,
} from "./baseline";

const cycle = (
  overrides: Partial<BaselineCandidateCycle> = {}
): BaselineCandidateCycle => ({
  id: 1,
  name: "Cycle 12",
  status: "upcoming",
  mode: "open",
  ...overrides,
});

const ids = (cycles: { id: number }[]) => cycles.map((c) => c.id);

describe("resolvePendingBaselines", () => {
  it("includes an upcoming open cycle with an inactive enrollment and no baseline", () => {
    const result = resolvePendingBaselines(
      [cycle({ id: 1, status: "upcoming" })],
      new Set([1]),
      new Set()
    );
    expect(ids(result)).toEqual([1]);
    // surfaced shape carries id/name/status, not mode
    expect(result[0]).toEqual({ id: 1, name: "Cycle 12", status: "upcoming" });
  });

  it("includes an active open cycle with an active enrollment and no baseline", () => {
    const result = resolvePendingBaselines(
      [cycle({ id: 2, status: "active" })],
      new Set([2]),
      new Set()
    );
    expect(ids(result)).toEqual([2]);
  });

  it("excludes a cycle whose baseline is already completed", () => {
    const result = resolvePendingBaselines(
      [cycle({ id: 3, status: "active" })],
      new Set([3]),
      new Set([3])
    );
    expect(result).toEqual([]);
  });

  it("excludes an org-mode cycle even when enrolled with no baseline", () => {
    const result = resolvePendingBaselines(
      [cycle({ id: 4, status: "active", mode: "org" })],
      new Set([4]),
      new Set()
    );
    expect(result).toEqual([]);
  });

  it("excludes a cycle the participant is not enrolled in", () => {
    const result = resolvePendingBaselines(
      [cycle({ id: 5, status: "active" })],
      new Set(),
      new Set()
    );
    expect(result).toEqual([]);
  });

  it("excludes draft and closed cycles", () => {
    const result = resolvePendingBaselines(
      [
        cycle({ id: 6, status: "draft" }),
        cycle({ id: 7, status: "closed" }),
        cycle({ id: 8, status: "closing" }),
        cycle({ id: 9, status: "archived" }),
      ],
      new Set([6, 7, 8, 9]),
      new Set()
    );
    expect(result).toEqual([]);
  });

  it("resolves a mixed candidate set to just the pending ones", () => {
    const result = resolvePendingBaselines(
      [
        cycle({ id: 1, status: "upcoming", mode: "open" }), // pending
        cycle({ id: 2, status: "active", mode: "open" }), // completed
        cycle({ id: 3, status: "active", mode: "org" }), // org
        cycle({ id: 4, status: "active", mode: "open" }), // not enrolled
        cycle({ id: 5, status: "active", mode: "open" }), // pending
      ],
      new Set([1, 2, 3, 5]),
      new Set([2])
    );
    expect(ids(result)).toEqual([1, 5]);
  });
});
