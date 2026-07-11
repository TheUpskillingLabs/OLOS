import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSelf, isApexOwner, checkOwnerGuards } from "./guards";

/* Guardrails for owner lifecycle actions. isSelf is pure; isApexOwner and the
   evaluator read participant_roles through a chainable Supabase mock that resolves
   every chain to a configured result. */

function makeQuery(result: unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "neq", "is", "in", "limit", "maybeSingle", "single"]) {
    q[m] = () => q;
  }
  (q as { then: unknown }).then = (resolve: (v: unknown) => unknown) => resolve(result);
  return q;
}

function mockClient(participantRolesResult: unknown): SupabaseClient {
  return {
    from: (table: string) =>
      makeQuery(table === "participant_roles" ? participantRolesResult : { data: [] }),
  } as unknown as SupabaseClient;
}

describe("isSelf", () => {
  it("is false when the actor has no participant id", () => {
    expect(isSelf(null, 5)).toBe(false);
  });
  it("is true only when actor and target match", () => {
    expect(isSelf(5, 5)).toBe(true);
    expect(isSelf(3, 5)).toBe(false);
  });
});

describe("isApexOwner", () => {
  it("is true when a rooted owner grant exists", async () => {
    const client = mockClient({ data: [{ participant_id: 1 }] });
    expect(await isApexOwner(client, 1)).toBe(true);
  });
  it("is false when no rooted owner grant exists", async () => {
    const client = mockClient({ data: [] });
    expect(await isApexOwner(client, 9)).toBe(false);
  });
});

describe("checkOwnerGuards", () => {
  const guards = ["apexOwner", "self"] as const;

  it("passes for an ordinary target that is not self", async () => {
    const client = mockClient({ data: [] });
    const res = await checkOwnerGuards(client, [...guards], {
      actorParticipantId: 3,
      targetId: 5,
    });
    expect(res.ok).toBe(true);
  });

  it("blocks acting on the primary (apex) owner", async () => {
    const client = mockClient({ data: [{ participant_id: 5 }] });
    const res = await checkOwnerGuards(client, [...guards], {
      actorParticipantId: 3,
      targetId: 5,
    });
    expect(res).toMatchObject({ ok: false, status: 409 });
  });

  it("blocks acting on your own profile", async () => {
    const client = mockClient({ data: [] }); // not apex → falls through to self
    const res = await checkOwnerGuards(client, [...guards], {
      actorParticipantId: 5,
      targetId: 5,
    });
    expect(res).toMatchObject({ ok: false, status: 409 });
  });

  it("fails closed on an unrecognized guard", async () => {
    const client = mockClient({ data: [] });
    const res = await checkOwnerGuards(
      client,
      ["defaultMetro"] as unknown as (typeof guards)[number][],
      { actorParticipantId: 3, targetId: 5 }
    );
    expect(res).toMatchObject({ ok: false, status: 500 });
  });
});
