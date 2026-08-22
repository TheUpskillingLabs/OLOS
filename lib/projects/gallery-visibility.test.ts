import { describe, it, expect } from "vitest";
import { resolveGalleryView } from "./gallery-visibility";

describe("resolveGalleryView", () => {
  it("is hidden before submissions open / after voting closes", () => {
    expect(
      resolveGalleryView({
        galleryOpen: false,
        hasSubmittedOwn: true,
        votingOpen: true,
      })
    ).toBe("hidden");
  });

  it("is abbreviated when open but the member hasn't submitted and voting isn't open", () => {
    expect(
      resolveGalleryView({
        galleryOpen: true,
        hasSubmittedOwn: false,
        votingOpen: false,
      })
    ).toBe("abbreviated");
  });

  it("expands once the member has submitted their own pitch (pre-voting)", () => {
    expect(
      resolveGalleryView({
        galleryOpen: true,
        hasSubmittedOwn: true,
        votingOpen: false,
      })
    ).toBe("expanded");
  });

  it("expands for everyone once voting opens, even non-submitters", () => {
    expect(
      resolveGalleryView({
        galleryOpen: true,
        hasSubmittedOwn: false,
        votingOpen: true,
      })
    ).toBe("expanded");
  });

  it("stays hidden regardless of the other flags when the window is closed", () => {
    expect(
      resolveGalleryView({
        galleryOpen: false,
        hasSubmittedOwn: false,
        votingOpen: false,
      })
    ).toBe("hidden");
  });
});
