import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  rejectOrgCycle,
  orgForbiddenConfigKeys,
  isInviteOnlyBlocked,
  rejectUninvited,
} from "./guards";

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

describe("isInviteOnlyBlocked", () => {
  it("never blocks when the flag is off or config is missing", () => {
    expect(isInviteOnlyBlocked({ invite_only: false }, null)).toBe(false);
    expect(isInviteOnlyBlocked(null, null)).toBe(false);
    expect(isInviteOnlyBlocked({ invite_only: null }, null)).toBe(false);
  });

  it("blocks an invite-only cycle when there is no enrollment", () => {
    expect(isInviteOnlyBlocked({ invite_only: true }, null)).toBe(true);
  });

  it("admits registered / active enrollments on an invite-only cycle", () => {
    expect(isInviteOnlyBlocked({ invite_only: true }, { status: "registered" })).toBe(false);
    expect(isInviteOnlyBlocked({ invite_only: true }, { status: "active" })).toBe(false);
  });

  it("blocks exited enrollments on an invite-only cycle", () => {
    expect(isInviteOnlyBlocked({ invite_only: true }, { status: "inactive" })).toBe(true);
    expect(isInviteOnlyBlocked({ invite_only: true }, { status: "revoked" })).toBe(true);
  });
});

describe("rejectUninvited", () => {
  // Answers cycle_config and cycle_enrollments by table name; the enrollment
  // query chains two .eq() calls, so eq() returns the same builder.
  function fakeSupabaseTables(tables: {
    cycle_config: { invite_only: boolean } | null;
    cycle_enrollments: { status: string } | null;
  }): SupabaseClient {
    return {
      from: (table: keyof typeof tables) => {
        const builder = {
          select: () => builder,
          eq: () => builder,
          maybeSingle: async () => ({ data: tables[table] }),
        };
        return builder;
      },
    } as unknown as SupabaseClient;
  }

  it("returns null for an open-registration cycle", async () => {
    const supabase = fakeSupabaseTables({
      cycle_config: { invite_only: false },
      cycle_enrollments: null,
    });
    expect(await rejectUninvited(supabase, 1, 10)).toBeNull();
  });

  it("returns null for an invited (enrolled) member", async () => {
    const supabase = fakeSupabaseTables({
      cycle_config: { invite_only: true },
      cycle_enrollments: { status: "registered" },
    });
    expect(await rejectUninvited(supabase, 1, 10)).toBeNull();
  });

  it("403s an uninvited member with the default message", async () => {
    const supabase = fakeSupabaseTables({
      cycle_config: { invite_only: true },
      cycle_enrollments: null,
    });
    const res = await rejectUninvited(supabase, 1, 10);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    const body = await res!.json();
    expect(body.error).toMatch(/invite-only/i);
  });

  it("403s with a custom message", async () => {
    const supabase = fakeSupabaseTables({
      cycle_config: { invite_only: true },
      cycle_enrollments: { status: "revoked" },
    });
    const res = await rejectUninvited(supabase, 1, 10, "Nope.");
    expect(res!.status).toBe(403);
    expect((await res!.json()).error).toBe("Nope.");
  });
});
