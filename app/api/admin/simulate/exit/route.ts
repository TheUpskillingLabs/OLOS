import { NextResponse, NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  SIMULATION_COOKIE,
  readSimulationCookie,
  stampSimulationEnd,
} from "@/lib/auth/simulation";

// Leave a member-view simulation. This is the banner's "Exit" link.
//
// A GET on purpose, and the one escape hatch that always works:
//   - the read-only block rejects every non-GET while simulating;
//   - the weekly Learning Log gate can pin the simulated member to /dashboard;
//   - it needs no JavaScript, so it survives a page that failed to hydrate.
//
// Clearing a cookie is safe for anyone to do to themselves, so there is no auth
// wrapper here — the worst a caller can do is end their own simulation.

const DEFAULT_NEXT = "/admin/people";

/** Only same-origin relative paths — never let ?next= become an open redirect. */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return DEFAULT_NEXT;
  return raw;
}

export async function GET(request: NextRequest) {
  const payload = await readSimulationCookie();
  if (payload) await stampSimulationEnd(createServiceClient(), payload);

  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const response = NextResponse.redirect(new URL(next, request.nextUrl.origin));
  response.cookies.delete(SIMULATION_COOKIE);
  return response;
}
