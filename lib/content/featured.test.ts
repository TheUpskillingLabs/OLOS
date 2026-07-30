import { describe, it, expect } from "vitest";
import { featuredEvents } from "./featured";
import type { EventRow } from "./queries";

const NOW = new Date("2026-07-30T12:00").getTime();

function evt(partial: Partial<EventRow> & { slug: string }): EventRow {
  return {
    id: 1,
    api_id: null,
    name: partial.slug,
    kind: null,
    start_at: "2026-08-01T18:00",
    end_at: null,
    location_type: "in_person",
    location_name: null,
    img: null,
    grad: null,
    cost: null,
    host: null,
    description: null,
    bring: null,
    body: null,
    gallery: null,
    anchor: false,
    luma_url: null,
    synced_at: null,
    ...partial,
  } as EventRow;
}

describe("featuredEvents", () => {
  it("keeps only upcoming anchors, in input order, capped at three", () => {
    const events = [
      evt({ slug: "past-anchor", start_at: "2026-07-14T18:00", anchor: true }),
      evt({ slug: "workshop", start_at: "2026-08-02T18:00" }),
      evt({ slug: "a1", start_at: "2026-08-11T18:00", anchor: true }),
      evt({ slug: "a2", start_at: "2026-08-15T09:00", anchor: true }),
      evt({ slug: "a3", start_at: "2026-09-08T18:00", anchor: true }),
      evt({ slug: "a4", start_at: "2026-10-13T18:00", anchor: true }),
    ];
    expect(featuredEvents(events, NOW).map((e) => e.slug)).toEqual([
      "a1",
      "a2",
      "a3",
    ]);
  });

  it("keeps an anchor that has started but not finished", () => {
    const events = [
      evt({
        slug: "in-progress",
        start_at: "2026-07-30T09:00",
        end_at: "2026-07-30T16:30",
        anchor: true,
      }),
    ];
    expect(featuredEvents(events, NOW).map((e) => e.slug)).toEqual([
      "in-progress",
    ]);
  });

  it("drops an anchor whose end_at has passed", () => {
    const events = [
      evt({
        slug: "finished",
        start_at: "2026-07-29T09:00",
        end_at: "2026-07-29T16:30",
        anchor: true,
      }),
    ];
    expect(featuredEvents(events, NOW)).toEqual([]);
  });

  it("returns nothing when the cycle has no upcoming anchors", () => {
    expect(featuredEvents([evt({ slug: "w" })], NOW)).toEqual([]);
  });
});
