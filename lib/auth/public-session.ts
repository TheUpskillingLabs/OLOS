import { unstable_rethrow } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/* The public pages' session summary — the production twin of the prototype's
   olos.session.v1 chrome read: just enough to swap the nav's auth cluster
   (Log in / Join ↔ Home / avatar). Never gates anything; public pages render
   signed-out on any failure. Callers must be dynamically rendered (the pages
   export dynamic = "force-dynamic") — this reads request cookies. */
export async function publicSession(): Promise<{
  signedIn: boolean;
  initials: string | null;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { signedIn: false, initials: null };

    const serviceClient = createServiceClient();
    const { data: participant } = await serviceClient
      .from("participants")
      .select("first_name, last_name")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    const initials = participant
      ? `${participant.first_name[0] ?? ""}${participant.last_name[0] ?? ""}`.toUpperCase()
      : (user.email?.[0] ?? "U").toUpperCase();
    return { signedIn: true, initials };
  } catch (err) {
    // Never swallow Next.js control-flow errors (dynamic bailouts, redirects).
    unstable_rethrow(err);
    return { signedIn: false, initials: null };
  }
}
