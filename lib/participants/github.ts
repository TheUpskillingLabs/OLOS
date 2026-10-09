/* GitHub usernames members give us on their profile (participants.github_username).
   Shared by the profile-edit form and the PATCH route's zod schema so both
   accept the same input. */

/** GitHub's rules: 1–39 chars, alphanumerics and single hyphens, no leading
    or trailing hyphen. */
export const GITHUB_USERNAME_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

/** Accept what people actually paste — "octocat", "@octocat", or
    "https://github.com/octocat/" — and reduce it to the bare username.
    Doesn't validate; pair with isValidGithubUsername. */
export function normalizeGithubUsername(input: string): string {
  return input
    .trim()
    .replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "");
}

export function isValidGithubUsername(u: string): boolean {
  return GITHUB_USERNAME_RE.test(u);
}
