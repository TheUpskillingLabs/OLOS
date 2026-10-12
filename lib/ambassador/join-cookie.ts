/* The ambassador front door's memory across sign-in. "Become an ambassador"
   (and a coordinator's invite link) goes to /ambassador/start?invite=…&ref=…;
   that route parks the token and the referrer here before sending a
   signed-out visitor through Google sign-in (and, for someone new,
   registration). The apply flow reads it back and clears it on submit; the
   dashboard reads it to offer "Continue to the ambassador application" to a
   brand-new member, since registration always lands on the dashboard.

   Pure module. */

export const AMB_JOIN_COOKIE = "amb_join";
/** A week: long enough to finish registering another day. */
export const AMB_JOIN_MAX_AGE = 60 * 60 * 24 * 7;

export interface AmbJoin {
  invite?: string;
  ref?: string;
}

const TOKEN = /^[A-Za-z0-9_-]{8,64}$/;
const HANDLE = /^[a-z0-9-]{1,80}$/;

/** Keep only well-formed values; anything else is dropped, never trusted. */
export function cleanAmbJoin(v: { invite?: string | null; ref?: string | null }): AmbJoin {
  const out: AmbJoin = {};
  const invite = (v.invite ?? "").trim();
  const ref = (v.ref ?? "").trim().toLowerCase();
  if (TOKEN.test(invite)) out.invite = invite;
  if (HANDLE.test(ref)) out.ref = ref;
  return out;
}

/** Plain JSON: Next's cookie API URL-encodes the value itself. */
export function serializeAmbJoin(v: AmbJoin): string {
  return JSON.stringify(v);
}

export function parseAmbJoin(raw: string | undefined | null): AmbJoin {
  if (!raw) return {};
  try {
    // Cookie APIs hand back the decoded value; a raw header value is still
    // encoded. Decoding is safe either way: clean values never contain "%".
    const o = JSON.parse(raw.includes("%") ? decodeURIComponent(raw) : raw) as { invite?: unknown; ref?: unknown };
    return cleanAmbJoin({
      invite: typeof o.invite === "string" ? o.invite : null,
      ref: typeof o.ref === "string" ? o.ref : null,
    });
  } catch {
    return {};
  }
}
