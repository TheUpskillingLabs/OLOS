import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isOwnerEmail, ensureOwnerRole } from "@/lib/auth/owner-emails";
import { escapeEmailForIlike } from "@/lib/auth/email";
import { hasPlaceholderName } from "@/lib/participants/placeholder";
import { fulfillInvitation } from "@/lib/auth/invitations";

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
          .select("id, auth_user_id, first_name, last_name, profile_image_url")
          .ilike("email", escapeEmailForIlike(email))
          .maybeSingle();

        if (participant) {
          // Link auth_user_id if not yet set, and backfill the Google photo so
          // the member isn't a faceless initials block to peers in the directory
          // / on their /u/[handle] (neither can see the member's OAuth session).
          const googlePhoto =
            (user.user_metadata?.avatar_url as string | undefined) ??
            (user.user_metadata?.picture as string | undefined) ??
            null;
          const patch: Record<string, unknown> = {};
          if (!participant.auth_user_id) patch.auth_user_id = user.id;
          if (!participant.profile_image_url && googlePhoto) {
            patch.profile_image_url = googlePhoto;
          }
          if (Object.keys(patch).length > 0) {
            await serviceClient
              .from("participants")
              .update(patch)
              .eq("id", participant.id);
          }
          if (isOwnerEmail(email)) {
            await ensureOwnerRole(serviceClient, participant.id);
          }

          // Fulfill any pending invitation (placeholder-name aware)
          const hasPlaceholder = hasPlaceholderName(
            participant.first_name,
            participant.last_name
          );
          await fulfillInvitation(
            serviceClient,
            participant.id,
            email,
            hasPlaceholder
          );

          // A returning member lands in the app, not on the public landing.
          return NextResponse.redirect(`${origin}/dashboard`);
        } else {
          // No participant record — redirect to registration
          return NextResponse.redirect(`${origin}/register`);
        }
      }

      return NextResponse.redirect(`${origin}/`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
