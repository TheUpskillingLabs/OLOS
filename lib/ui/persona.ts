/**
 * Persona derivation for the signed-in app bar's persona pill and the
 * avatar menu's "View as" radios. Pure so it can be unit tested.
 *
 * The persona must reflect the viewer's actual capacity on this surface,
 * mirroring the View-as switcher's own gating — never a persona the
 * switcher wouldn't offer them. Deriving from the pathname alone was a
 * bug: requireLabLead admits admins to /lab/<slug>, so an admin drilling
 * into a lab they don't lead was labelled "Lab lead".
 */

export type Persona = "admin" | "poderator" | "lablead" | null;

/** Exact match or segment-boundary prefix — same rule as app-nav's isActive. */
function under(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

export function derivePersona(
  pathname: string,
  opts: {
    isAdmin: boolean;
    isModerator: boolean;
    showPods: boolean;
    labLeadHref: string | null;
  }
): Persona {
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/moderator")) {
    // Same gate as the View-as "Poderator" radio. Admins hold pods:read,
    // so they keep the moderator persona here — consistent with the
    // switcher offering it to them. The admin fallback is defensive.
    if (opts.isModerator || opts.showPods) return "poderator";
    return opts.isAdmin ? "admin" : null;
  }
  if (pathname.startsWith("/lab/")) {
    // requireLabLead guarantees a NON-admin on /lab/<slug> leads that lab.
    // An admin is only "Lab lead" when this workspace is the lab their
    // View-as entry points at; otherwise they're here in admin capacity
    // (the lab layout shows them "HQ view →" for the same reason).
    // Known edge: labLeadHref carries only the first led lab, so an admin
    // leading several labs sees "Admin" on the others — still truthful.
    if (opts.labLeadHref && (!opts.isAdmin || under(pathname, opts.labLeadHref)))
      return "lablead";
    return opts.isAdmin ? "admin" : null;
  }
  return null;
}
