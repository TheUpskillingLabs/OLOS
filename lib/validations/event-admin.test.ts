import { describe, it, expect } from "vitest";
import { eventEditorialUpdateSchema } from "./event-admin";

describe("eventEditorialUpdateSchema", () => {
  it("accepts a partial payload and trims strings", () => {
    const r = eventEditorialUpdateSchema.parse({
      description: "  A short lede.  ",
      body: ["  First thing  ", "Second thing"],
    });
    expect(r.description).toBe("A short lede.");
    expect(r.body).toEqual(["First thing", "Second thing"]);
    expect(r.bring).toBeUndefined();
  });

  it("accepts null to clear a field", () => {
    const r = eventEditorialUpdateSchema.parse({ description: null, body: null });
    expect(r.description).toBeNull();
    expect(r.body).toBeNull();
  });

  it("rejects empty body entries and oversized arrays", () => {
    expect(() => eventEditorialUpdateSchema.parse({ body: [""] })).toThrow();
    expect(() =>
      eventEditorialUpdateSchema.parse({ body: Array(13).fill("x") })
    ).toThrow();
  });

  it("rejects fields outside the editorial whitelist", () => {
    const r = eventEditorialUpdateSchema.parse({ name: "Hacked" } as never);
    expect("name" in r).toBe(false);
  });
});
