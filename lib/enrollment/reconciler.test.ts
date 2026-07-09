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
  membershipRow: { id: number; inactive_at: string | null } | null;
  membershipInserts: Record<string, unknown>[];
  membershipUpdates: { id: number; row: Record<string, unknown> }[];
  enrollmentUpserts: Record<string, unknown>[];
} = {
  enrollment: null,
  memberships: [],
  updates: [],
  inserts: [],
  membershipRow: null,
  membershipInserts: [],
  membershipUpdates: [],
  enrollmentUpserts: [],
};

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
          upsert: async (row: Record<string, unknown>) => {
            state.enrollmentUpserts.push(row);
            return { data: null };
          },
        };
      }
      if (table === "pod_memberships") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                is: async () => ({ data: state.memberships }),
                maybeSingle: async () => ({ data: state.membershipRow }),
              }),
            }),
          }),
          insert: async (row: Record<string, unknown>) => {
            state.membershipInserts.push(row);
            return { data: null };
          },
          update: (row: Record<string, unknown>) => ({
            eq: async (_col: string, id: number) => {
              state.membershipUpdates.push({ id, row });
              return { data: null };
            },
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
      // The post-membership follow seed (followPageSilently) reads the pod's
      // workstream and inserts follows — inert here.
      if (table === "pods") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { workstream_id: null } }),
            }),
          }),
        };
      }
      if (table === "follows") {
        return {
          insert: async (row: Record<string, unknown>) => {
            state.inserts.push({ table, row });
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { reconcileEnrollmentActivation, ensureActivePodMembership } from "./reconciler";

const activePod = { id: 4, pods: { id: 4, status: "active", cycle_id: 1 } };
const formingPod = { id: 5, pods: { id: 5, status: "forming", cycle_id: 1 } };

beforeEach(() => {
  state.enrollment = null;
  state.memberships = [];
  state.updates = [];
  state.inserts = [];
  state.membershipRow = null;
  state.membershipInserts = [];
  state.membershipUpdates = [];
  state.enrollmentUpserts = [];
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

describe("ensureActivePodMembership", () => {
  /* The single path an org co-lead/member joins a workstream through
     (lib/auth/invitations.ts, app/api/pods/[pod_id]/moderators/route.ts).
     Pins the reactivate/insert/no-op branch, the unconditional
     cycle_enrollments seed, and the membership-before-reconcile ordering. */

  it("inserts a new pod_memberships row, seeds cycle_enrollments, and reconciles", async () => {
    state.membershipRow = null;
    state.enrollment = { id: 20, status: "inactive" };
    state.memberships = [activePod];

    await ensureActivePodMembership(7, 6, 2);

    expect(state.membershipInserts).toEqual([{ participant_id: 7, pod_id: 6 }]);
    expect(state.membershipUpdates).toHaveLength(0);
    expect(state.enrollmentUpserts[0]).toMatchObject({
      participant_id: 7,
      cycle_id: 2,
      status: "active",
    });
    // Reconcile ran after the membership write and promoted the enrollment.
    expect(state.updates[0]).toMatchObject({ status: "active", inactive_date: null });
  });

  it("reactivates a soft-deleted membership row instead of inserting", async () => {
    state.membershipRow = { id: 99, inactive_at: "2024-01-01T00:00:00Z" };

    await ensureActivePodMembership(7, 6, 2);

    expect(state.membershipInserts).toHaveLength(0);
    expect(state.membershipUpdates[0]).toMatchObject({
      id: 99,
      row: { inactive_at: null },
    });
  });

  it("no-ops the membership write when already active, but still seeds the enrollment", async () => {
    state.membershipRow = { id: 99, inactive_at: null };

    await ensureActivePodMembership(7, 6, 2);

    expect(state.membershipInserts).toHaveLength(0);
    expect(state.membershipUpdates).toHaveLength(0);
    expect(state.enrollmentUpserts[0]).toMatchObject({
      participant_id: 7,
      cycle_id: 2,
      status: "active",
    });
  });
});
