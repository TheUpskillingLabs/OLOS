import { createClient, createServiceClient } from "@/lib/supabase/server";
import { resolveUserRoles } from "@/lib/auth/roles";
import { effectiveUser } from "@/lib/auth/simulation";
import { isFollowing } from "@/lib/follows/data";
import {
  isPageAdmin,
  pageAdmins,
  type PageType,
  type PageAdminEntry,
} from "./authz";

/**
 * Everything an entity page needs about the current viewer, resolved in one
 * place: their id, whether they follow the page, whether they can post as /
 * manage it, and (if so) the page's explicit-admin roster for the manage panel.
 * Signed-out visitors get the null/false shape.
 */
export interface PageContext {
  viewerId: number | null;
  following: boolean;
  isAdmin: boolean;
  admins: PageAdminEntry[];
}

export async function resolvePageContext(
  type: PageType,
  id: number
): Promise<PageContext> {
  const empty: PageContext = {
    viewerId: null,
    following: false,
    isAdmin: false,
    admins: [],
  };

  const supabase = await createClient();
  // The viewer these pages render for, which is the simulated member while a
  // "View as" session is running (lib/auth/simulation.ts). Follow state, the
  // composer identity and the manage panel all hang off this, so leaving it on
  // the real user would show the admin's own follow/manage state inside an
  // otherwise-simulated pod or project page. Nothing here authorizes a write:
  // `isPageAdmin` only decides whether the manage UI renders, the simulated
  // target can never hold an admin role, and every mutation is blocked while
  // the cookie is set.
  const user = await effectiveUser();
  if (!user) return empty;

  const service = createServiceClient();
  const { data: me } = await service
    .from("participants")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!me) return empty;

  const roles = await resolveUserRoles(supabase, user.id);
  const [following, admin] = await Promise.all([
    isFollowing(service, me.id, { type, id }),
    isPageAdmin(service, roles, type, id),
  ]);
  const admins = admin ? await pageAdmins(service, type, id) : [];
  return { viewerId: me.id, following, isAdmin: admin, admins };
}
