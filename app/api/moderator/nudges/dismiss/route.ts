import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { isAdmin, isModeratorForPod } from "@/lib/auth/roles";

/**
 * POST /api/moderator/nudges/dismiss
 *
 * Records a per-poderator dismissal of a specific nudge instance.
 *
 * Body: { pod_id: number, nudge_key: string }
 *
 * Caller must be admin/owner or an active moderator for the pod. RLS
 * on nudge_dismissals enforces the same predicate at the DB layer, so
 * this is defence-in-depth for clearer error messages.
 *
 * Idempotent: re-dismissing an already-dismissed key returns 204
 * without writing again (the UNIQUE constraint short-circuits in the
 * upsert).
 */
const bodySchema = z.object({
  pod_id: z.number().int().positive(),
  nudge_key: z.string().min(1).max(200),
});

export const POST = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const raw = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const { pod_id, nudge_key } = parsed.data;

    if (!isAdmin(auth.user) && !isModeratorForPod(auth.user, pod_id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!auth.user.participantId) {
      return NextResponse.json(
        { error: "No participant record on caller" },
        { status: 400 }
      );
    }

    const { error } = await auth.supabase
      .from("nudge_dismissals")
      .upsert(
        {
          moderator_participant_id: auth.user.participantId,
          pod_id,
          nudge_key,
        },
        {
          onConflict: "moderator_participant_id,pod_id,nudge_key",
          ignoreDuplicates: true,
        }
      );

    if (error) {
      return NextResponse.json(
        { error: "Failed to record dismissal" },
        { status: 500 }
      );
    }
    return new NextResponse(null, { status: 204 });
  }
);
