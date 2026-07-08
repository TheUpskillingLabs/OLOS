import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getOperatingCycle,
  getRecruitingCycle,
  getMemberOperatingCycle,
  getMemberRecruitingCycle,
  type CycleRow,
} from "./active";

/* The pickers are the single point every "the active cycle" read flows
   through, and Local Labs (00062) made them lab-scoped: labId=null must
   read the HQ/global stream (`lab_id IS NULL`), a number must read that
   lab's stream, and the member helpers must prefer the member's lab and
   fall back to HQ. A hand-rolled chainable mock records which filters each
   query applied and resolves rows from a caller-provided table. */

type Filter = { op: "eq" | "is"; column: string; value: unknown };

function cycle(overrides: Partial<CycleRow>): CycleRow {
  return {
    id: 1,
    name: "Cycle",
    slug: null,
    start_date: null,
    end_date: null,
    status: "active",
    mode: "open",
    sector_id: null,
    lab_id: null,
    ...overrides,
  };
}

function mockClient(rows: CycleRow[], log: Filter[][] = []) {
  function builder() {
    const filters: Filter[] = [];
    const matches = () =>
      rows.filter((row) =>
        filters.every((f) => {
          const value = (row as unknown as Record<string, unknown>)[f.column];
          return f.op === "is" ? value === f.value : value === f.value;
        })
      );
    const b = {
      eq(column: string, value: unknown) {
        filters.push({ op: "eq", column, value });
        return b;
      },
      is(column: string, value: unknown) {
        filters.push({ op: "is", column, value });
        return b;
      },
      order() {
        return b;
      },
      limit() {
        return b;
      },
      async maybeSingle() {
        log.push(filters);
        return { data: matches()[0] ?? null };
      },
    };
    return b;
  }
  return {
    from: () => ({ select: () => builder() }),
  } as unknown as SupabaseClient;
}

describe("getOperatingCycle", () => {
  const hq = cycle({ id: 1, lab_id: null });
  const balt = cycle({ id: 2, lab_id: 7 });

  it("defaults to the HQ/global stream (lab_id IS NULL)", async () => {
    const log: Filter[][] = [];
    const result = await getOperatingCycle(mockClient([hq, balt], log));
    expect(result?.id).toBe(1);
    expect(log[0]).toContainEqual({ op: "is", column: "lab_id", value: null });
  });

  it("scopes to a lab's stream when labId is given", async () => {
    const log: Filter[][] = [];
    const result = await getOperatingCycle(mockClient([hq, balt], log), 7);
    expect(result?.id).toBe(2);
    expect(log[0]).toContainEqual({ op: "eq", column: "lab_id", value: 7 });
  });
});

describe("getRecruitingCycle", () => {
  it("prefers the upcoming cycle in the same stream", async () => {
    const upcoming = cycle({ id: 3, status: "upcoming" });
    const active = cycle({ id: 1, status: "active" });
    const result = await getRecruitingCycle(mockClient([upcoming, active]));
    expect(result?.id).toBe(3);
  });

  it("falls back to the active cycle within the stream", async () => {
    const active = cycle({ id: 1, status: "active" });
    const result = await getRecruitingCycle(mockClient([active]));
    expect(result?.id).toBe(1);
  });

  it("does not leak another lab's upcoming cycle into HQ", async () => {
    const labUpcoming = cycle({ id: 4, status: "upcoming", lab_id: 7 });
    const hqActive = cycle({ id: 1, status: "active", lab_id: null });
    const result = await getRecruitingCycle(mockClient([labUpcoming, hqActive]));
    expect(result?.id).toBe(1);
  });
});

describe("member helpers (lab first, HQ fallback)", () => {
  const hq = cycle({ id: 1, lab_id: null });
  const balt = cycle({ id: 2, lab_id: 7 });

  it("prefers the member's lab cycle when it exists", async () => {
    const result = await getMemberOperatingCycle(mockClient([hq, balt]), 7);
    expect(result?.id).toBe(2);
  });

  it("falls back to HQ when the member's lab runs no cycle", async () => {
    const result = await getMemberOperatingCycle(mockClient([hq]), 7);
    expect(result?.id).toBe(1);
  });

  it("goes straight to HQ for members without a metro", async () => {
    const result = await getMemberOperatingCycle(mockClient([hq, balt]), null);
    expect(result?.id).toBe(1);
  });

  it("recruiting variant prefers the lab's upcoming cohort", async () => {
    const labUpcoming = cycle({ id: 5, status: "upcoming", lab_id: 7 });
    const result = await getMemberRecruitingCycle(
      mockClient([hq, labUpcoming]),
      7
    );
    expect(result?.id).toBe(5);
  });
});
