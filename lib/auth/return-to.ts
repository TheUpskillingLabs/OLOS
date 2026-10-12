/* Where a returning member goes after Google sign-in, when a public front
   door sent them to sign in on the way somewhere (today: only the ambassador
   front door, /ambassador/start). The OAuth callback reads the cookie for an
   EXISTING participant and redirects there instead of /dashboard. New members
   still always land on the dashboard after registration (owner decision in
   app/(auth)/register/funnel.tsx) — the dashboard offers the way back.

   An allowlist, not a validator of arbitrary URLs: only same-site paths under
   the prefixes below pass, so the cookie can never become an open redirect.

   Pure module. */

export const RETURN_TO_COOKIE = "return_to";
export const RETURN_TO_MAX_AGE = 60 * 30;

const ALLOWED_PREFIXES = ["/ambassador"];

export function safeReturnTo(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let path: string;
  try {
    path = decodeURIComponent(raw);
  } catch {
    return null;
  }
  // Same-site absolute path only: no scheme, no protocol-relative //, no
  // backslashes (some browsers treat /\ as //), no control characters.
  if (!/^\/[A-Za-z0-9\-/?=&_.%]*$/.test(path) || path.startsWith("//") || path.includes("..")) return null;
  const pathname = path.split("?")[0];
  const ok = ALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  return ok ? path : null;
}
