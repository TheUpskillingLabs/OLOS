import { describe, it, expect } from "vitest";
import { announcementScopeLabel } from "./data";

describe("announcementScopeLabel", () => {
  it("labels a null lab_id as org-wide, ignoring any name", () => {
    expect(announcementScopeLabel(null, null)).toBe("Org-wide");
    expect(announcementScopeLabel(null, "Baltimore")).toBe("Org-wide");
  });

  it("uses the lab name when the announcement is lab-scoped", () => {
    expect(announcementScopeLabel(3, "Baltimore")).toBe("Baltimore");
  });

  it("falls back to a generic label when scoped but the name is missing", () => {
    expect(announcementScopeLabel(3, null)).toBe("Your lab");
  });
});
