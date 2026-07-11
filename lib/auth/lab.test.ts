import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserRoles } from "./roles";

/* The lab guard is the fail-closed line for every route relaxed from
   admin-only to admin-or-lab-lead. Contract pinned here:
   - admin always passes (HQ can never be locked out)
   - a lead passes only for THEIR lab
   - HQ/global resources (lab null) stay admin-only
   - the pod resolver walks pod → cycle → lab_id */

const state: {
  cycleLab: { lab_id: number | null } | null;
  podRow: { lab_id: number | null } | null;
} = { cycleLab: null, podRow: null };

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from(table: string) {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data:
                table === "cycles"
                  ? state.cycleLab
                  : table === "pods"
                    ? state.podRow
                    : null,
            }),
          }),
        }),
      };
    },
  }),
}));

import {
  requireLabAccess,
  labForPod,
  requireLabAccessForCycle,
  requireLabOrgCycleCreate,
} from "./lab";

function user(overrides: Partial<UserRoles> = {}): UserRoles {
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

const admin = () => user({ roles: ["admin"] });
const leadOf = (labId: number) => user({ labLeadLabIds: [labId] });

beforeEach(() => {
  state.cycleLab = null;
  state.podRow = null;
});

describe("requireLabAccess", () => {
  it("admin passes for any lab and for HQ (null)", () => {
    expect(requireLabAccess(admin(), 7)).toBeNull();
    expect(requireLabAccess(admin(), null)).toBeNull();
  });

  it("a lead passes only for their own lab", () => {
    expect(requireLabAccess(leadOf(7), 7)).toBeNull();
    expect(requireLabAccess(leadOf(7), 8)?.status).toBe(403);
  });

  it("HQ/global resources stay admin-only for leads", () => {
    expect(requireLabAccess(leadOf(7), null)?.status).toBe(403);
  });

  it("plain members are denied", () => {
    expect(requireLabAccess(user(), 7)?.status).toBe(403);
  });
});

describe("requireLabOrgCycleCreate", () => {
  it("admin passes even with no lab_id", () => {
    expect(requireLabOrgCycleCreate(admin(), { mode: "open" })).toBeNull();
  });

  it("a lead of lab 7 creating their own org cycle passes", () => {
    expect(
      requireLabOrgCycleCreate(leadOf(7), { mode: "org", lab_id: 7 })
    ).toBeNull();
  });

  it("a lead of lab 7 creating lab 8's org cycle is denied", () => {
    expect(
      requireLabOrgCycleCreate(leadOf(7), { mode: "org", lab_id: 8 })?.status
    ).toBe(403);
  });

  it("a lead missing lab_id is denied with the self-service copy", async () => {
    const res = requireLabOrgCycleCreate(leadOf(7), { mode: "org" });
    expect(res?.status).toBe(403);
    const body = await res?.json();
    expect(body.error).toMatch(/include your lab_id/);
  });

  it("a lead attempting mode 'open' is denied", () => {
    expect(
      requireLabOrgCycleCreate(leadOf(7), { mode: "open", lab_id: 7 })?.status
    ).toBe(403);
  });

  it("a plain member is denied", () => {
    expect(
      requireLabOrgCycleCreate(user(), { mode: "org", lab_id: 7 })?.status
    ).toBe(403);
  });
});

describe("labForPod", () => {
  it("reads the pod's own lab tag (pods.lab_id, 00067)", async () => {
    state.podRow = { lab_id: 7 };
    expect(await labForPod(1)).toBe(7);
  });

  it("returns null for HQ pods and missing pods", async () => {
    state.podRow = { lab_id: null };
    expect(await labForPod(1)).toBeNull();
    state.podRow = null;
    expect(await labForPod(999)).toBeNull();
  });
});

describe("requireLabAccessForCycle", () => {
  it("lets a lead manage their lab's cycle resources", async () => {
    state.cycleLab = { lab_id: 7 };
    expect(await requireLabAccessForCycle(leadOf(7), 3)).toBeNull();
  });

  it("denies a lead on an HQ cycle", async () => {
    state.cycleLab = { lab_id: null };
    expect((await requireLabAccessForCycle(leadOf(7), 3))?.status).toBe(403);
  });

  it("admin skips the resolver entirely", async () => {
    state.cycleLab = null; // even a missing cycle can't block an admin
    expect(await requireLabAccessForCycle(admin(), 3)).toBeNull();
  });
});
