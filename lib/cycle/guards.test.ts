import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rejectOrgCycle } from "./guards";

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
