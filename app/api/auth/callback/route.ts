import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { escapeEmailForIlike } from "@/lib/auth/email";
import { hasPlaceholderName } from "@/lib/participants/placeholder";
import { fulfillInvitation } from "@/lib/auth/invitations";

// The login door sets auth_intent=login before kicking off OAuth (the join
// door sets "join") — see app/(auth)/login/login-card.tsx. An unknown Google
// account through the login door gets "no account" instead of silently
// landing in registration.
function authIntent(request: Request): string {
  const cookies = request.headers.get("cookie") ?? "";
  const m = cookies.match(/(?:^|;\s*)auth_intent=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : "";
}

function clearIntentCookie(res: NextResponse): NextResponse {
  res.cookies.set("auth_intent", "", { path: "/", maxAge: 0 });
  return res;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const serviceClient = createServiceClient();
        const email = user.email;

        if (!email) {
          return NextResponse.redirect(`${origin}/login?error=auth_failed`);
        }

        // Case-insensitive lookup against the unique-on-lower(email) index
        // from migration 00016. escapeEmailForIlike neutralizes `_` and `%`
        // pattern characters that ILIKE would otherwise interpret as
        // wildcards (architecture review broken edge #19).
        const { data: participant } = await serviceClient
          .from("participants")
          .select("id, auth_user_id, first_name, last_name")
          .ilike("email", escapeEmailForIlike(email))
          .maybeSingle();

        if (participant) {
          // Link auth_user_id if not yet set
          if (!participant.auth_user_id) {
            await serviceClient
              .from("participants")
              .update({ auth_user_id: user.id })
              .eq("id", participant.id);
          }
          // Owner is NOT self-serve: authority stems from the rooted HQ owner
          // (participant_roles, migration 00066), never from an email allowlist
          // at sign-in. The old OWNER_EMAILS auto-promotion was retired with
          // the authorization unification (docs auth unification).

          // Fulfill any pending invitation (placeholder-name aware)
          const hasPlaceholder = hasPlaceholderName(
            participant.first_name,
            participant.last_name,
          );
          await fulfillInvitation(
            serviceClient,
            participant.id,
            email,
            hasPlaceholder,
          );

          // A returning member lands in the app, not on the public landing.
          return clearIntentCookie(
            NextResponse.redirect(`${origin}/dashboard`),
          );
        } else if (authIntent(request) === "login") {
          // Logging in with a Google account we don't know: say so rather
          // than silently opening registration (owner ask, July 2026). Sign
          // the Supabase session back out so a retry starts clean.
          await supabase.auth.signOut();
          return clearIntentCookie(
            NextResponse.redirect(
              `${origin}/login?error=no_account&email=${encodeURIComponent(email)}`,
            ),
          );
        } else {
          // No participant record — joining: continue into registration.
          return clearIntentCookie(NextResponse.redirect(`${origin}/register`));
        }
      }

      return NextResponse.redirect(`${origin}/`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
