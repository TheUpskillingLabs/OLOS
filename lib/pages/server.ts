import { createClient, createServiceClient } from "@/lib/supabase/server";
import { resolveUserRoles } from "@/lib/auth/roles";
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
