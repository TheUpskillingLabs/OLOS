import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { archiveParticipant } from "./archive";

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
