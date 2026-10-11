import { describe, expect, it } from "vitest";
import { toAmbassadorSession } from "./session";
import type { EventRow } from "@/lib/content/queries";

// events.start_at is `timestamp without time zone`: venue wall time, returned with no offset.
const event = (start_at: string) =>
  ({ slug: "s", name: "Workshop", kind: "Workshop", start_at, location_type: "in_person", location_name: "MLK Library, DC", description: null }) as unknown as EventRow;

describe("toAmbassadorSession", () => {
  it("reads the stored wall time as written, whatever zone the server runs in", () => {
    const s = toAmbassadorSession(event("2026-10-15T18:00:00"));
    expect(s.day).toBe("Thursday, October 15");
    expect(s.time).toBe("6:00 PM");
    expect(s.short).toBe("Oct 15, 2026");
    expect(s.place).toBe("MLK Library");
  });

  it("keeps an explicit offset's digits too", () => {
    expect(toAmbassadorSession(event("2026-10-15T18:00:00+00:00")).time).toBe("6:00 PM");
  });
});
