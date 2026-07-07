import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  );
}

// Validate the service-role key up front so a misconfigured key fails LOUD with
// a clear message. A malformed key (empty, or accidentally wrapped in angle
// brackets like "<sb_secret_...>") otherwise makes every service-role query fail
// with "Invalid API key", which surfaces to users as being silently bounced to
// /register — a very confusing outage to diagnose.
function requireServiceRoleKey(): string {
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  }
  if (key.startsWith("<") || key.endsWith(">")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY looks malformed — it is wrapped in angle brackets. " +
        "Set it to the raw key value with no surrounding <> characters."
    );
  }
  if (!/^(sb_secret_|sb_|eyJ)/.test(key)) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY does not look like a Supabase service key " +
        "(expected to start with 'sb_secret_' or a JWT 'eyJ')."
    );
  }
  return key;
}

export function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    requireServiceRoleKey(),
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
    }
  );
}
