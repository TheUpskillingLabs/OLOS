import { describe, it, expect } from "vitest";
import {
  inGuestMirrorWindow,
  splitGuestsByIdentity,
  GUEST_MIRROR_GRACE_MS,
} from "./luma";

/* Fixed clock so these never depend on when the suite runs. */
const NOW = Date.parse("2026-08-18T18:00:00Z");
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe("inGuestMirrorWindow", () => {
  it("includes events that have not started", () => {
    expect(
      inGuestMirrorWindow({ start_at: iso(2 * HOUR), end_at: iso(4 * HOUR) }, NOW)
    ).toBe(true);
  });

  /* The regression this whole helper exists for: the old rule was
     `start_at > now`, so an event fell out of the mirror the moment it began
     and day-of walk-up registrations were never captured. */
  it("includes an event that is currently running", () => {
    expect(
      inGuestMirrorWindow({ start_at: iso(-1 * HOUR), end_at: iso(2 * HOUR) }, NOW)
    ).toBe(true);
  });

  it("includes an event that ended inside the grace window", () => {
    expect(
      inGuestMirrorWindow({ start_at: iso(-3 * DAY), end_at: iso(-2 * DAY) }, NOW)
    ).toBe(true);
  });

  it("excludes an event that ended past the grace window", () => {
    expect(
      inGuestMirrorWindow(
        { start_at: iso(-30 * DAY), end_at: iso(-29 * DAY) },
        NOW
      )
    ).toBe(false);
  });

  it("treats a missing end_at as ending when it starts", () => {
    expect(inGuestMirrorWindow({ start_at: iso(-1 * HOUR) }, NOW)).toBe(true);
    expect(inGuestMirrorWindow({ start_at: iso(-8 * DAY) }, NOW)).toBe(false);
  });

  it("treats an unparseable end_at as a missing one rather than excluding", () => {
    expect(
      inGuestMirrorWindow({ start_at: iso(-1 * HOUR), end_at: "not a date" }, NOW)
    ).toBe(true);
  });

  it("excludes an event with an unparseable start_at", () => {
    expect(inGuestMirrorWindow({ start_at: "nonsense" }, NOW)).toBe(false);
  });

  it("boundary: exactly at the grace edge is out, just inside is in", () => {
    const atEdge = iso(-GUEST_MIRROR_GRACE_MS);
    const justInside = iso(-GUEST_MIRROR_GRACE_MS + 1000);
    expect(inGuestMirrorWindow({ start_at: atEdge, end_at: atEdge }, NOW)).toBe(
      false
    );
    expect(
      inGuestMirrorWindow({ start_at: justInside, end_at: justInside }, NOW)
    ).toBe(true);
  });
});

describe("splitGuestsByIdentity", () => {
  const members = new Map<string, number>([
    ["member@example.org", 7],
    ["other@example.org", 9],
  ]);

  it("separates members from non-members", () => {
    const { resolved, unresolved } = splitGuestsByIdentity(
      [
        { email: "member@example.org" },
        { email: "stranger@example.com" },
        { email: "other@example.org" },
      ],
      members
    );
    expect(resolved).toEqual([
      { email: "member@example.org", participant_id: 7 },
      { email: "other@example.org", participant_id: 9 },
    ]);
    expect(unresolved).toEqual([{ email: "stranger@example.com" }]);
  });

  /* Luma is not guaranteed to hand back the same casing the member signed up
     with, and participants.email is stored lowercased. */
  it("matches case-insensitively", () => {
    const { resolved, unresolved } = splitGuestsByIdentity(
      [{ email: "Member@Example.ORG" }],
      members
    );
    expect(resolved).toEqual([
      { email: "Member@Example.ORG", participant_id: 7 },
    ]);
    expect(unresolved).toHaveLength(0);
  });

  it("puts everyone in unresolved when no members match", () => {
    const { resolved, unresolved } = splitGuestsByIdentity(
      [{ email: "a@b.com" }, { email: "c@d.com" }],
      new Map()
    );
    expect(resolved).toHaveLength(0);
    expect(unresolved).toHaveLength(2);
  });

  it("handles an empty guest list", () => {
    const { resolved, unresolved } = splitGuestsByIdentity([], members);
    expect(resolved).toHaveLength(0);
    expect(unresolved).toHaveLength(0);
  });

  /* participant_id 0 is not a real id, but `=== undefined` rather than a
     falsy check is what keeps a hypothetical 0 out of the unresolved pile. */
  it("does not treat a zero participant id as unresolved", () => {
    const { resolved, unresolved } = splitGuestsByIdentity(
      [{ email: "zero@example.org" }],
      new Map([["zero@example.org", 0]])
    );
    expect(resolved).toEqual([{ email: "zero@example.org", participant_id: 0 }]);
    expect(unresolved).toHaveLength(0);
  });
});
