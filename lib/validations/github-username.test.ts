import { describe, expect, it } from "vitest";
import {
  isValidGithubUsername,
  normalizeGithubUsername,
} from "./github-username";
import { participantsUpdateSchema } from "./participants-update";

describe("GitHub usernames", () => {
  it("accepts what GitHub allows", () => {
    for (const ok of ["octo", "octo-cat", "a", "A1-b2-C3", "x".repeat(39)]) {
      expect(isValidGithubUsername(ok), ok).toBe(true);
    }
  });

  it("rejects what GitHub does not", () => {
    for (const bad of ["", "-octo", "octo-", "oc--to", "octo_cat", "octo cat", "x".repeat(40)]) {
      expect(isValidGithubUsername(bad), bad).toBe(false);
    }
  });

  it("keeps just the username from what members paste", () => {
    expect(normalizeGithubUsername("  @octo-cat ")).toBe("octo-cat");
    expect(normalizeGithubUsername("https://github.com/octo-cat")).toBe("octo-cat");
    expect(normalizeGithubUsername("https://www.github.com/octo-cat/repo?tab=1")).toBe("octo-cat");
    expect(normalizeGithubUsername("github.com/octo-cat/")).toBe("octo-cat");
  });
});

describe("participantsUpdateSchema.github_username", () => {
  it("accepts a valid username and null (to clear it)", () => {
    expect(participantsUpdateSchema.safeParse({ github_username: "octo-cat" }).success).toBe(true);
    expect(participantsUpdateSchema.safeParse({ github_username: null }).success).toBe(true);
  });

  it("rejects an invalid username", () => {
    expect(participantsUpdateSchema.safeParse({ github_username: "-bad-" }).success).toBe(false);
  });
});
