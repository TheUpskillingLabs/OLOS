import { describe, expect, it } from "vitest";
import { admitInvitee, inviteProblem, type AmbassadorInvite } from "./data";

const invite = (over: Partial<AmbassadorInvite> = {}): AmbassadorInvite => ({
  id: 7, token: "t".repeat(32), first_name: "A", last_name: null, email: null, note: null,
  inviter_name: "Coordinator", invited_by: 1, lab_id: 3, nomination_id: null,
  created_at: "2026-10-10T00:00:00Z", expires_at: "2099-01-01T00:00:00Z",
  accepted_at: null, accepted_participant_id: null, revoked_at: null,
  approved_at: null, approved_by: null, ...over,
});

/** A chainable stand-in for the Supabase client that records writes. */
function fakeService(existingRole = false) {
  const log: { table: string; op: string; values?: unknown }[] = [];
  const service = {
    from(table: string) {
      let op = "select";
      let values: unknown;
      const chain: Record<string, unknown> = {};
      const result = () => {
        log.push({ table, op, values });
        if (table === "participant_roles" && op === "select") return { data: existingRole ? [{ id: 1 }] : [], error: null };
        if (table === "ambassador_applications") return { data: { id: 5, status: "approved" }, error: null };
        return { data: null, error: null };
      };
      for (const m of ["select", "eq", "is", "in", "limit", "not"]) chain[m] = () => chain;
      chain.insert = (v: unknown) => { op = "insert"; values = v; return Promise.resolve(result()); };
      chain.update = (v: unknown) => { op = "update"; values = v; return chain; };
      chain.maybeSingle = () => Promise.resolve(result());
      chain.then = (res: (v: unknown) => unknown) => Promise.resolve(result()).then(res);
      return chain;
    },
  };
  return { service: service as never, log };
}

describe("admitInvitee", () => {
  it("grants the role and approves the application, crediting the approver", async () => {
    const { service, log } = fakeService();
    const out = await admitInvitee(service, { id: 5, participant_id: 9, lab_id: 3 }, invite({ approved_by: 2 }));
    expect(out.error).toBeNull();
    expect(out.application?.status).toBe("approved");
    const grant = log.find((l) => l.table === "participant_roles" && l.op === "insert");
    expect(grant?.values).toMatchObject({ participant_id: 9, role: "ambassador", lab_id: 3, granted_by: 2 });
    const upd = log.find((l) => l.table === "ambassador_applications" && l.op === "update");
    expect(upd?.values).toMatchObject({ status: "approved", decided_by: 2 });
  });

  it("never admits someone on an invite they approved themselves", async () => {
    const { service, log } = fakeService();
    const out = await admitInvitee(service, { id: 5, participant_id: 9, lab_id: 3 }, invite({ approved_by: 9 }));
    expect(out.error).toBeInstanceOf(Error);
    expect(out.application).toBeNull();
    expect(log.some((l) => l.table === "participant_roles" && l.op === "insert")).toBe(false);
  });

  it("is safe to retry when the role already exists", async () => {
    const { service, log } = fakeService(true);
    const out = await admitInvitee(service, { id: 5, participant_id: 9, lab_id: 3 }, invite({ approved_by: 2 }));
    expect(out.error).toBeNull();
    expect(log.some((l) => l.table === "participant_roles" && l.op === "insert")).toBe(false);
  });
});

describe("inviteProblem", () => {
  const me = { id: 9, email: "me@example.com" };
  it("accepts an open invite and the same person coming back", () => {
    expect(inviteProblem(invite(), me)).toBeNull();
    expect(inviteProblem(invite({ accepted_participant_id: 9 }), me)).toBeNull();
  });
  it("rejects used, revoked, expired and wrong-email invites", () => {
    expect(inviteProblem(invite({ accepted_participant_id: 4 }), me)).toBe("used");
    expect(inviteProblem(invite({ revoked_at: "2026-10-10T00:00:00Z" }), me)).toBe("revoked");
    expect(inviteProblem(invite({ expires_at: "2020-01-01T00:00:00Z" }), me)).toBe("expired");
    expect(inviteProblem(invite({ email: "other@example.com" }), me)).toBe("email_mismatch");
  });
});
