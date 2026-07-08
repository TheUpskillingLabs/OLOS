import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveUserRoles,
  isAdmin,
  isOwner,
  isModerator,
  isAnyLabLead,
  can,
} from "./roles";

/* resolveUserRoles now resolves authority from participant_roles — the same
   table DB RLS is_admin()/is_owner() read — so the app and database agree.
   These pin the derivation: role→predicate mapping, poderator→"moderator",
   lab_lead→labLeadLabIds, the admin set (owner/admin/developer), and that
   granular permissions still flow from participant_permissions. */

type Rows = {
  participants?: { id: number } | null;
  participant_roles?: Record<string, unknown>[];
  participant_permissions?: { permission: string }[];
  cycle_enrollments?: { cycle_id: number; status: string }[];
};

function listBuilder(data: unknown[]) {
  const b = {
    select: () => b,
    eq: () => b,
    is: () => b,
    then: (resolve: (v: { data: unknown[] }) => void) => resolve({ data }),
  };
  return b;
}

function mockClient(rows: Rows): SupabaseClient {
  return {
    from(name: string) {
      if (name === "participants") {
        return {
          select: () => ({
            eq: () => ({ single: async () => ({ data: rows.participants ?? null }) }),
          }),
        };
      }
      return listBuilder((rows as Record<string, unknown[]>)[name] ?? []);
    },
  } as unknown as SupabaseClient;
}

const withParticipant = (extra: Omit<Rows, "participants">): Rows => ({
  participants: { id: 1 },
  ...extra,
});

describe("resolveUserRoles authority derivation", () => {
  it("owner → isOwner + isAdmin", async () => {
    const u = await resolveUserRoles(
      mockClient(withParticipant({ participant_roles: [{ role: "owner" }] })),
      "auth-1"
    );
    expect(u.roles).toContain("owner");
    expect(isOwner(u)).toBe(true);
    expect(isAdmin(u)).toBe(true);
  });

  it("admin → isAdmin, not isOwner", async () => {
    const u = await resolveUserRoles(
      mockClient(withParticipant({ participant_roles: [{ role: "admin" }] })),
      "auth-1"
    );
    expect(isAdmin(u)).toBe(true);
    expect(isOwner(u)).toBe(false);
  });

  it("developer is in the admin set (matches RLS)", async () => {
    const u = await resolveUserRoles(
      mockClient(withParticipant({ participant_roles: [{ role: "developer" }] })),
      "auth-1"
    );
    expect(isAdmin(u)).toBe(true);
    expect(isOwner(u)).toBe(false);
  });

  it("observer is neither admin nor owner", async () => {
    const u = await resolveUserRoles(
      mockClient(withParticipant({ participant_roles: [{ role: "observer" }] })),
      "auth-1"
    );
    expect(u.roles).toContain("observer");
    expect(isAdmin(u)).toBe(false);
    expect(isOwner(u)).toBe(false);
  });

  it("poderator → app role 'moderator' + moderatorPodIds", async () => {
    const u = await resolveUserRoles(
      mockClient(
        withParticipant({ participant_roles: [{ role: "poderator", pod_id: 5, lab_id: null }] })
      ),
      "auth-1"
    );
    expect(u.roles).toContain("moderator");
    expect(u.moderatorPodIds).toEqual([5]);
    expect(isModerator(u)).toBe(true);
    expect(isAdmin(u)).toBe(false);
  });

  it("lab_lead → labLeadLabIds, not admin", async () => {
    const u = await resolveUserRoles(
      mockClient(
        withParticipant({ participant_roles: [{ role: "lab_lead", pod_id: null, lab_id: 7 }] })
      ),
      "auth-1"
    );
    expect(u.labLeadLabIds).toEqual([7]);
    expect(isAnyLabLead(u)).toBe(true);
    expect(isAdmin(u)).toBe(false);
  });

  it("member-preference roles are not authority roles", async () => {
    const u = await resolveUserRoles(
      mockClient(withParticipant({ participant_roles: [{ role: "upskiller" }] })),
      "auth-1"
    );
    expect(u.roles).not.toContain("owner");
    expect(isAdmin(u)).toBe(false);
    expect(u.roles).toHaveLength(0);
  });

  it("capabilities derive from roles (admin role → cycles:write)", async () => {
    const u = await resolveUserRoles(
      mockClient(withParticipant({ participant_roles: [{ role: "admin" }] })),
      "auth-1"
    );
    expect(can(u, "cycles:write")).toBe(true);
    expect(can(u, "participants:read")).toBe(true);
  });

  it("legacy per-person grants are unioned in (no regression)", async () => {
    // testing:use has no covering role here, but the legacy grant is preserved.
    const u = await resolveUserRoles(
      mockClient(
        withParticipant({ participant_permissions: [{ permission: "testing:use" }] })
      ),
      "auth-1"
    );
    expect(can(u, "testing:use")).toBe(true);
  });

  it("a role with no global capabilities grants none (lab_lead)", async () => {
    const u = await resolveUserRoles(
      mockClient(
        withParticipant({ participant_roles: [{ role: "lab_lead", pod_id: null, lab_id: 7 }] })
      ),
      "auth-1"
    );
    expect(u.permissions).toHaveLength(0);
  });

  it("active enrollment adds the participant role", async () => {
    const u = await resolveUserRoles(
      mockClient(
        withParticipant({ cycle_enrollments: [{ cycle_id: 1, status: "active" }] })
      ),
      "auth-1"
    );
    expect(u.roles).toContain("participant");
  });

  it("no participant row → empty authority", async () => {
    const u = await resolveUserRoles(mockClient({ participants: null }), "auth-1");
    expect(u.participantId).toBeNull();
    expect(u.roles).toHaveLength(0);
    expect(isAdmin(u)).toBe(false);
  });
});
