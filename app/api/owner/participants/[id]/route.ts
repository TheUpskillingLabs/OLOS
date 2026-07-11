import { NextRequest, NextResponse } from "next/server";
import { withOwnerAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { dbError } from "@/lib/api/errors";
import { getLifecycleDescriptor } from "@/lib/owner/registry";
import { checkParticipantGuards } from "@/lib/owner/guards";
import { archiveParticipant } from "@/lib/owner/archive";
import { ownerActionSchema, ownerDeleteSchema } from "@/lib/validations/owner";

// Owner lifecycle management — the participant (user-profile) slice (Phase 1).
//
//   DELETE  → hard erasure  (delete_participant RPC, 00058/00079)
//   POST    → { action: "archive" | "reset" }
//             archive → deactivate (archiveParticipant, service client)
//             reset   → wipe journey, keep identity (reset_participant RPC, 00079)
//
// CRITICAL: the destructive RPCs are is_owner()-gated and is_owner() reads
// auth.uid(), so they are invoked through `auth.supabase` (the request's
// user/cookie client) — NEVER the service-role client, which has no auth.uid()
// and would make is_owner() false (the RPC would RAISE) and null the audit actor.
// Reversible archive writes go through the service client, matching closeOutCycle.

const DESCRIPTOR = getLifecycleDescriptor("participants")!;

interface OwnerContext {
  target: { id: number; email: string | null };
  actorEmail: string | null;
}

/** Load the target profile + acting owner's email; 404 if the target is gone. */
async function loadContext(
  service: ReturnType<typeof createServiceClient>,
  auth: AuthenticatedRequest,
  targetId: number
): Promise<OwnerContext | NextResponse> {
  const [{ data: target }, { data: actor }] = await Promise.all([
    service.from("participants").select("id, email").eq("id", targetId).maybeSingle(),
    auth.user.participantId != null
      ? service.from("participants").select("email").eq("id", auth.user.participantId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!target) {
    return NextResponse.json({ error: "Participant not found" }, { status: 404 });
  }
  return { target, actorEmail: actor?.email ?? null };
}

/** If the owner typed a confirmation, it must match the profile's email. */
function confirmMismatch(confirm: string | undefined, email: string | null): boolean {
  return confirm != null && confirm.length > 0 && confirm !== email;
}

export const DELETE = withOwnerAuth(async (request: NextRequest, auth, params) => {
  const targetId = parseIntParam(params.id, "id");
  if (targetId instanceof NextResponse) return targetId;

  // Tolerate an absent body — reason/confirm are optional on a hard delete.
  let raw: unknown = {};
  try {
    raw = await request.json();
  } catch {
    raw = {};
  }
  const parsed = ownerDeleteSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }

  const service = createServiceClient();
  const ctx = await loadContext(service, auth, targetId);
  if (ctx instanceof NextResponse) return ctx;
  if (confirmMismatch(parsed.data.confirm, ctx.target.email)) {
    return NextResponse.json({ error: "Confirmation text does not match." }, { status: 400 });
  }

  const guard = await checkParticipantGuards(service, DESCRIPTOR.guards, {
    actorParticipantId: auth.user.participantId,
    targetId,
  });
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  // User client — see the CRITICAL note above.
  const rpcArgs: Record<string, unknown> = { target_id: targetId };
  if (parsed.data.reason) rpcArgs.why = parsed.data.reason;
  const { error } = await auth.supabase.rpc("delete_participant", rpcArgs);
  if (error) return dbError(error, "owner-delete-participant");

  return NextResponse.json({ ok: true, deleted: true });
});

export const POST = withOwnerAuth(async (request: NextRequest, auth, params) => {
  const targetId = parseIntParam(params.id, "id");
  if (targetId instanceof NextResponse) return targetId;

  const body = await parseBody(request, ownerActionSchema);
  if (isErrorResponse(body)) return body;

  const service = createServiceClient();
  const ctx = await loadContext(service, auth, targetId);
  if (ctx instanceof NextResponse) return ctx;
  if (confirmMismatch(body.confirm, ctx.target.email)) {
    return NextResponse.json({ error: "Confirmation text does not match." }, { status: 400 });
  }

  const guard = await checkParticipantGuards(service, DESCRIPTOR.guards, {
    actorParticipantId: auth.user.participantId,
    targetId,
  });
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  if (body.action === "archive") {
    if (!DESCRIPTOR.archive) {
      return NextResponse.json({ error: "Archive is not supported for this entity." }, { status: 405 });
    }
    let detail;
    try {
      detail = await archiveParticipant(service, targetId);
    } catch (err) {
      return dbError(err, "owner-archive-participant");
    }
    // Archive runs on the service client, so it records its own audit row here
    // (the reset/delete RPCs write theirs in-transaction via auth.uid()).
    await service.from("owner_actions").insert({
      actor_participant_id: auth.user.participantId,
      actor_email: ctx.actorEmail,
      entity_type: "participants",
      entity_id: String(targetId),
      entity_label: ctx.target.email,
      action: "archive",
      reason: body.reason ?? null,
      detail,
    });
    return NextResponse.json({ ok: true, action: "archive", detail });
  }

  // action === "reset" — user client, is_owner()-gated RPC.
  const rpcArgs: Record<string, unknown> = { target_id: targetId };
  if (body.reason) rpcArgs.why = body.reason;
  const { error } = await auth.supabase.rpc("reset_participant", rpcArgs);
  if (error) return dbError(error, "owner-reset-participant");

  return NextResponse.json({ ok: true, action: "reset" });
});
