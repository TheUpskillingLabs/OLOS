import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { resolveUserRoles, isAdmin, type UserRoles } from "@/lib/auth/roles";

/**
 * The single admin gate for every `/admin` page — the page-side twin of
 * `withAdminAuth` in `lib/auth/middleware.ts`. The admin layout calls this once
 * to guard the whole surface; pages call it again to get `serviceClient` +
 * `userRoles` for their own reads.
 *
 * `React.cache()` memoizes the result per request render, so the layout call and
 * any page call share a single auth round-trip.
 *
 * Admin pages read with the service-role client (which bypasses RLS), so this
 * gate is the ONLY protection over those reads — it must fail closed: no user →
 * `/login`, not-admin → `/cycles`. Kept out of `roles.ts` so that module stays
 * free of `next/navigation`.
 */
export interface AdminContext {
  user: User;
  userRoles: UserRoles;
  serviceClient: ReturnType<typeof createServiceClient>;
}

export const requireAdmin = cache(async (): Promise<AdminContext> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const serviceClient = createServiceClient();
  const userRoles = await resolveUserRoles(serviceClient, user.id);
  if (!isAdmin(userRoles)) redirect("/cycles");

  return { user, userRoles, serviceClient };
});

/**
 * The page-side gate for the /labs/[slug] workspace (docs/LOCAL_LABS.md):
 * admin OR an active lead of that specific lab. Same fail-closed contract
 * as requireAdmin — lab pages read with the service-role client, so this
 * gate is their only protection. Admins pass so HQ can always drill into
 * a lab workspace.
 */
export interface LabContext extends AdminContext {
  lab: { id: number; slug: string; name: string; st: string | null; status: string };
}

export const requireLabLead = cache(
  async (slug: string): Promise<LabContext> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const serviceClient = createServiceClient();
    const [userRoles, { data: lab }] = await Promise.all([
      resolveUserRoles(serviceClient, user.id),
      serviceClient
        .from("metros")
        .select("id, slug, name, st, status")
        .eq("slug", slug)
        .maybeSingle(),
    ]);
    if (!lab) redirect("/dashboard");
    if (!isAdmin(userRoles) && !userRoles.labLeadLabIds.includes(lab.id)) {
      redirect("/dashboard");
    }

    return { user, userRoles, serviceClient, lab };
  }
);
