import { describe, expect, it } from "vitest";
import { isValidTaskKey } from "@/lib/tasks/keys";
import { launchBannerKey, launchBannerVariant, launchWindowOpen } from "./launch";

const NOW = new Date("2026-10-09T12:00:00Z");

describe("launchWindowOpen", () => {
  it("is open until the day named, exclusive", () => {
    expect(launchWindowOpen("2027-01-01", NOW)).toBe(true);
    expect(launchWindowOpen("2026-10-09", NOW)).toBe(false);
    expect(launchWindowOpen(undefined, NOW)).toBe(true);
    expect(launchWindowOpen("not a date", NOW)).toBe(false);
  });
});

describe("launchBannerVariant", () => {
  const base = { windowOpen: true, cameThroughFrontDoor: false };

  it("announces the program to everyone who hasn't applied", () => {
    expect(launchBannerVariant({ ...base, stage: "none" })).toBe("launch");
  });

  it("stays quiet once the window closes, or when the front-door task already says it", () => {
    expect(launchBannerVariant({ ...base, stage: "none", windowOpen: false })).toBeNull();
    expect(launchBannerVariant({ ...base, stage: "none", cameThroughFrontDoor: true })).toBeNull();
  });

  it("shows the in-review version to a pending applicant, even after the window", () => {
    expect(launchBannerVariant({ ...base, stage: "pending", windowOpen: false })).toBe("pending");
  });

  it("shows nothing mid-application or once decided", () => {
    for (const stage of ["applying", "declined", "ambassador", "stepped_back"] as const) {
      expect(launchBannerVariant({ ...base, stage })).toBeNull();
    }
  });
});

describe("launchBannerKey", () => {
  it("gives each version its own valid dismissal key", () => {
    expect(launchBannerKey("launch")).not.toBe(launchBannerKey("pending"));
    expect(isValidTaskKey(launchBannerKey("launch"))).toBe(true);
    expect(isValidTaskKey(launchBannerKey("pending"))).toBe(true);
  });
});
