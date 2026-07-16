import { describe, it, expect } from "vitest";
import {
  buildAllPeopleContactsTable,
  buildAuthorityContactsTable,
  type AuthorityContactRow,
} from "./people-contacts";
import type { ContactParticipant } from "@/lib/export/contacts";
import { toCsv } from "@/lib/export/csv";

function person(overrides: Partial<ContactParticipant> = {}): ContactParticipant {
  return {
    first_name: "Ada",
    last_name: "Lovelace",
    preferred_name: null,
    email: "ada@example.com",
    phone_number: null,
    linkedin: null,
    slack_username: null,
    github_username: null,
    metro_slug: null,
    state: null,
    contact_consent: false,
    photo_video_consent: false,
    ...overrides,
  };
}

function authorityRow(
  overrides: Partial<AuthorityContactRow> = {}
): AuthorityContactRow {
  return { ...person(), roles: "admin", ...overrides };
}

describe("buildAllPeopleContactsTable", () => {
  it("emits base + consent columns with no middle column", () => {
    const { columns } = buildAllPeopleContactsTable([]);
    expect(columns.map((c) => c.key)).toEqual([
      "first_name",
      "last_name",
      "preferred_name",
      "email",
      "phone_number",
      "linkedin",
      "slack_username",
      "github_username",
      "metro_slug",
      "state",
      "contact_consent",
      "photo_video_consent",
    ]);
    expect(columns.map((c) => c.header)).toContain("Contact consent");
    expect(columns.map((c) => c.header)).toContain("Photo/video consent");
  });

  it("sorts records by last name, then first name", () => {
    const { records } = buildAllPeopleContactsTable([
      person({ first_name: "Grace", last_name: "Hopper" }),
      person({ first_name: "Ada", last_name: "Lovelace" }),
      person({ first_name: "Alan", last_name: "Hopper" }),
    ]);
    expect(
      (records as unknown as ContactParticipant[]).map(
        (r) => `${r.first_name} ${r.last_name}`
      )
    ).toEqual(["Alan Hopper", "Grace Hopper", "Ada Lovelace"]);
  });

  it("serializes consent booleans as yes/no and null fields as empty cells", () => {
    const { columns, records } = buildAllPeopleContactsTable([
      person({
        phone_number: null,
        linkedin: null,
        contact_consent: true,
        photo_video_consent: false,
      }),
    ]);
    const csv = toCsv(records, columns);
    const [, dataRow] = csv.split("\r\n");
    const cells = dataRow.split(",");
    const cell = (key: string) => cells[columns.findIndex((c) => c.key === key)];
    expect(cell("contact_consent")).toBe("yes");
    expect(cell("photo_video_consent")).toBe("no");
    expect(cell("phone_number")).toBe("");
    expect(cell("linkedin")).toBe("");
    expect(cell("email")).toBe("ada@example.com");
  });
});

describe("buildAuthorityContactsTable", () => {
  it("inserts a roles column between state and consent", () => {
    const { columns } = buildAuthorityContactsTable([]);
    expect(columns.map((c) => c.key)).toEqual([
      "first_name",
      "last_name",
      "preferred_name",
      "email",
      "phone_number",
      "linkedin",
      "slack_username",
      "github_username",
      "metro_slug",
      "state",
      "roles",
      "contact_consent",
      "photo_video_consent",
    ]);
    const rolesIdx = columns.findIndex((c) => c.key === "roles");
    const stateIdx = columns.findIndex((c) => c.key === "state");
    const consentIdx = columns.findIndex((c) => c.key === "contact_consent");
    expect(rolesIdx).toBe(stateIdx + 1);
    expect(rolesIdx).toBe(consentIdx - 1);
    expect(columns.map((c) => c.header)).toContain("Roles");
  });

  it("sorts records by last name, then first name", () => {
    const { records } = buildAuthorityContactsTable([
      authorityRow({ first_name: "Grace", last_name: "Hopper" }),
      authorityRow({ first_name: "Ada", last_name: "Lovelace" }),
      authorityRow({ first_name: "Alan", last_name: "Hopper" }),
    ]);
    expect(
      (records as unknown as AuthorityContactRow[]).map(
        (r) => `${r.first_name} ${r.last_name}`
      )
    ).toEqual(["Alan Hopper", "Grace Hopper", "Ada Lovelace"]);
  });

  it("renders the aggregated roles and consent yes/no", () => {
    const { columns, records } = buildAuthorityContactsTable([
      authorityRow({ roles: "admin; lab_lead", contact_consent: true }),
    ]);
    const csv = toCsv(records, columns);
    const [, dataRow] = csv.split("\r\n");
    const cells = dataRow.split(",");
    const cell = (key: string) => cells[columns.findIndex((c) => c.key === key)];
    // "admin; lab_lead" has no comma, so it is a single unquoted cell.
    expect(cell("roles")).toBe("admin; lab_lead");
    expect(cell("contact_consent")).toBe("yes");
    expect(cell("photo_video_consent")).toBe("no");
  });
});
