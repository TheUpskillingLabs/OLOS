import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
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
