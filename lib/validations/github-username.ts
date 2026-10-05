/* GitHub usernames (readiness step 5, #413): what GitHub itself allows —
   1–39 characters, letters, digits and single hyphens, never starting or
   ending with a hyphen. Members paste all sorts of things, so
   normalizeGithubUsername accepts "@name" and a profile URL and keeps just
   the username; validation runs on the normalized value. Pure module. */

export const GITHUB_USERNAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;

export function normalizeGithubUsername(raw: string): string {
  let v = raw.trim();
  v = v.replace(/^https?:\/\/(www\.)?github\.com\//i, "");
  v = v.replace(/^github\.com\//i, "");
  v = v.replace(/^@/, "");
  v = v.split(/[/?#]/)[0] ?? "";
  return v.trim();
}

export function isValidGithubUsername(v: string): boolean {
  return GITHUB_USERNAME_RE.test(v);
}

export const GITHUB_USERNAME_HELP =
  "Just the username. You'll be invited to the Labs' GitHub organization when your pod forms.";
