import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rejectOrgCycle, orgForbiddenConfigKeys } from "./guards";

function fakeSupabase(cycle: { mode: string } | null): SupabaseClient {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: cycle }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

describe("rejectOrgCycle", () => {
  it("returns null for a participant ('open') cycle", async () => {
    const supabase = fakeSupabase({ mode: "open" });
    expect(await rejectOrgCycle(supabase, 1)).toBeNull();
  });

  it("returns null when the cycle is missing (defers to caller's 404)", async () => {
    const supabase = fakeSupabase(null);
    expect(await rejectOrgCycle(supabase, 999)).toBeNull();
  });

  it("403s for an org cycle with the default message", async () => {
    const supabase = fakeSupabase({ mode: "org" });
    const res = await rejectOrgCycle(supabase, 2);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    const body = await res!.json();
    expect(body.error).toMatch(/organization cycles/i);
  });

  it("403s for an org cycle with a custom message", async () => {
    const supabase = fakeSupabase({ mode: "org" });
    const res = await rejectOrgCycle(supabase, 2, "Nope.");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    const body = await res!.json();
    expect(body.error).toBe("Nope.");
  });
});

describe("orgForbiddenConfigKeys", () => {
  it("returns [] for an empty body", () => {
    expect(orgForbiddenConfigKeys({})).toEqual([]);
  });

  it("returns [] when only allowed keys are present", () => {
    expect(
      orgForbiddenConfigKeys({
        pod_limit: 5,
        milestone_mid_week: 4,
        milestone_final_week: 8,
        log_gate_paused: true,
      })
    ).toEqual([]);
  });

  it("returns exactly the forbidden keys, sorted", () => {
    expect(
      orgForbiddenConfigKeys({
        pod_limit: 5,
        voting_open: "2026-01-01",
        submitter_votes: 3,
        milestone_mid_week: 4,
      })
    ).toEqual(["submitter_votes", "voting_open"]);
  });

  it("ignores keys with undefined values", () => {
    expect(
      orgForbiddenConfigKeys({
        pod_limit: 5,
        voting_open: undefined,
        max_pods: undefined,
      })
    ).toEqual([]);
  });
});
