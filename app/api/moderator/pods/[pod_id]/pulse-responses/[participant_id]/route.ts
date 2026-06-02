import { NextResponse, NextRequest } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { requireModeratorForPod } from "@/lib/auth/moderator";
import { parseIntParam } from "@/lib/api/params";
import { getMemberPulseHistory } from "@/lib/moderator/pulse-responses";

/**
 * GET /api/moderator/pods/[pod_id]/pulse-responses/[participant_id]
 *
 * Backs the pulse review side panel (PRD §7.4 + §7.9.1 aggregate).
 *
 * Returns:
 *   - aggregate: top AI tools + engagement trajectory (full cycle)
 *   - responses: per-pulse rows, most recent first, with survey_responses
 *
 * Auth: caller must be admin/owner OR an active moderator for the pod.
 * Additionally, the participant must be a (current or historical)
 * member of the pod — without this an assigned poderator could read
 * any participant's pulses via URL manipulation.
 */
export const GET = withAuth(
  async (
    _request: NextRequest,
    auth: AuthenticatedRequest,
    params: Record<string, string>
  ) => {
    const podId = parseIntParam(params.pod_id, "pod_id");
    if (podId instanceof NextResponse) return podId;
    const participantId = parseIntParam(params.participant_id, "participant_id");
    if (participantId instanceof NextResponse) return participantId;

    const guard = requireModeratorForPod(auth.user, podId);
    if (guard) return guard;

    const result = await getMemberPulseHistory(auth.supabase, podId, participantId);
    if ("error" in result) {
      if (result.error === "pod-not-found") {
        return NextResponse.json({ error: "Pod not found" }, { status: 404 });
      }
      // not-pod-member → 403 (not 404, since the caller is authorized for
      // the pod and we want to be explicit they are asking for someone
      // they shouldn't be looking up via this surface).
      return NextResponse.json(
        { error: "Participant is not a member of this pod" },
        { status: 403 }
      );
    }
    return NextResponse.json(result);
  }
);
