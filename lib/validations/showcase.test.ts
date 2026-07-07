import { describe, it, expect } from "vitest";
import {
  entityLinkCreateSchema,
  followToggleSchema,
  showcasePageSchema,
} from "./showcase";

describe("entityLinkCreateSchema — URL scheme guard", () => {
  const base = { owner_type: "pod" as const, owner_id: 1, platform: "github" as const };

  it("accepts http and https URLs", () => {
    expect(
      entityLinkCreateSchema.safeParse({ ...base, url: "https://github.com/org" }).success
    ).toBe(true);
    expect(
      entityLinkCreateSchema.safeParse({ ...base, url: "http://example.com" }).success
    ).toBe(true);
  });

  it("rejects javascript:, data:, mailto:, ftp:, and scheme-relative URLs (XSS guard)", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "mailto:x@y.com",
      "ftp://host/file",
      "//evil.com",
      "not a url",
      "",
    ]) {
      expect(entityLinkCreateSchema.safeParse({ ...base, url }).success).toBe(false);
    }
  });

  it("rejects an unknown platform", () => {
    expect(
      entityLinkCreateSchema.safeParse({
        ...base,
        platform: "myspace",
        url: "https://x.com",
      }).success
    ).toBe(false);
  });
});

describe("followToggleSchema", () => {
  it("accepts the four target types with a positive id", () => {
    for (const target_type of ["participant", "pod", "project", "cycle"] as const) {
      expect(followToggleSchema.safeParse({ target_type, target_id: 3 }).success).toBe(true);
    }
  });

  it("rejects an unknown type or a non-positive id", () => {
    expect(followToggleSchema.safeParse({ target_type: "team", target_id: 1 }).success).toBe(false);
    expect(followToggleSchema.safeParse({ target_type: "pod", target_id: 0 }).success).toBe(false);
    expect(followToggleSchema.safeParse({ target_type: "pod", target_id: -1 }).success).toBe(false);
  });
});

describe("showcasePageSchema", () => {
  it("strips image URL keys so they can never be set via the page PATCH", () => {
    const parsed = showcasePageSchema.parse({
      tagline: "We ship",
      logo_url: "javascript:alert(1)",
      cover_url: "https://evil.com/x.png",
    } as Record<string, unknown>);
    expect(parsed).not.toHaveProperty("logo_url");
    expect(parsed).not.toHaveProperty("cover_url");
    expect(parsed.tagline).toBe("We ship");
  });

  it("rejects an over-long tagline", () => {
    expect(
      showcasePageSchema.safeParse({ tagline: "x".repeat(201) }).success
    ).toBe(false);
  });
});
