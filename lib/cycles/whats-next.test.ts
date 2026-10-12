import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NEXT_PUBLIC_CYCLE_KICKOFF,
  fmtDateRange,
  internalCycleJoinUrl,
  nextPublicKickoff,
  whatsNextMessage,
  type WhatsNextFacts,
} from "./whats-next";
import { SLACK_INVITE_FALLBACK } from "@/lib/tasks/definitions";

const OCT = new Date("2026-10-06T12:00:00Z");
const INTERNAL: WhatsNextFacts = {
  internalCycle: { name: "Cycle 4", start_date: "2026-10-13", end_date: "2026-12-08" },
  upcomingPublicStart: null,
};

describe("nextPublicKickoff", () => {
  it("uses the constant while it is ahead, including the day itself", () => {
    expect(nextPublicKickoff(null, OCT)).toBe(NEXT_PUBLIC_CYCLE_KICKOFF);
    expect(nextPublicKickoff(null, new Date("2027-01-12T20:00:00Z"), "2027-01-12")).toBe(
      "2027-01-12"
    );
  });

  it("returns null once the constant has passed, so it never goes stale", () => {
    expect(nextPublicKickoff(null, new Date("2027-01-13T01:00:00Z"), "2027-01-12")).toBeNull();
  });

  it("lets an upcoming cycle row override the constant", () => {
    expect(nextPublicKickoff("2027-02-02", OCT)).toBe("2027-02-02");
    expect(nextPublicKickoff("2027-02-02", new Date("2028-01-01T00:00:00Z"))).toBe("2027-02-02");
  });
});

describe("fmtDateRange", () => {
  it("formats a same-year range without the year", () => {
    expect(fmtDateRange("2026-10-13", "2026-12-08")).toBe("Oct 13 – Dec 8");
  });
  it("adds the year when the range crosses one", () => {
    expect(fmtDateRange("2026-12-01", "2027-02-01")).toBe("Dec 1, 2026 – Feb 1, 2027");
  });
  it("returns null when a date is missing", () => {
    expect(fmtDateRange("2026-10-13", null)).toBeNull();
  });
});

describe("whatsNextMessage", () => {
  it("names the internal cycle's dates from its row", () => {
    const m = whatsNextMessage(INTERNAL, OCT);
    expect(m.internalDates).toBe("Oct 13 – Dec 8");
    expect(m.internal).toMatch(/^From Oct 13 to Dec 8 we're running an internal Build Cycle/);
    expect(m.internal).toMatch(/help even more people in 2027\./);
  });

  it("drops the dates without the org cycle row, during the interim", () => {
    const m = whatsNextMessage(undefined, OCT);
    expect(m.internalDates).toBeNull();
    expect(m.heading).toBe("This quarter, we're turning our method on ourselves");
    expect(m.internal).toMatch(/^This quarter we're running an internal Build Cycle/);
  });

  it("says when the first public cycle of 2027 kicks off", () => {
    const m = whatsNextMessage(INTERNAL, OCT);
    expect(m.nextPublic).toBe("The first public Build Cycle of 2027 kicks off January 12.");
    expect(m.kickoffShort).toBe("Jan 12, 2027");
  });

  it("uses the row's date once the next public cycle exists", () => {
    const m = whatsNextMessage({ ...INTERNAL, upcomingPublicStart: "2027-02-02" }, OCT);
    expect(m.nextPublic).toBe("The next public Build Cycle kicks off February 2, 2027.");
  });

  it("falls back to 'being planned' after the date, with no year promised", () => {
    const m = whatsNextMessage(undefined, new Date("2027-03-01T12:00:00Z"));
    expect(m.nextPublic).toBe("The next public Build Cycle is being planned.");
    expect(m.kickoff).toBeNull();
  });

  it("drops the invitation once there is no internal cycle and the interim is over", () => {
    const m = whatsNextMessage(undefined, new Date("2027-03-01T12:00:00Z"));
    expect(m.internal).toBeNull();
    expect(m.heading).toBe("No public Build Cycle is open right now");
    expect(whatsNextMessage({ ...INTERNAL, upcomingPublicStart: "2027-02-02" }, OCT).internal).not.toBeNull();
    expect(whatsNextMessage({ internalCycle: null, upcomingPublicStart: "2027-02-02" }, OCT).internal).toBeNull();
  });

  it("keeps to the copy rules", () => {
    const banned = /\b(TUL|course|class|student|lesson|module)s?\b/i;
    for (const facts of [INTERNAL, undefined]) {
      for (const v of Object.values(whatsNextMessage(facts, OCT))) {
        if (typeof v === "string") expect(v, v).not.toMatch(banned);
      }
    }
  });
});

describe("internalCycleJoinUrl", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("prefers the Slack thread, then the invite, then the fallback", () => {
    vi.stubEnv("NEXT_PUBLIC_INTERNAL_CYCLE_JOIN_URL", "https://slack.example/thread");
    vi.stubEnv("NEXT_PUBLIC_SLACK_INVITE_URL", "https://slack.example/invite");
    expect(internalCycleJoinUrl()).toBe("https://slack.example/thread");
    vi.stubEnv("NEXT_PUBLIC_INTERNAL_CYCLE_JOIN_URL", "");
    expect(internalCycleJoinUrl()).toBe("https://slack.example/invite");
    vi.stubEnv("NEXT_PUBLIC_SLACK_INVITE_URL", "");
    expect(internalCycleJoinUrl()).toBe(SLACK_INVITE_FALLBACK);
  });
});
