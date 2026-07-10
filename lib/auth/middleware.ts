import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveUserRoles, UserRoles, isAdmin, isOwner, can } from "./roles";
import type { Permission } from "./permissions";

export interface AuthenticatedRequest {
  user: UserRoles;
  supabase: Awaited<ReturnType<typeof createClient>>;
}

type RouteHandler = (
  request: NextRequest,
  auth: AuthenticatedRequest,
  params: Record<string, string>
) => Promise<NextResponse>;

export function withAuth(handler: RouteHandler) {
  return async (request: NextRequest, context: { params: Promise<Record<string, string>> }) => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roles = await resolveUserRoles(supabase, user.id);
    const params = await context.params;
    return handler(request, { user: roles, supabase }, params);
  };
}

export function withAdminAuth(handler: RouteHandler) {
  return withAuth(async (request, auth, params) => {
    if (!isAdmin(auth.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return handler(request, auth, params);
  });
}

export function withOwnerAuth(handler: RouteHandler) {
  return withAuth(async (request, auth, params) => {
    if (!isOwner(auth.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return handler(request, auth, params);
  });
}

/**
 * Gate a route on a single granular permission. Used by the pod/project
 * lifecycle routes, which accept anyone with "pods:write" (admins, owners,
 * developers, and metro-scoped labs leads) — wider than withAdminAuth, which
 * requires "cycles:write". Metro scoping for labs leads is enforced separately
 * inside each handler via canManageCycle() after loading the target cycle.
 */
export function withPermissionAuth(permission: Permission, handler: RouteHandler) {
  return withAuth(async (request, auth, params) => {
    if (!can(auth.user, permission)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return handler(request, auth, params);
  });
}
