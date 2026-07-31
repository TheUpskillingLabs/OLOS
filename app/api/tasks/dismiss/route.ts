import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { TASK_KEY_MAX_LENGTH, TASK_KEY_PATTERN } from "@/lib/tasks/keys";

/**
 * POST /api/tasks/dismiss — record a member's dismissal of a task instance.
 * DELETE /api/tasks/dismiss — un-dismiss (remove the row).
 *
 * Body: { task_key: string } — the occurrence key from lib/tasks/keys.ts.
 *
 * Modeled on /api/moderator/nudges/dismiss. Writes go through the USER
 * client so task_dismissals RLS (self-only) is the enforcement; this route
 * is defence-in-depth for clearer errors. Idempotent: re-dismissing an
 * already-dismissed key returns 204 without writing again.
 *
 * No per-key semantic validation here: the assembler only honors
 * dismissals on dismissible task kinds (lib/tasks/assemble.ts), so a
 * forged or stale key is inert.
 */
const bodySchema = z.object({
  task_key: z.string().min(1).max(TASK_KEY_MAX_LENGTH).regex(TASK_KEY_PATTERN),
});

async function parseBody(request: NextRequest) {
  const raw = await request.json().catch(() => null);
  return bodySchema.safeParse(raw);
}

export const POST = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const parsed = await parseBody(request);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    if (!auth.user.participantId) {
      return NextResponse.json(
        { error: "No participant record on caller" },
        { status: 400 }
      );
    }

    const { error } = await auth.supabase.from("task_dismissals").upsert(
      {
        participant_id: auth.user.participantId,
        task_key: parsed.data.task_key,
      },
      { onConflict: "participant_id,task_key", ignoreDuplicates: true }
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

export const DELETE = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const parsed = await parseBody(request);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    if (!auth.user.participantId) {
      return NextResponse.json(
        { error: "No participant record on caller" },
        { status: 400 }
      );
    }

    const { error } = await auth.supabase
      .from("task_dismissals")
      .delete()
      .eq("participant_id", auth.user.participantId)
      .eq("task_key", parsed.data.task_key);

    if (error) {
      return NextResponse.json(
        { error: "Failed to remove dismissal" },
        { status: 500 }
      );
    }
    return new NextResponse(null, { status: 204 });
  }
);
