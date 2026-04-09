import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isOwnerEmail, ensureOwnerRole } from "@/lib/auth/owner-emails";

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

        // Check if a participant record exists for this email
        const { data: participant } = await serviceClient
          .from("participants")
          .select("id, auth_user_id")
          .eq("email", email)
          .maybeSingle();

        if (participant) {
          // Link auth_user_id if not yet set
          if (!participant.auth_user_id) {
            await serviceClient
              .from("participants")
              .update({ auth_user_id: user.id })
              .eq("id", participant.id);
          }
          if (email && isOwnerEmail(email)) {
            await ensureOwnerRole(serviceClient, participant.id);
          }
          return NextResponse.redirect(`${origin}/`);
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
