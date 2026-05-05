import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { can, isAdmin } from "@/lib/auth/roles";
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
