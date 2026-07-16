import { describe, it, expect } from "vitest";
import { buildCycleContactsTable, type CycleContactRow } from "./contacts";
import { toCsv } from "@/lib/export/csv";

function row(overrides: Partial<CycleContactRow> = {}): CycleContactRow {
  return {
    enrollment_status: "active",
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

describe("buildCycleContactsTable", () => {
  it("emits every contact column in a stable order", () => {
    const { columns } = buildCycleContactsTable([]);
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
      "enrollment_status",
      "contact_consent",
      "photo_video_consent",
    ]);
    expect(columns.map((c) => c.header)).toContain("Contact consent");
    expect(columns.map((c) => c.header)).toContain("Photo/video consent");
  });

  it("sorts records by last name, then first name", () => {
    const { records } = buildCycleContactsTable([
      row({ first_name: "Grace", last_name: "Hopper" }),
      row({ first_name: "Ada", last_name: "Lovelace" }),
      row({ first_name: "Alan", last_name: "Hopper" }),
    ]);
    expect(
      (records as unknown as CycleContactRow[]).map(
        (r) => `${r.first_name} ${r.last_name}`
      )
    ).toEqual(["Alan Hopper", "Grace Hopper", "Ada Lovelace"]);
  });

  it("serializes consent booleans as yes/no and null fields as empty cells", () => {
    const { columns, records } = buildCycleContactsTable([
      row({
        first_name: "Ada",
        last_name: "Lovelace",
        phone_number: null,
        linkedin: null,
        contact_consent: true,
        photo_video_consent: false,
      }),
    ]);
    const csv = toCsv(records, columns);
    const [header, dataRow] = csv.split("\r\n");
    const headers = header.split(",");
    const cells = dataRow.split(",");
    const cell = (key: string) =>
      cells[columns.findIndex((c) => c.key === key)];
    expect(headers).toContain("Contact consent");
    expect(cell("contact_consent")).toBe("yes");
    expect(cell("photo_video_consent")).toBe("no");
    expect(cell("phone_number")).toBe("");
    expect(cell("linkedin")).toBe("");
    expect(cell("email")).toBe("ada@example.com");
  });
});
