import { describe, it, expect } from "vitest";
import { derivePersona } from "./persona";

const member = {
  isAdmin: false,
  isModerator: false,
  showPods: false,
  labLeadHref: null,
};
const admin = { ...member, isAdmin: true, showPods: true };
const labLead = { ...member, labLeadHref: "/lab/houston" };
const adminLead = { ...admin, labLeadHref: "/lab/houston" };
const moderator = { ...member, isModerator: true, showPods: true };

describe("derivePersona", () => {
  it("keeps member surfaces persona-free", () => {
    expect(derivePersona("/dashboard", member)).toBeNull();
    expect(derivePersona("/dashboard", admin)).toBeNull();
    expect(derivePersona("/learning", labLead)).toBeNull();
  });

  it("labels /admin as Admin", () => {
    expect(derivePersona("/admin", admin)).toBe("admin");
    expect(derivePersona("/admin/people", admin)).toBe("admin");
  });

  it("labels a lab lead in their own lab workspace", () => {
    expect(derivePersona("/lab/houston", labLead)).toBe("lablead");
    expect(derivePersona("/lab/houston/members", labLead)).toBe("lablead");
  });

  it("labels an admin without the lab-lead grant as Admin on /lab/*", () => {
    // The reported bug: pathname alone said "Lab lead" here.
    expect(derivePersona("/lab/houston", admin)).toBe("admin");
    expect(derivePersona("/lab/houston/members", admin)).toBe("admin");
  });

  it("keeps Lab lead for an admin visiting the lab they lead", () => {
    expect(derivePersona("/lab/houston", adminLead)).toBe("lablead");
    expect(derivePersona("/lab/houston/members", adminLead)).toBe("lablead");
  });

  it("compares labLeadHref on segment boundaries", () => {
    // /lab/houston2 is not the led /lab/houston — admin capacity wins.
    expect(derivePersona("/lab/houston2", adminLead)).toBe("admin");
  });

  it("labels /moderator by the same gate as the View-as radio", () => {
    expect(derivePersona("/moderator", moderator)).toBe("poderator");
    expect(derivePersona("/moderator/pods/5", moderator)).toBe("poderator");
    // Admins hold pods:read (showPods), so they keep the moderator persona.
    expect(derivePersona("/moderator", admin)).toBe("poderator");
    // Defensive fallback: an admin somehow without showPods reads as Admin.
    expect(derivePersona("/moderator", { ...admin, showPods: false })).toBe(
      "admin"
    );
    expect(derivePersona("/moderator", member)).toBeNull();
  });
});
