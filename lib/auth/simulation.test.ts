import { beforeAll, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import type { createServiceClient } from "@/lib/supabase/server";

/* Member-view simulation (lib/auth/simulation.ts) is a security boundary in two
   places: the cookie must be unforgeable, and the target must be a legal one.
   Both are pure enough to pin here — `simulationContext()` itself needs a live
   session, so its checks are covered by the parts they compose from.

   The module reads SUPABASE_SERVICE_ROLE_KEY at call time for the HMAC key, so
   it is set before the dynamic import. */

let signSimulation: typeof import("./simulation").signSimulation;
let verifySimulation: typeof import("./simulation").verifySimulation;
let loadSimulationTarget: typeof import("./simulation").loadSimulationTarget;

beforeAll(async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_test_key_for_hmac";
  ({ signSimulation, verifySimulation, loadSimulationTarget } = await import(
    "./simulation"
  ));
});

const future = () => Math.floor(Date.now() / 1000) + 600;

describe("simulation cookie signing", () => {
  it("round-trips a valid payload", () => {
    const payload = { p: 42, a: "auth-admin", exp: future() };
    expect(verifySimulation(signSimulation(payload))).toEqual(payload);
  });

  it("rejects a missing or malformed cookie", () => {
    expect(verifySimulation(undefined)).toBeNull();
    expect(verifySimulation("")).toBeNull();
    expect(verifySimulation("no-dot-separator")).toBeNull();
    expect(verifySimulation(".onlyasignature")).toBeNull();
  });

  it("rejects a tampered payload — swapping the target invalidates the signature", () => {
    const signed = signSimulation({ p: 42, a: "auth-admin", exp: future() });
    const [, signature] = signed.split(".");
    const forgedBody = Buffer.from(
      JSON.stringify({ p: 1, a: "auth-admin", exp: future() }),
      "utf8"
    ).toString("base64url");

    expect(verifySimulation(`${forgedBody}.${signature}`)).toBeNull();
  });

  it("rejects a signature made with a different key", () => {
    const signed = signSimulation({ p: 42, a: "auth-admin", exp: future() });
    process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_a_different_key";
    expect(verifySimulation(signed)).toBeNull();
    process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_test_key_for_hmac";
  });

  it("rejects an expired cookie even though the signature is good", () => {
    const expired = signSimulation({
      p: 42,
      a: "auth-admin",
      exp: Math.floor(Date.now() / 1000) - 1,
    });
    expect(verifySimulation(expired)).toBeNull();
  });

  it("rejects a genuinely-signed payload of the wrong shape", () => {
    // Signed with the real key, so shape validation has to stand on its own
    // rather than lean on the signature check.
    const sign = (value: unknown) => {
      const body = Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
      const sig = createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY!)
        .update(body)
        .digest("base64url");
      return `${body}.${sig}`;
    };

    // Sanity: this signer agrees with the module's.
    const payload = { p: 42, a: "auth-admin", exp: future() };
    expect(sign(payload)).toBe(signSimulation(payload));

    for (const bad of [
      { p: "42", a: "auth-admin", exp: future() }, // id as a string
      { p: 1.5, a: "auth-admin", exp: future() }, // non-integer id
      { p: 0, a: "auth-admin", exp: future() }, // no participant 0
      { p: 42, a: "", exp: future() }, // unbound actor
      { p: 42, a: "auth-admin" }, // no expiry
      "not-an-object",
      null,
    ]) {
      expect(verifySimulation(sign(bad))).toBeNull();
    }
  });
});

/* loadSimulationTarget — the "who may be simulated" rule. */

type TargetRow = {
  id: number;
  auth_user_id: string | null;
  email: string | null;
  preferred_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

function mockService(
  participant: TargetRow | null,
  authorityRoles: { role: string }[] = []
) {
  return {
    from(name: string) {
      if (name === "participants") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: participant }) }),
          }),
        };
      }
      // participant_roles — a chainable builder ending in a thenable.
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "is", "limit"]) b[m] = () => b;
      b.then = (resolve: (v: { data: unknown[] }) => void) =>
        resolve({ data: authorityRoles });
      return b;
    },
  } as unknown as ReturnType<typeof createServiceClient>;
}

const member: TargetRow = {
  id: 7,
  auth_user_id: "auth-member",
  email: "member@example.com",
  preferred_name: null,
  first_name: "Jordan",
  last_name: "Reyes",
};

describe("loadSimulationTarget", () => {
  it("accepts a signed-in member with no authority role", async () => {
    const target = await loadSimulationTarget(mockService(member), 7);
    expect(target).toEqual({
      participantId: 7,
      authUserId: "auth-member",
      email: "member@example.com",
      displayName: "Jordan Reyes",
    });
  });

  it("prefers the preferred name for the banner", async () => {
    const target = await loadSimulationTarget(
      mockService({ ...member, preferred_name: "Jo" }),
      7
    );
    expect(target?.displayName).toBe("Jo");
  });

  it("rejects a participant who does not exist", async () => {
    expect(await loadSimulationTarget(mockService(null), 7)).toBeNull();
  });

  it("rejects a participant who has never signed in", async () => {
    // No auth_user_id means every member page would resolve to nobody.
    expect(
      await loadSimulationTarget(mockService({ ...member, auth_user_id: null }), 7)
    ).toBeNull();
  });

  it.each(["owner", "admin", "developer"])(
    "rejects a %s — simulating one would be an escalation",
    async (role) => {
      expect(
        await loadSimulationTarget(mockService(member, [{ role }]), 7)
      ).toBeNull();
    }
  );
});
