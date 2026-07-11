import { describe, it, expect } from "vitest";
import {
  labDisplayName,
  cycleDateRange,
  hasAnyMembership,
  type ParticipantMemberships,
} from "./memberships";

describe("labDisplayName", () => {
  it("appends the state when present", () => {
    expect(labDisplayName("Baltimore", "MD")).toBe("Baltimore, MD");
  });
  it("omits an empty state", () => {
    expect(labDisplayName("Washington", null)).toBe("Washington");
    expect(labDisplayName("Washington", "")).toBe("Washington");
  });
  it("never doubles a state the name already embeds", () => {
    expect(labDisplayName("Washington, DC", "DC")).toBe("Washington, DC");
  });
});

describe("cycleDateRange", () => {
  it("returns null when there are no dates", () => {
    expect(cycleDateRange(null, null)).toBeNull();
  });
  it("joins a start and end into a range", () => {
    expect(cycleDateRange("2026-03-01", "2026-06-30")).toContain("–");
  });
});

describe("hasAnyMembership", () => {
  const empty: ParticipantMemberships = {
    orgUnit: null,
    lab: null,
    cycles: [],
    pods: [],
    projects: [],
  };

  it("is false when the member belongs to nothing", () => {
    expect(hasAnyMembership(empty)).toBe(false);
  });

  it("is true when any group is present", () => {
    expect(
      hasAnyMembership({
        ...empty,
        pods: [{ kind: "pod", id: 1, name: "Pod A", href: "/pods/1" }],
      })
    ).toBe(true);
    expect(
      hasAnyMembership({
        ...empty,
        lab: { kind: "lab", id: 2, name: "Baltimore, MD", href: "/local-labs" },
      })
    ).toBe(true);
  });
});
