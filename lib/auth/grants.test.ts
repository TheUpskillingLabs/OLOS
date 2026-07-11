import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canGrant, grantRole, type AuthorityRole } from "./grants";
import type { UserRoles } from "./roles";

/* grants.ts is the single attenuating write path. These pin the delegation
   rules: owner is owner-only; admin grants the global staff roles + lab_lead;
   pod/project roles need admin OR the scoped authority; nobody self-escalates.
   canGrant is the pure core; grantRole adds scope-shape validation + an
   idempotent insert. */

function user(overrides: Partial<UserRoles> = {}): UserRoles {
  return {
    userId: "u",
    participantId: 1,
    roles: [],
    permissions: [],
    moderatorPodIds: [],
    labLeadLabIds: [],
    cycleEnrollments: [],
    ...overrides,
  };
}

const owner = user({ roles: ["owner"] });
const admin = user({ roles: ["admin"] });
const developer = user({ roles: ["developer"] });
const labLead7 = user({ labLeadLabIds: [7] });
const member = user();

describe("canGrant — global roles", () => {
  it("owner is owner-only to grant", () => {
    expect(canGrant(owner, "owner").ok).toBe(true);
    expect(canGrant(admin, "owner").ok).toBe(false);
    expect(canGrant(developer, "owner").ok).toBe(false);
    expect(canGrant(member, "owner").ok).toBe(false);
  });

  it("admin/owner grant admin, developer, observer, staff, tester, lab_lead", () => {
    const roles: AuthorityRole[] = ["admin", "developer", "observer", "staff", "tester", "lab_lead"];
    for (const r of roles) {
      expect(canGrant(admin, r).ok).toBe(true);
      expect(canGrant(owner, r).ok).toBe(true);
      expect(canGrant(member, r).ok).toBe(false);
    }
  });

  it("a developer counts as admin for granting (matches isAdmin)", () => {
    expect(canGrant(developer, "admin").ok).toBe(true);
    expect(canGrant(developer, "owner").ok).toBe(false);
  });
});

describe("canGrant — scoped roles", () => {
  it("poderator: admin, or the lab lead of the pod's lab", () => {
    expect(canGrant(admin, "poderator", { podId: 3, labId: 7 }).ok).toBe(true);
    expect(canGrant(labLead7, "poderator", { podId: 3, labId: 7 }).ok).toBe(true);
    expect(canGrant(labLead7, "poderator", { podId: 3, labId: 8 }).ok).toBe(false);
    expect(canGrant(member, "poderator", { podId: 3, labId: 7 }).ok).toBe(false);
  });

  it("scopeAuthorized lets a verified scoped actor through", () => {
    expect(canGrant(member, "poderator", { podId: 3 }, true).ok).toBe(true);
    expect(canGrant(member, "contributor", { projectId: 9 }, true).ok).toBe(true);
  });

  it("dri/contributor: admin or a verified project DRI", () => {
    expect(canGrant(admin, "dri", { projectId: 9 }).ok).toBe(true);
    expect(canGrant(member, "dri", { projectId: 9 }).ok).toBe(false);
  });
});

function mockClient(opts: { existing?: { id: number } | null; inserted?: { id: number } } = {}) {
  const { existing = null, inserted = { id: 99 } } = opts;
  const chain: Record<string, unknown> = {};
  Object.assign(chain, {
    select: () => chain,
    insert: () => chain,
    update: () => chain,
    eq: () => chain,
    is: () => chain,
    maybeSingle: async () => ({ data: existing }),
    single: async () => ({ data: inserted, error: null }),
  });
  return { from: () => chain } as unknown as SupabaseClient;
}

describe("grantRole", () => {
  it("rejects a global role given a scope (400)", async () => {
    const r = await grantRole(mockClient(), {
      participantId: 2,
      role: "owner",
      scope: { podId: 3 },
      actor: owner,
    });
    expect(r).toMatchObject({ ok: false, status: 400 });
  });

  it("blocks attenuation violations (admin cannot mint owner, 403)", async () => {
    const r = await grantRole(mockClient(), { participantId: 2, role: "owner", actor: admin });
    expect(r).toMatchObject({ ok: false, status: 403 });
  });

  it("is idempotent when an active grant already exists", async () => {
    const r = await grantRole(mockClient({ existing: { id: 5 } }), {
      participantId: 2,
      role: "admin",
      actor: owner,
    });
    expect(r).toEqual({ ok: true, id: 5, alreadyActive: true });
  });

  it("inserts a new grant when the actor is authorized", async () => {
    const r = await grantRole(mockClient({ existing: null, inserted: { id: 42 } }), {
      participantId: 2,
      role: "admin",
      actor: owner,
    });
    expect(r).toEqual({ ok: true, id: 42, alreadyActive: false });
  });

  it("requires a lab scope for lab_lead (400)", async () => {
    const r = await grantRole(mockClient(), { participantId: 2, role: "lab_lead", actor: admin });
    expect(r).toMatchObject({ ok: false, status: 400 });
  });
});
