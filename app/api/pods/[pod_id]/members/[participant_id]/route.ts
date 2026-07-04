import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { isAdmin, isModeratorForPod } from "@/lib/auth/roles";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { dbError } from "@/lib/api/errors";
import { createServiceClient } from "@/lib/supabase/server";
import { podMemberScopedUpdateSchema } from "@/lib/validations/pod-member-update";

// Poderator-scoped member edits (Pod Squad memo: "someone besides the
// developer making slight adjustments"; prototype member drawer: "scoped
// edits are contact/pod only"). A pod's poderator may fix a member's
// preferred name, phone, or availability note — display/contact fields
// only. Email stays admin-only (PATCH /api/participants/[id]): it's the
// auth-linkage key and changing it can orphan a sign-in. The target must
// actually be a member of this pod — poderator reach never extends past
// their flock.
export const PATCH = withAuth(
  async (
    request: NextRequest,
    auth: AuthenticatedRequest,
    params: Record<string, string>
  ) => {
    const podId = parseIntParam(params.pod_id, "pod_id");
    if (podId instanceof NextResponse) return podId;
    const participantId = parseIntParam(params.participant_id, "participant_id");
    if (participantId instanceof NextResponse) return participantId;

    if (!isAdmin(auth.user) && !isModeratorForPod(auth.user, podId)) {
      return NextResponse.json(
        { error: "Not a poderator for this pod" },
        { status: 403 }
      );
    }

    const body = await parseBody(request, podMemberScopedUpdateSchema);
    if (isErrorResponse(body)) return body;
    if (Object.keys(body).length === 0) {
      return NextResponse.json(
        { error: "Nothing to update" },
        { status: 400 }
      );
    }

    const service = createServiceClient();

    const { data: membership } = await service
      .from("pod_memberships")
      .select("id")
      .eq("pod_id", podId)
      .eq("participant_id", participantId)
      .maybeSingle();
    if (!membership) {
      return NextResponse.json(
        { error: "That participant is not in this pod" },
        { status: 404 }
      );
    }

    const { data: updated, error } = await service
      .from("participants")
      .update(body)
      .eq("id", participantId)
      .select("id, preferred_name, phone_number, availability_snippet")
      .single();
    if (error) return dbError(error, "pod-member-update");

    return NextResponse.json({ updated });
  }
);
