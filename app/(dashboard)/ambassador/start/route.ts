import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { AMB_JOIN_COOKIE, AMB_JOIN_MAX_AGE, cleanAmbJoin, serializeAmbJoin } from "@/lib/ambassador/join-cookie";
import { RETURN_TO_COOKIE, RETURN_TO_MAX_AGE } from "@/lib/auth/return-to";
import { AMBASSADOR_APPLY } from "@/lib/ambassador/content";

/**
 * The ambassador front door — public (proxy.ts allowlists exactly this path).
 * Every "Become an ambassador" button and every coordinator invite link
 * (?invite=<token>) and ambassador share link (?ref=<handle>) lands here.
 *
 * It parks the invite/referrer in a cookie (lib/ambassador/join-cookie.ts),
 * then:
 *   - signed in with an account → straight to the apply flow;
 *   - signed out → the join door of sign-in. A returning member comes back to
 *     the apply flow (return_to, lib/auth/return-to.ts); someone new registers
 *     and finds "Continue to the ambassador application" on their dashboard.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const join = cleanAmbJoin({ invite: searchParams.get("invite"), ref: searchParams.get("ref") });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let hasAccount = false;
  if (user) {
    const service = createServiceClient();
    const { data } = await service.from("participants").select("id").eq("auth_user_id", user.id).maybeSingle();
    hasAccount = Boolean(data);
  }

  const res = NextResponse.redirect(
    hasAccount ? `${origin}${AMBASSADOR_APPLY}` : user ? `${origin}/register` : `${origin}/login?intent=join`
  );
  const secure = origin.startsWith("https://");
  // Always parked, even empty: its presence is how the dashboard knows a new
  // member came in through this door (lib/ambassador/tasks.ts).
  res.cookies.set(AMB_JOIN_COOKIE, serializeAmbJoin(join), {
    path: "/",
    maxAge: AMB_JOIN_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    secure,
  });
  if (!hasAccount) {
    res.cookies.set(RETURN_TO_COOKIE, AMBASSADOR_APPLY, {
      path: "/",
      maxAge: RETURN_TO_MAX_AGE,
      httpOnly: true,
      sameSite: "lax",
      secure,
    });
  }
  return res;
}
