import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRoles } from "@/lib/auth/roles";
import {
  isPageAdmin,
  pageHref,
  pageTypeLabel,
  mergeAdminRosters,
  type PageAdminEntry,
} from "./authz";

// A service client that fails the test if any DB call is made — proves the
// synchronous auto-admin short-circuits (admin / lab-lead / pod-moderator)
// never touch the database.
const noDb = {
  from() {
    throw new Error("DB should not be queried on a fast-path");
  },
} as unknown as SupabaseClient;

function roles(overrides: Partial<UserRoles>): UserRoles {
  return {
    userId: "u",
    participantId: 1,
    roles: [],
    permissions: [],
    moderatorPodIds: [],
    labLeadLabIds: [],
    cycleEnrollments: [],
    ...overrides,
  } as UserRoles;
}

describe("pageHref / pageTypeLabel", () => {
  it("builds canonical links per type", () => {
    expect(pageHref("lab", "dc")).toBe("/local-labs/dc");
    expect(pageHref("sector", "civic")).toBe("/sectors/civic");
    expect(pageHref("workstream", "elections")).toBe("/workstreams/elections");
    expect(pageHref("pod", 7)).toBe("/pods/7");
    expect(pageHref("project", 9)).toBe("/projects/9");
  });
  it("labels each type", () => {
    expect(pageTypeLabel("lab")).toBe("Local Lab");
    expect(pageTypeLabel("project")).toBe("Project");
  });
});

describe("mergeAdminRosters", () => {
  const mk = (
    participantId: number,
    name: string,
    source: PageAdminEntry["source"]
  ): PageAdminEntry => ({ participantId, name, handle: null, source });

  it("dedupes by participant with the strongest source winning", () => {
    const merged = mergeAdminRosters(
      [mk(1, "Ada", "lead"), mk(2, "Bea", "member")],
      [mk(1, "Ada", "added"), mk(3, "Cal", "added")]
    );
    expect(merged.map((e) => `${e.participantId}:${e.source}`)).toEqual([
      "1:lead",
      "2:member",
      "3:added",
    ]);
  });

  it("orders lead > member > added, then by name", () => {
    const merged = mergeAdminRosters([
      mk(4, "Zed", "added"),
      mk(5, "Amy", "lead"),
      mk(6, "Bob", "lead"),
    ]);
    expect(merged.map((e) => e.name)).toEqual(["Amy", "Bob", "Zed"]);
  });
});

describe("isPageAdmin — synchronous auto-admin paths", () => {
  it("site admin can admin any page without a DB call", async () => {
    expect(await isPageAdmin(noDb, roles({ roles: ["admin"] }), "sector", 3)).toBe(true);
    expect(await isPageAdmin(noDb, roles({ roles: ["owner"] }), "project", 9)).toBe(true);
  });

  it("a lab lead admins their lab without a DB call", async () => {
    expect(
      await isPageAdmin(noDb, roles({ labLeadLabIds: [5] }), "lab", 5)
    ).toBe(true);
  });

  it("a pod moderator admins their pod without a DB call", async () => {
    expect(
      await isPageAdmin(noDb, roles({ moderatorPodIds: [7] }), "pod", 7)
    ).toBe(true);
  });
});
