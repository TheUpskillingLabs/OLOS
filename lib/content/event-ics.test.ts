import { describe, it, expect } from "vitest";
import { eventICS } from "./event-ics";
import type { EventRow } from "./queries";

function evt(partial: Partial<EventRow>): EventRow {
  return {
    id: 1,
    api_id: null,
    slug: "civics-elections-hackathon",
    name: "Idea to Prototype: A Civics and Elections Hackathon",
    kind: "Anchor",
    start_at: "2026-08-15T09:00",
    end_at: "2026-08-15T16:30",
    location_type: "in_person",
    location_name: "American University, Constitution Hall, Washington, DC 20016",
    img: null,
    grad: null,
    cost: "Free",
    host: null,
    description: null,
    bring: null,
    body: null,
    gallery: null,
    anchor: true,
    luma_url: null,
    synced_at: null,
    ...partial,
  } as EventRow;
}

describe("eventICS", () => {
  it("renders floating wall-time start and end", () => {
    const ics = eventICS(evt({}));
    expect(ics).toContain("DTSTART:20260815T090000");
    expect(ics).toContain("DTEND:20260815T163000");
  });

  it("drops seconds from DB-shaped timestamps", () => {
    const ics = eventICS(evt({ start_at: "2026-08-15T09:00:00" }));
    expect(ics).toContain("DTSTART:20260815T090000");
  });

  it("escapes commas and omits DTEND when end_at is null", () => {
    const ics = eventICS(evt({ end_at: null }));
    expect(ics).not.toContain("DTEND");
    expect(ics).toContain(
      "LOCATION:American University\\, Constitution Hall\\, Washington\\, DC 20016"
    );
    expect(ics).toContain(
      "SUMMARY:Idea to Prototype: A Civics and Elections Hackathon"
    );
  });

  it("labels virtual events Online instead of a venue", () => {
    const ics = eventICS(evt({ location_type: "virtual" }));
    expect(ics).toContain("LOCATION:Online");
  });
});
