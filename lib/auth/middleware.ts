import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveUserRoles, UserRoles, isAdmin, isOwner } from "./roles";
import { simulationContext } from "./simulation";

export interface AuthenticatedRequest {
  user: UserRoles;
  supabase: Awaited<ReturnType<typeof createClient>>;
}

type RouteHandler = (
  request: NextRequest,
  auth: AuthenticatedRequest,
  params: Record<string, string>
) => Promise<NextResponse>;

/** Requests that cannot change anything, so they run freely while simulating. */
const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function withAuth(handler: RouteHandler) {
  return async (request: NextRequest, context: { params: Promise<Record<string, string>> }) => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // The authoritative half of the member-simulation write block
    // (lib/auth/simulation.ts) — signature-verified, behind the edge proxy's
    // coarse presence check. An admin viewing the app through someone else's
    // account may not write through it. /api/admin/simulate is exempt: exiting
    // a simulation has to stay possible from inside one.
    //
    // NOTE: `auth.user` below is always the REAL caller. Simulation swaps who
    // the member PAGES render for, never who a request is authorized as.
    if (
      !READ_ONLY_METHODS.has(request.method) &&
      !request.nextUrl.pathname.startsWith("/api/admin/simulate") &&
      (await simulationContext())
    ) {
      return NextResponse.json(
        {
          error:
            "Read-only while simulating a member. Exit the simulation to make changes.",
        },
        { status: 403 }
      );
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
