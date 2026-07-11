import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// archiveCycle delegates the close-out to closeOutCycle (already tested in
// lib/cycle/closeout.test.ts); mock it so this file tests only the status flip + merge.
vi.mock("@/lib/cycle/closeout", () => ({
  closeOutCycle: vi.fn(async () => ({
    podsDissolved: 2,
    membershipsClosed: 3,
    assignmentsRemoved: 1,
    projectsGraduated: 4,
    projectsNeedingSector: 0,
  })),
}));

import { archiveParticipant, archivePod, archiveCycle } from "./archive";

/* archiveParticipant is idempotent, service-client-driven deactivation. The mock
   resolves each table's update chain to a configured `{ data }`; the returned counts
   must reflect only rows a call actually changed, and a re-archive (every filter
   matching zero rows) must be a clean no-op. */

function makeQuery(result: unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ["update", "select", "eq", "neq", "is", "in"]) {
    q[m] = () => q;
  }
  (q as { then: unknown }).then = (resolve: (v: unknown) => unknown) => resolve(result);
  return q;
}

function mockClient(byTable: Record<string, unknown>): SupabaseClient {
  return {
    from: (table: string) => makeQuery(byTable[table] ?? { data: [] }),
  } as unknown as SupabaseClient;
}

describe("archiveParticipant", () => {
  it("reports the rows each table actually changed", async () => {
    const client = mockClient({
      participants: { data: [{ id: 7 }] },
      participant_roles: { data: [{ participant_id: 7 }, { participant_id: 7 }] },
      cycle_enrollments: { data: [{ id: 1 }] },
      pod_memberships: { data: [{ id: 2 }, { id: 3 }, { id: 4 }] },
      moderator_assignments: { data: [] },
    });

    const result = await archiveParticipant(client, 7);

    expect(result).toEqual({
      archived: true,
      rolesRevoked: 2,
      enrollmentsRevoked: 1,
      membershipsClosed: 3,
      assignmentsRemoved: 0,
    });
  });

  it("is a no-op when already archived (all filters match nothing)", async () => {
    const client = mockClient({}); // every table → { data: [] }

    const result = await archiveParticipant(client, 7);

    expect(result).toEqual({
      archived: false,
      rolesRevoked: 0,
      enrollmentsRevoked: 0,
      membershipsClosed: 0,
      assignmentsRemoved: 0,
    });
  });
});

describe("archivePod", () => {
  it("dissolves the pod and closes memberships + assignments", async () => {
    const client = mockClient({
      pods: { data: [{ id: 5 }] },
      pod_memberships: { data: [{ id: 1 }, { id: 2 }] },
      moderator_assignments: { data: [{ id: 9 }] },
    });
    expect(await archivePod(client, 5)).toEqual({
      archived: true,
      membershipsClosed: 2,
      assignmentsRemoved: 1,
    });
  });

  it("is a no-op when already dissolved", async () => {
    expect(await archivePod(mockClient({}), 5)).toEqual({
      archived: false,
      membershipsClosed: 0,
      assignmentsRemoved: 0,
    });
  });
});

describe("archiveCycle", () => {
  it("flips status → archived and merges the close-out result", async () => {
    const client = mockClient({ cycles: { data: [{ id: 3 }] } });
    expect(await archiveCycle(client, 3)).toEqual({
      archived: true,
      podsDissolved: 2,
      membershipsClosed: 3,
      assignmentsRemoved: 1,
      projectsGraduated: 4,
      projectsNeedingSector: 0,
    });
  });

  it("reports archived=false when the cycle was already archived", async () => {
    const result = await archiveCycle(mockClient({}), 3);
    expect(result.archived).toBe(false);
    expect(result.podsDissolved).toBe(2); // close-out still runs (idempotent)
  });
});
