import { beforeEach, describe, expect, it, vi } from "vitest";

/* The reconciler is THE single write path for the enrollment lifecycle
   (§3.7). These tests pin its contract with a hand-rolled Supabase mock:
   - no enrollment row → no mutation
   - membership reality decides the target status
   - already-correct status → no write
   - demotion with logRevocation → audit row */

const state: {
  enrollment: { id: number; status: string } | null;
  memberships: { id: number; pods: { id: number; status: string; cycle_id: number } }[];
  updates: Record<string, unknown>[];
  inserts: { table: string; row: Record<string, unknown> }[];
} = { enrollment: null, memberships: [], updates: [], inserts: [] };

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from(table: string) {
      if (table === "cycle_enrollments") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: state.enrollment }),
              }),
            }),
          }),
          update: (row: Record<string, unknown>) => ({
            eq: async () => {
              state.updates.push(row);
              return { data: null };
            },
          }),
        };
      }
      if (table === "pod_memberships") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                is: async () => ({ data: state.memberships }),
              }),
            }),
          }),
        };
      }
      if (table === "access_revocations") {
        return {
          insert: async (row: Record<string, unknown>) => {
            state.inserts.push({ table, row });
            return { data: null };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { reconcileEnrollmentActivation } from "./reconciler";

const activePod = { id: 4, pods: { id: 4, status: "active", cycle_id: 1 } };
const formingPod = { id: 5, pods: { id: 5, status: "forming", cycle_id: 1 } };

beforeEach(() => {
  state.enrollment = null;
  state.memberships = [];
  state.updates = [];
  state.inserts = [];
});

describe("reconcileEnrollmentActivation", () => {
  it("never mutates when no enrollment row exists (creation is not its job)", async () => {
    const result = await reconcileEnrollmentActivation(7, 1);
    expect(result.mutated).toBe(false);
    expect(state.updates).toHaveLength(0);
  });

  it("promotes to active when an active-pod membership exists", async () => {
    state.enrollment = { id: 10, status: "inactive" };
    state.memberships = [activePod];
    const result = await reconcileEnrollmentActivation(7, 1);
    expect(result).toMatchObject({ before: "inactive", after: "active", mutated: true });
    expect(state.updates[0]).toMatchObject({ status: "active", inactive_date: null });
  });

  it("a forming pod is not enough to activate", async () => {
    state.enrollment = { id: 10, status: "inactive" };
    state.memberships = [formingPod];
    const result = await reconcileEnrollmentActivation(7, 1);
    expect(result.mutated).toBe(false);
    expect(result.after).toBe("inactive");
  });

  it("is idempotent when status already matches reality", async () => {
    state.enrollment = { id: 10, status: "active" };
    state.memberships = [activePod];
    const result = await reconcileEnrollmentActivation(7, 1);
    expect(result.mutated).toBe(false);
    expect(state.updates).toHaveLength(0);
  });

  it("demotes and audits when asked (the cron path)", async () => {
    state.enrollment = { id: 10, status: "active" };
    state.memberships = [];
    const result = await reconcileEnrollmentActivation(7, 1, {
      logRevocation: true,
      reason: "test",
    });
    expect(result).toMatchObject({ after: "inactive", mutated: true, audited: true });
    expect(state.inserts[0].row).toMatchObject({
      participant_id: 7,
      cycle_id: 1,
      reason: "test",
    });
  });

  it("demotes silently without logRevocation (mechanical after-leave path)", async () => {
    state.enrollment = { id: 10, status: "active" };
    state.memberships = [];
    const result = await reconcileEnrollmentActivation(7, 1);
    expect(result.audited).toBe(false);
    expect(state.inserts).toHaveLength(0);
  });
});
