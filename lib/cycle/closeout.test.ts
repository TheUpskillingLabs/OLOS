import { beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { closeOutCycle } from "./closeout";

/* The close-out is the "pods dissolve, projects go global" mechanic —
   pinned here: pods flip to dissolved (idempotently), open memberships and
   moderator assignments get stamped, cycle-governed projects flip to
   sector governance inheriting the cycle's sector, and a sector-less
   cycle's projects flip but stay homeless (surfaced, not hidden). */

type Row = Record<string, unknown>;

const state: {
  cycle: { id: number; sector_id: number | null } | null;
  pods: { id: number; status: string }[];
  updates: { table: string; patch: Row; filters: Row }[];
  graduatedRows: { id: number; sector_id: number | null }[];
} = { cycle: null, pods: [], updates: [], graduatedRows: [] };

function client(): SupabaseClient {
  return {
    from(table: string) {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: table === "cycles" ? state.cycle : null,
            }),
            // pods list: .select().eq() awaited directly
            then: (resolve: (v: { data: Row[] }) => void) =>
              resolve({ data: table === "pods" ? state.pods : [] }),
          }),
        }),
        update: (patch: Row) => {
          const filters: Row = {};
          const builder = {
            in: (col: string, vals: unknown[]) => {
              filters[`in:${col}`] = vals;
              return builder;
            },
            eq: (col: string, v: unknown) => {
              filters[`eq:${col}`] = v;
              return builder;
            },
            is: (col: string, v: unknown) => {
              filters[`is:${col}`] = v;
              return builder;
            },
            select: async () => {
              state.updates.push({ table, patch, filters });
              if (table === "projects") {
                return { data: state.graduatedRows };
              }
              if (table === "pods") {
                return {
                  data: (filters["in:id"] as number[]).map((id) => ({ id })),
                };
              }
              // memberships/assignments: pretend two rows each closed
              return { data: [{ id: 1 }, { id: 2 }] };
            },
          };
          return builder;
        },
      };
    },
  } as unknown as SupabaseClient;
}

beforeEach(() => {
  state.cycle = null;
  state.pods = [];
  state.updates = [];
  state.graduatedRows = [];
});

describe("closeOutCycle", () => {
  it("dissolves pods, closes memberships/assignments, graduates projects", async () => {
    state.cycle = { id: 5, sector_id: 9 };
    state.pods = [
      { id: 1, status: "active" },
      { id: 2, status: "forming" },
    ];
    state.graduatedRows = [
      { id: 10, sector_id: 9 },
      { id: 11, sector_id: 9 },
    ];

    const result = await closeOutCycle(client(), 5);

    expect(result.podsDissolved).toBe(2);
    expect(result.membershipsClosed).toBe(2);
    expect(result.assignmentsRemoved).toBe(2);
    expect(result.projectsGraduated).toBe(2);
    expect(result.projectsNeedingSector).toBe(0);

    const podUpdate = state.updates.find((u) => u.table === "pods");
    expect(podUpdate?.patch).toEqual({ status: "dissolved" });
    const projectUpdate = state.updates.find((u) => u.table === "projects");
    expect(projectUpdate?.patch).toEqual({ governance: "sector", sector_id: 9 });
    expect(projectUpdate?.filters["eq:governance"]).toBe("cycle");
  });

  it("skips already-dissolved pods (idempotent re-archive)", async () => {
    state.cycle = { id: 5, sector_id: 9 };
    state.pods = [
      { id: 1, status: "dissolved" },
      { id: 2, status: "active" },
    ];

    const result = await closeOutCycle(client(), 5);
    expect(result.podsDissolved).toBe(1);
    const podUpdate = state.updates.find((u) => u.table === "pods");
    expect(podUpdate?.filters["in:id"]).toEqual([2]);
  });

  it("flips a sector-less cycle's projects but reports them homeless", async () => {
    state.cycle = { id: 5, sector_id: null };
    state.graduatedRows = [{ id: 10, sector_id: null }];

    const result = await closeOutCycle(client(), 5);

    const projectUpdate = state.updates.find((u) => u.table === "projects");
    expect(projectUpdate?.patch).toEqual({ governance: "sector" });
    expect(result.projectsGraduated).toBe(1);
    expect(result.projectsNeedingSector).toBe(1);
  });

  it("is a no-op for a missing cycle", async () => {
    const result = await closeOutCycle(client(), 404);
    expect(result.podsDissolved).toBe(0);
    expect(state.updates).toHaveLength(0);
  });
});
