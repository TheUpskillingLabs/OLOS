import { describe, it, expect } from "vitest";
import { normalizeGithubUsername, isValidGithubUsername } from "./github";

describe("normalizeGithubUsername", () => {
  it("leaves a bare username alone", () => {
    expect(normalizeGithubUsername("octocat")).toBe("octocat");
  });
  it("strips a leading @ and surrounding whitespace", () => {
    expect(normalizeGithubUsername("  @octocat ")).toBe("octocat");
  });
  it("strips a pasted profile URL", () => {
    expect(normalizeGithubUsername("https://github.com/octocat/")).toBe("octocat");
    expect(normalizeGithubUsername("www.GitHub.com/octocat")).toBe("octocat");
  });
});

describe("isValidGithubUsername", () => {
  it("accepts alphanumerics and single hyphens", () => {
    expect(isValidGithubUsername("octo-cat99")).toBe(true);
    expect(isValidGithubUsername("a")).toBe(true);
    expect(isValidGithubUsername("a".repeat(39))).toBe(true);
  });
  it("rejects leading, trailing, or double hyphens", () => {
    expect(isValidGithubUsername("-octocat")).toBe(false);
    expect(isValidGithubUsername("octocat-")).toBe(false);
    expect(isValidGithubUsername("octo--cat")).toBe(false);
  });
  it("rejects other characters, empty, and >39 chars", () => {
    expect(isValidGithubUsername("octo_cat")).toBe(false);
    expect(isValidGithubUsername("octocat/repo")).toBe(false);
    expect(isValidGithubUsername("")).toBe(false);
    expect(isValidGithubUsername("a".repeat(40))).toBe(false);
  });
});
