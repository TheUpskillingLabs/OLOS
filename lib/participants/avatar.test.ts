import { describe, it, expect } from "vitest";
import { resolveAvatarUrl } from "./avatar";

describe("resolveAvatarUrl", () => {
  it("prefers the uploaded photo over Google and initials", () => {
    expect(
      resolveAvatarUrl(
        { profile_image_url: "/up.jpg" },
        { user_metadata: { avatar_url: "https://g/pic" } }
      )
    ).toBe("/up.jpg");
  });

  it("falls back to the Google photo when nothing is uploaded", () => {
    expect(
      resolveAvatarUrl(
        { profile_image_url: null },
        { user_metadata: { avatar_url: "https://g/pic" } }
      )
    ).toBe("https://g/pic");
    // `picture` is the alternate Google key.
    expect(
      resolveAvatarUrl({}, { user_metadata: { picture: "https://g/pic2" } })
    ).toBe("https://g/pic2");
  });

  it("returns null when there's no photo and no viewer session (peer view)", () => {
    expect(resolveAvatarUrl({ profile_image_url: null })).toBeNull();
    expect(resolveAvatarUrl({})).toBeNull();
  });
});
