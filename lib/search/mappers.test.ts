import { describe, expect, it } from "vitest";
import {
  cycleDoc,
  eventDoc,
  labDoc,
  personDoc,
  podDoc,
  projectDoc,
  type EventRow,
  type MetroRow,
  type PersonRow,
} from "./mappers";

const NOW = new Date("2026-07-12T12:00:00").getTime();

function personRow(overrides: Partial<PersonRow> = {}): PersonRow {
  return {
    id: 7,
    handle: "maria-lopez",
    preferred_name: null,
    first_name: "Maria",
    last_name: "Lopez",
    headline: "Solar organizer",
    profile_image_url: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function eventRow(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: 1,
    slug: "builder-night",
    name: "Builder Night",
    kind: "Cycle event",
    start_at: "2026-07-28T18:00:00",
    end_at: null,
    location_type: "in_person",
    location_name: "MLK Library, 901 G St NW, Washington, DC 20001, USA",
    host: "TUL",
    ...overrides,
  };
}

describe("personDoc", () => {
  it("links to /u/{handle} and builds initials", () => {
    const d = personDoc(personRow());
    expect(d.href).toBe("/u/maria-lopez");
    expect(d.label).toBe("Maria Lopez");
    expect(d.initials).toBe("ML");
    expect(d.sublabel).toBe("Solar organizer");
  });

  it("prefers preferred_name for the label", () => {
    expect(personDoc(personRow({ preferred_name: "Mari" })).label).toBe("Mari");
  });

  it("falls back to a /search query link when there is no handle", () => {
    const d = personDoc(personRow({ handle: null }));
    expect(d.href).toBe(`/search?q=${encodeURIComponent("Maria Lopez")}`);
  });

  it("falls back to placeholder label and initials", () => {
    const d = personDoc(
      personRow({ first_name: null, last_name: null, handle: null })
    );
    expect(d.label).toBe("A member");
    expect(d.initials).toBe("?");
  });
});

describe("podDoc / projectDoc", () => {
  it("uses the problem statement as sublabel, tolerating array embeds", () => {
    const d = podDoc({
      id: 4,
      name: "Solar Pod",
      status: "active",
      created_at: null,
      problem_statements: [{ statement_text: "Rooftop access is unequal" }],
    });
    expect(d.href).toBe("/pods/4");
    expect(d.sublabel).toBe("Rooftop access is unequal");
  });

  it("falls back to 'Pod {id}' / 'Project {id}' labels", () => {
    expect(
      podDoc({
        id: 4,
        name: null,
        status: "forming",
        created_at: null,
        problem_statements: null,
      }).label
    ).toBe("Pod 4");
    expect(
      projectDoc({
        id: 9,
        name: null,
        status: "active",
        created_at: null,
        solution_proposals: { name: "Community solar co-op" },
      }).label
    ).toBe("Project 9");
  });
});

describe("eventDoc", () => {
  it("upcoming: date+time and city sublabel, slug href", () => {
    const d = eventDoc(eventRow(), NOW);
    expect(d.href).toBe("/events/builder-night");
    expect(d.sublabel).toBe("Jul 28 · 6 PM · Washington");
  });

  it("past: month + year instead of a yearless date", () => {
    const d = eventDoc(eventRow({ start_at: "2026-06-02T18:00:00" }), NOW);
    expect(d.sublabel).toBe("June 2026 · Washington");
  });

  it("virtual events read 'Online'", () => {
    const d = eventDoc(
      eventRow({ location_type: "virtual", location_name: "Online" }),
      NOW
    );
    expect(d.sublabel).toBe("Jul 28 · 6 PM · Online");
  });

  it("omits the place when the location is missing", () => {
    const d = eventDoc(eventRow({ location_name: null }), NOW);
    expect(d.sublabel).toBe("Jul 28 · 6 PM");
  });
});

describe("labDoc", () => {
  const row: MetroRow = {
    id: 2,
    slug: "washington-dc",
    name: "Washington, DC",
    st: "DC",
    status: "active",
    blurb: "The flagship lab",
    partner: null,
  };

  it("de-dupes the state via metroLabel and links by slug", () => {
    const d = labDoc(row);
    expect(d.label).toBe("Washington, DC"); // not "Washington, DC, DC"
    expect(d.href).toBe("/local-labs/washington-dc");
    expect(d.sublabel).toBe("Local Lab");
  });

  it("marks waitlist labs", () => {
    expect(labDoc({ ...row, status: "waitlist" }).sublabel).toBe(
      "Local Lab · Waitlist"
    );
  });
});

describe("cycleDoc", () => {
  it("links by numeric id and labels status + start month", () => {
    const d = cycleDoc({
      id: 3,
      name: "Cycle 3",
      slug: "cycle-3",
      status: "active",
      start_date: "2026-07-01T00:00:00",
      description: "Build climate solutions",
      what_you_build: null,
    });
    expect(d.href).toBe("/cycles/3");
    expect(d.sublabel).toBe("Active · July 2026");
  });

  it("maps terminal statuses to 'Past' and tolerates a missing date", () => {
    const d = cycleDoc({
      id: 1,
      name: "Cycle 1",
      slug: null,
      status: "archived",
      start_date: null,
      description: null,
      what_you_build: null,
    });
    expect(d.sublabel).toBe("Past");
  });
});
