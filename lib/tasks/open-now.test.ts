import { describe, expect, it } from "vitest";
import { buildOpenNowRows, type OpenNowInputs } from "./open-now";

const empty: OpenNowInputs = { events: [], lookBackCycle: null, openSurvey: null, story: null };
const ids = (rows: { defId: string }[]) => rows.map((r) => r.defId);

describe("buildOpenNowRows", () => {
  it("is never empty: the events calendar and the Library always show", () => {
    expect(ids(buildOpenNowRows(empty))).toEqual(["open_now:events", "open_now:library"]);
  });

  it("shows at most two upcoming events, soonest first, then everything else in order", () => {
    const rows = buildOpenNowRows({
      events: [
        { slug: "a", name: "Prompting 101", start_at: "2026-10-15T22:00:00Z", location_name: "MLK Library" },
        { slug: "b", name: "Data walk", start_at: "2026-10-20T22:00:00Z", location_name: null },
        { slug: "c", name: "Third", start_at: "2026-10-25T22:00:00Z", location_name: null },
      ],
      lookBackCycle: { id: 15, name: "Summer 2026" },
      openSurvey: { share_slug: "civics", title: "Civics survey" },
      story: { slug: "a-story", name: "Sam" },
    });
    expect(ids(rows)).toEqual([
      "open_now:event",
      "open_now:event",
      "open_now:events",
      "open_now:look_back",
      "open_now:survey",
      "open_now:story",
      "open_now:library",
    ]);
    expect(rows[0].href).toBe("/events/a");
    expect(rows[0].detail).toContain("MLK Library");
    expect(rows[3].title).toBe("See what Summer 2026 built");
    expect(rows[3].href).toBe("/cycles/15");
    expect(rows[4].href).toBe("/survey/civics");
    expect(rows[5].href).toBe("/stories/a-story");
  });

  it("rows are never dismissible and always link somewhere", () => {
    const rows = buildOpenNowRows({ ...empty, lookBackCycle: { id: 1, name: "X" } });
    for (const r of rows) {
      expect(r.dismissible).toBe(false);
      expect(r.href.startsWith("/")).toBe(true);
      expect(r.surface).toBe("open_now");
    }
  });
});
