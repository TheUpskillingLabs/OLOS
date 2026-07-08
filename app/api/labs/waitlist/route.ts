import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { findOrCreateWaitlistLab } from "@/lib/labs/membership";
import { startWaitlistSchema } from "@/lib/validations/labs";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

// POST /api/labs/waitlist — "start a waitlist" (docs/LOCAL_LABS.md). Names a
// city/state; find-or-create a status='waitlist' lab (deduped) and add the
// caller to metro_waitlist_signups. If the named city already exists as an
// ACTIVE lab, this is really a join — return { active } so the client can use
// the join path instead. metro_id stays NULL (waitlisted, not an active
// member) either way.
export const POST = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const participantId = auth.user.participantId;
    if (!participantId) {
      return NextResponse.json(
        { error: "Not a registered participant", redirect: "/register" },
        { status: 403 }
      );
    }

    const body = await parseBody(request, startWaitlistSchema);
    if (isErrorResponse(body)) return body;

    const supabase = createServiceClient();

    const { lab, error } = await findOrCreateWaitlistLab(supabase, {
      city: body.city,
      st: body.st ?? null,
    });
    if (error || !lab) {
      return NextResponse.json(
        { error: error ?? "Could not start the waitlist" },
        { status: 400 }
      );
    }

    if (lab.status === "active") {
      return NextResponse.json(
        {
          active: true,
          lab: { id: lab.id, slug: lab.slug, name: lab.name },
        },
        { status: 200 }
      );
    }

    const { error: insertError } = await supabase
      .from("metro_waitlist_signups")
      .insert({ metro_id: lab.id, participant_id: participantId });
    // 23505 = already on the list — joining twice is a no-op.
    if (insertError && insertError.code !== "23505") {
      return dbError(insertError, "start-waitlist");
    }

    return NextResponse.json(
      { joined: true, lab: { id: lab.id, slug: lab.slug, name: lab.name } },
      { status: 200 }
    );
  }
);
