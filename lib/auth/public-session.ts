import { unstable_rethrow } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/* The public pages' session summary — the production twin of the prototype's
   olos.session.v1 chrome read: the nav's auth cluster (Log in / Join ↔ Home /
   avatar) plus just enough identity (email, name) for member conveniences
   like one-tap event registration. Never gates anything; public pages render
   signed-out on any failure. Callers must be dynamically rendered (the pages
   export dynamic = "force-dynamic") — this reads request cookies. */
export interface PublicSession {
  signedIn: boolean;
  initials: string | null;
  avatarUrl: string | null;
  email: string | null;
  fullName: string | null;
}

const SIGNED_OUT: PublicSession = {
  signedIn: false,
  initials: null,
  avatarUrl: null,
  email: null,
  fullName: null,
};

export async function publicSession(): Promise<PublicSession> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return SIGNED_OUT;

    const serviceClient = createServiceClient();
    const { data: participant } = await serviceClient
      .from("participants")
      .select("first_name, last_name, profile_image_url")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    const initials = participant
      ? `${participant.first_name[0] ?? ""}${participant.last_name[0] ?? ""}`.toUpperCase()
      : (user.email?.[0] ?? "U").toUpperCase();
    const fullName = participant
      ? `${participant.first_name} ${participant.last_name}`.trim()
      : null;
    const avatarUrl =
      participant?.profile_image_url ||
      (user.user_metadata?.avatar_url as string | undefined) ||
      (user.user_metadata?.picture as string | undefined) ||
      null;
    return {
      signedIn: true,
      initials,
      avatarUrl,
      email: user.email?.toLowerCase() ?? null,
      fullName,
    };
  } catch (err) {
    // Never swallow Next.js control-flow errors (dynamic bailouts, redirects).
    unstable_rethrow(err);
    return SIGNED_OUT;
  }
}
