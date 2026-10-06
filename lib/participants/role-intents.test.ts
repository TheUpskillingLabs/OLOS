import { describe, expect, it } from "vitest";
import { onCycleWaitlist, withCycleIntent } from "./role-intents";
import { participantsUpdateSchema } from "@/lib/validations/participants-update";

describe("withCycleIntent", () => {
  it("adds 'cycle' and keeps the member's other intents", () => {
    expect(withCycleIntent(["events", "mentor"], true)).toEqual(["cycle", "events", "mentor"]);
    expect(withCycleIntent(null, true)).toEqual(["cycle"]);
  });

  it("is idempotent and drops duplicates", () => {
    expect(withCycleIntent(["cycle", "events", "events"], true)).toEqual(["cycle", "events"]);
  });

  it("removes only 'cycle' (undo)", () => {
    expect(withCycleIntent(["events", "cycle", "volunteer"], false)).toEqual([
      "events",
      "volunteer",
    ]);
    expect(withCycleIntent(undefined, false)).toEqual([]);
  });

  it("produces a body the PATCH route accepts", () => {
    for (const on of [true, false]) {
      const body = { role_intents: withCycleIntent(["events", "volunteer", "mentor"], on) };
      expect(participantsUpdateSchema.safeParse(body).success).toBe(true);
    }
  });
});

describe("onCycleWaitlist", () => {
  it("reads the waitlist from role_intents", () => {
    expect(onCycleWaitlist(["events", "cycle"])).toBe(true);
    expect(onCycleWaitlist(["events"])).toBe(false);
    expect(onCycleWaitlist(null)).toBe(false);
  });
});
