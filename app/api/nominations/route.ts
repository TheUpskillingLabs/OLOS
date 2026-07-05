import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { can, isAdmin } from "@/lib/auth/roles";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { nominationSchema } from "@/lib/validations/nominations";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

export const GET = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const url = new URL(request.url);
    const cycleId = url.searchParams.get("cycle_id");
    const nominationType = url.searchParams.get("nomination_type");
    const participantId = url.searchParams.get("participant_id");

    const isAdminUser = isAdmin(auth.user);
    const canReadParticipants = can(auth.user, "participants:read");
    const moderatorPodIds = auth.user.moderatorPodIds ?? [];

    if (!isAdminUser && !canReadParticipants && moderatorPodIds.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let query = auth.supabase
      .from("nominations")
      .select(
        "id, participant_id, pulse_check_id, cycle_id, nominee_name, nominee_email, nominee_linkedin, nomination_type, reason, created_at, participants:participant_id(id, first_name, last_name, preferred_name)"
      )
      .order("created_at", { ascending: false });

    if (cycleId) query = query.eq("cycle_id", Number(cycleId));
    if (nominationType) query = query.eq("nomination_type", nominationType);
    if (participantId) query = query.eq("participant_id", Number(participantId));

    if (!isAdminUser && !canReadParticipants) {
      const { data: members } = await auth.supabase
        .from("pod_memberships")
        .select("participant_id")
        .in("pod_id", moderatorPodIds)
        .is("inactive_at", null);

      const allowedParticipantIds = Array.from(
        new Set((members ?? []).map((m) => m.participant_id))
      );
      if (allowedParticipantIds.length === 0) {
        return NextResponse.json([]);
      }
      query = query.in("participant_id", allowedParticipantIds);
    }

    const { data, error } = await query;
    if (error) return dbError(error);
    return NextResponse.json(data);
  }
);

/**
 * POST /api/nominations
 *
 * A member nominates someone (a peer for mentor/advisor, or an outsider worth
 * inviting). This is the directory-card / visitor-profile "Nominate" target —
 * standalone, decoupled from the pulse-check bundle.
 *
 * The insert runs through the cookie-bound client so RLS's insert-own policy
 * (migration 00017: `participant_id = current_participant_id()`) fires: the
 * nominator is always the authenticated participant, never a body-supplied id.
 */
export const POST = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const participantId = auth.user.participantId;
    if (!participantId) {
      return NextResponse.json(
        { error: "Not a registered participant" },
        { status: 403 }
      );
    }

    const body = await parseBody(request, nominationSchema);
    if (isErrorResponse(body)) return body;

    const { data, error } = await auth.supabase
      .from("nominations")
      .insert({
        participant_id: participantId,
        nominee_name: body.nominee_name,
        nominee_email: body.nominee_email || null,
        nominee_linkedin: body.nominee_linkedin || null,
        nomination_type: body.nomination_type,
        reason: body.reason,
      })
      .select("id")
      .single();

    if (error) return dbError(error, "post-nomination");
    return NextResponse.json({ id: data.id }, { status: 201 });
  }
);
