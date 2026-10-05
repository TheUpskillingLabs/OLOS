import { describe, expect, it } from "vitest";
import { directoryCardDone, lookBackCycle } from "./member-facts";

describe("directoryCardDone", () => {
  it("needs a headline, a photo and at least one intent", () => {
    const full = { headline: "Organizer", profile_image_url: "https://x/p.png", role_intents: ["cycle"] };
    expect(directoryCardDone(full)).toBe(true);
    expect(directoryCardDone({ ...full, headline: "  " })).toBe(false);
    expect(directoryCardDone({ ...full, profile_image_url: null })).toBe(false);
    expect(directoryCardDone({ ...full, role_intents: [] })).toBe(false);
    expect(directoryCardDone({ ...full, role_intents: null })).toBe(false);
  });
});

describe("lookBackCycle", () => {
  const c = (id: number, status: string, mode = "open", lab_id: number | null = null) => ({
    id,
    name: `Cycle ${id}`,
    status,
    mode,
    lab_id,
  });

  it("picks the newest finished open HQ cycle (input is newest first)", () => {
    expect(lookBackCycle([c(5, "draft"), c(4, "active"), c(3, "closed"), c(2, "archived")])).toEqual({
      id: 3,
      name: "Cycle 3",
    });
  });

  it("skips org cycles and lab cycles", () => {
    expect(lookBackCycle([c(9, "closed", "org"), c(8, "archived", "open", 4), c(7, "archived")])).toEqual({
      id: 7,
      name: "Cycle 7",
    });
  });

  it("is null when nothing has finished", () => {
    expect(lookBackCycle([c(1, "active")])).toBeNull();
    expect(lookBackCycle(null)).toBeNull();
  });
});
