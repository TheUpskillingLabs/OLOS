import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  SIMULATION_COOKIE,
  SIMULATION_BLOCKED_MESSAGE,
} from "@/lib/auth/simulation-cookie";

/** Requests that cannot change anything, so they run freely while simulating. */
const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * The coarse half of the member-simulation write block (lib/auth/simulation.ts).
 *
 * While the simulation cookie is set, an admin is looking at the app through
 * someone else's account — nothing may be written. This checks cookie PRESENCE
 * only: verifying the signature would mean crypto in the edge path, and getting
 * it wrong in the permissive direction is the failure that matters. A forged or
 * expired cookie makes a request MORE restricted, never less, so presence is the
 * right test here. `withAuth` does the signature-verified check behind it.
 *
 * `/api/admin/simulate` is exempt so exiting a simulation is always possible.
 */
function simulationWriteBlock(request: NextRequest): NextResponse | null {
  if (READ_ONLY_METHODS.has(request.method)) return null;
  if (!request.cookies.get(SIMULATION_COOKIE)) return null;
  if (request.nextUrl.pathname.startsWith("/api/admin/simulate")) return null;

  return NextResponse.json(
    { error: SIMULATION_BLOCKED_MESSAGE },
    { status: 403 }
  );
}

export async function proxy(request: NextRequest) {
  const blocked = simulationWriteBlock(request);
  if (blocked) return blocked;

  // Skip auth check if Supabase env vars are not configured
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return NextResponse.next();
  }

  try {
    // Forward the current pathname to server components via a request header
    // so layouts can make path-aware decisions.
    request.headers.set("x-pathname", request.nextUrl.pathname);
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            request.headers.set("x-pathname", request.nextUrl.pathname);
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Redirect unauthenticated users to login (except public routes and API routes)
    // API routes handle their own auth via withAuth/withAdminAuth wrappers.
    // The public web (landing + content pages) browses free — owner rule:
    // no gated browse.
    const publicPaths = [
      "/login",
      "/api/",
      "/register",
      "/c/", // public shareable cycle info pages — browses free, no auth
      "/events",
      "/library",
      "/local-labs",
      "/labs", // old path — next.config redirects it to /local-labs
      "/about",
      "/build-cycles",
      "/stories", // public Upskiller Spotlights — browses free, no auth
      "/survey", // public field survey — account-free, anonymous submit
      // Footer pages — legal, contact, get-involved, donate, board browse free.
      "/privacy",
      "/terms",
      "/code-of-conduct",
      "/contact",
      "/get-involved",
      "/donate",
      "/board",
      "/team", // old path — next.config redirects it to /board
    ];
    const isPublicPath =
      request.nextUrl.pathname === "/" ||
      publicPaths.some((path) => request.nextUrl.pathname.startsWith(path));

    if (!user && !isPublicPath && !request.nextUrl.pathname.startsWith("/_next")) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  } catch (error) {
    console.error("[AUTH_MIDDLEWARE] Auth check failed:", error);
    // Fail closed: redirect to login rather than passing unauthenticated requests through
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
