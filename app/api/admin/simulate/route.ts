import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { dbError } from "@/lib/api/errors";
import { createServiceClient } from "@/lib/supabase/server";
import { isOwner } from "@/lib/auth/roles";
import { isProdProject } from "@/lib/env/project";
import {
  SIMULATION_COOKIE,
  SIMULATION_TTL_SECONDS,
  loadSimulationTarget,
  readSimulationCookie,
  signSimulation,
  stampSimulationEnd,
} from "@/lib/auth/simulation";

// Start / stop a read-only member-view simulation (lib/auth/simulation.ts).
//
// These two handlers are the ONLY non-GET requests allowed while a simulation
// is running — proxy.ts and withAuth both exempt /api/admin/simulate so an
// admin can always stop what they started. Everything else 403s.
//
// Nothing here is load-bearing for security on its own: the cookie is re-checked
// from scratch on every request (actor still signed in, still an admin, still an
// owner on prod, target still non-admin), so a stale cookie decays into "not
// simulating" rather than into access.

const simulateSchema = z.object({ participant_id: z.number().int() }).strict();

export const POST = withAdminAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    // Prod holds real participant data, so viewing through someone's account
    // there is owner-only. Everywhere else any admin may simulate.
    if (isProdProject() && !isOwner(auth.user)) {
      return NextResponse.json(
        { error: "Simulating a member on production is owner-only." },
        { status: 403 }
      );
    }

    const body = await parseBody(request, simulateSchema);
    if (isErrorResponse(body)) return body;

    if (body.participant_id === auth.user.participantId) {
      return NextResponse.json(
        { error: "You are already yourself." },
        { status: 400 }
      );
    }

    const service = createServiceClient();
    const target = await loadSimulationTarget(service, body.participant_id);
    if (!target) {
      // One message for all three rejections (missing, never signed in, holds
      // an authority role) — the UI disables the button for the cases it can
      // see, and this route must not become a probe for who is an admin.
      return NextResponse.json(
        {
          error:
            "That participant can't be simulated — they may not exist, may never have signed in, or may hold an admin role.",
        },
        { status: 403 }
      );
    }

    const { error: auditError } = await service
      .from("simulation_sessions")
      .insert({
        actor_participant_id: auth.user.participantId,
        target_participant_id: target.participantId,
      });
    if (auditError) return dbError(auditError, "simulation-start");

    const response = NextResponse.json({ simulating: true, target });
    response.cookies.set(
      SIMULATION_COOKIE,
      signSimulation({
        p: target.participantId,
        a: auth.user.userId,
        exp: Math.floor(Date.now() / 1000) + SIMULATION_TTL_SECONDS,
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SIMULATION_TTL_SECONDS,
      }
    );
    return response;
  }
);

export const DELETE = withAdminAuth(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (_request: NextRequest, _auth: AuthenticatedRequest) => {
    const payload = await readSimulationCookie();
    if (payload) await stampSimulationEnd(createServiceClient(), payload);

    const response = NextResponse.json({ simulating: false });
    response.cookies.delete(SIMULATION_COOKIE);
    return response;
  }
);
