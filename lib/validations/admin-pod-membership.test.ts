import { describe, expect, it } from "vitest";
import { adminAddPodMembershipSchema } from "./admin-pod-membership";

/* Pins the admin add-member body contract. pod_role's pairing with the
   pod's cycle mode (required on org runs, rejected elsewhere) lives in the
   route, not here — the schema only vouches for shape. */

describe("adminAddPodMembershipSchema", () => {
  it("accepts a bare participant_id (participant-cycle pods)", () => {
    const parsed = adminAddPodMembershipSchema.parse({ participant_id: 7 });
    expect(parsed).toEqual({ participant_id: 7 });
  });

  it("accepts pod_role 'member' and 'co_lead' (org workstream runs)", () => {
    expect(
      adminAddPodMembershipSchema.parse({ participant_id: 7, pod_role: "member" })
    ).toEqual({ participant_id: 7, pod_role: "member" });
    expect(
      adminAddPodMembershipSchema.parse({ participant_id: 7, pod_role: "co_lead" })
    ).toEqual({ participant_id: 7, pod_role: "co_lead" });
  });

  it("rejects unknown pod_role values", () => {
    expect(
      adminAddPodMembershipSchema.safeParse({ participant_id: 7, pod_role: "owner" })
        .success
    ).toBe(false);
    expect(
      adminAddPodMembershipSchema.safeParse({ participant_id: 7, pod_role: "poderator" })
        .success
    ).toBe(false);
  });

  it("rejects a missing or non-positive participant_id", () => {
    expect(adminAddPodMembershipSchema.safeParse({}).success).toBe(false);
    expect(
      adminAddPodMembershipSchema.safeParse({ participant_id: 0 }).success
    ).toBe(false);
    expect(
      adminAddPodMembershipSchema.safeParse({ participant_id: -3 }).success
    ).toBe(false);
    expect(
      adminAddPodMembershipSchema.safeParse({ participant_id: 1.5 }).success
    ).toBe(false);
  });
});
