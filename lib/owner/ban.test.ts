import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// banParticipant composes archiveParticipant (already covered in archive.test.ts).
// Mock it so this file tests only what ban ADDS: the blocklist row, the auth lock,
// and the idempotency of both.
vi.mock("./archive", () => ({
  archiveParticipant: vi.fn(async () => ({
    archived: true,
    rolesRevoked: 2,
    enrollmentsRevoked: 1,
    membershipsClosed: 3,
    assignmentsRemoved: 0,
  })),
}));

import { banParticipant, unbanParticipant } from "./ban";
import { archiveParticipant } from "./archive";

/* The mock resolves each table's chain to a configured `{ data, error }`, and
   records the inserts/updates so the test can assert on what was written. */

interface Recorded {
  table: string;
  op: string;
  payload?: unknown;
}

function mockClient(opts: {
  participant?: Record<string, unknown> | null;
  byTable?: Record<string, unknown>;
  updateUserById?: ReturnType<typeof vi.fn>;
  recorded?: Recorded[];
}): SupabaseClient {
  const recorded = opts.recorded ?? [];
  const make = (table: string, result: unknown): Record<string, unknown> => {
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "neq", "is", "in", "not", "ilike", "maybeSingle"]) {
      q[m] = () => q;
    }
    q.insert = (payload: unknown) => {
      recorded.push({ table, op: "insert", payload });
      return q;
    };
    q.update = (payload: unknown) => {
      recorded.push({ table, op: "update", payload });
      return q;
    };
    (q as { then: unknown }).then = (resolve: (v: unknown) => unknown) => resolve(result);
    return q;
  };

  return {
    from: (table: string) => {
      if (table === "participants" && opts.participant !== undefined) {
        // The loadTarget read and the archived_at clear share this table. The
        // read ends in maybeSingle(); the update ends in select(). Returning a
        // shape that satisfies both keeps the mock honest without branching.
        return make(table, { data: opts.participant, error: null });
      }
      return make(table, opts.byTable?.[table] ?? { data: [], error: null });
    },
    auth: {
      admin: {
        updateUserById: opts.updateUserById ?? vi.fn(async () => ({ error: null })),
      },
    },
  } as unknown as SupabaseClient;
}

const PERSON = {
  id: 7,
  email: "Banned.Person@example.com",
  google_id: "g-123",
  auth_user_id: "auth-uuid-7",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("banParticipant", () => {
  it("archives, blocklists the email, and locks the auth row", async () => {
    const recorded: Recorded[] = [];
    const updateUserById = vi.fn(async () => ({ error: null }));
    const client = mockClient({ participant: PERSON, updateUserById, recorded });

    const result = await banParticipant(client, 7, {
      reason: "conduct",
      actorParticipantId: 1,
    });

    expect(archiveParticipant).toHaveBeenCalledWith(client, 7);
    expect(result.banned).toBe(true);
    expect(result.authLocked).toBe(true);
    // Archive's counts come through untouched — a ban reports everything it did.
    expect(result.rolesRevoked).toBe(2);
    expect(result.membershipsClosed).toBe(3);

    const ban = recorded.find((r) => r.table === "participant_bans" && r.op === "insert");
    expect(ban?.payload).toMatchObject({
      email: PERSON.email,
      google_id: "g-123",
      participant_id: 7,
      reason: "conduct",
      banned_by: 1,
    });

    // A real duration, not a flag: GoTrue has no "forever".
    const [userId, attrs] = updateUserById.mock.calls[0] as unknown as [string, { ban_duration: string }];
    expect(userId).toBe("auth-uuid-7");
    expect(attrs.ban_duration).toMatch(/^\d+h$/);
  });

  it("is idempotent: a duplicate active ban (23505) is not an error", async () => {
    const client = mockClient({
      participant: PERSON,
      byTable: { participant_bans: { data: null, error: { code: "23505" } } },
    });

    const result = await banParticipant(client, 7);

    expect(result.banned).toBe(false); // this call did not create the row
    expect(result.authLocked).toBe(true); // but the lock is re-asserted
  });

  it("rethrows a blocklist write failure that is not a duplicate", async () => {
    const client = mockClient({
      participant: PERSON,
      byTable: { participant_bans: { data: null, error: { code: "42501", message: "denied" } } },
    });

    await expect(banParticipant(client, 7)).rejects.toMatchObject({ code: "42501" });
  });

  it("still blocklists someone who never signed in", async () => {
    const updateUserById = vi.fn(async () => ({ error: null }));
    const client = mockClient({
      participant: { ...PERSON, auth_user_id: null },
      updateUserById,
    });

    const result = await banParticipant(client, 7);

    expect(result.banned).toBe(true);
    expect(result.authLocked).toBe(false);
    expect(result.note).toMatch(/never signed in/i);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("refuses a participant that does not exist", async () => {
    const client = mockClient({ participant: null });
    await expect(banParticipant(client, 7)).rejects.toThrow(/no participant 7/);
  });

  it("refuses a participant with no email — the blocklist has no key without one", async () => {
    const client = mockClient({ participant: { ...PERSON, email: null } });
    await expect(banParticipant(client, 7)).rejects.toThrow(/no email/);
  });
});

describe("unbanParticipant", () => {
  it("lifts the ban, clears archived_at, and unlocks the auth row", async () => {
    const recorded: Recorded[] = [];
    const updateUserById = vi.fn(async () => ({ error: null }));
    const client = mockClient({
      participant: PERSON,
      byTable: {
        participant_bans: { data: [{ id: 11 }], error: null },
        participants: { data: [{ id: 7 }], error: null },
      },
      updateUserById,
      recorded,
    });

    const result = await unbanParticipant(client, 7, { actorParticipantId: 1 });

    expect(result.unbanned).toBe(true);
    expect(result.authUnlocked).toBe(true);

    // Revoked, not deleted: the ban history has to survive the unban.
    const lift = recorded.find((r) => r.table === "participant_bans" && r.op === "update");
    expect(lift?.payload).toMatchObject({ revoked_by: 1 });
    expect((lift?.payload as { revoked_at: string }).revoked_at).toBeTruthy();

    const [, attrs] = updateUserById.mock.calls[0] as unknown as [string, { ban_duration: string }];
    expect(attrs.ban_duration).toBe("none");
  });

  it("does not restore roles — lifting a ban is not a re-grant", async () => {
    const recorded: Recorded[] = [];
    const client = mockClient({ participant: PERSON, recorded });

    await unbanParticipant(client, 7);

    expect(recorded.some((r) => r.table === "participant_roles")).toBe(false);
    expect(recorded.some((r) => r.table === "cycle_enrollments")).toBe(false);
    expect(recorded.some((r) => r.table === "pod_memberships")).toBe(false);
  });
});
