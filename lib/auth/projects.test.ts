import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isProjectDri } from "./projects";
import type { UserRoles } from "./roles";

function baseUser(overrides: Partial<UserRoles> = {}): UserRoles {
  return {
    userId: "u1",
    participantId: 1,
    roles: [],
    permissions: [],
    moderatorPodIds: [],
    labLeadLabIds: [],
    cycleEnrollments: [],
    ...overrides,
  };
}

function fakeSupabase(activeDriRow: { id: number } | null): SupabaseClient {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              is: () => ({
                maybeSingle: async () => ({ data: activeDriRow }),
              }),
            }),
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

describe("isProjectDri", () => {
  it("is true for an admin, regardless of project_roles", async () => {
    const user = baseUser({ permissions: ["cycles:write"] });
    const supabase = fakeSupabase(null);
    expect(await isProjectDri(supabase, user, 1, 1)).toBe(true);
  });

  it("is true for a moderator of the project's pod", async () => {
    const user = baseUser({ moderatorPodIds: [5] });
    const supabase = fakeSupabase(null);
    expect(await isProjectDri(supabase, user, 1, 5)).toBe(true);
  });

  it("is true when the participant holds an active dri project_roles row", async () => {
    const user = baseUser({ participantId: 42 });
    const supabase = fakeSupabase({ id: 1 });
    expect(await isProjectDri(supabase, user, 1, 5)).toBe(true);
  });

  it("is false when none of the above apply", async () => {
    const user = baseUser({ participantId: 42 });
    const supabase = fakeSupabase(null);
    expect(await isProjectDri(supabase, user, 1, 5)).toBe(false);
  });

  it("is false with no participant record and no admin/moderator role", async () => {
    const user = baseUser({ participantId: null });
    const supabase = fakeSupabase(null);
    expect(await isProjectDri(supabase, user, 1, 5)).toBe(false);
  });
});
