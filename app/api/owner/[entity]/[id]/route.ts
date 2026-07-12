import { NextRequest, NextResponse } from "next/server";
import { withOwnerAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { dbError } from "@/lib/api/errors";
import { getLifecycleDescriptor } from "@/lib/owner/registry";
import type { LifecycleDescriptor, OwnerAction } from "@/lib/owner/types";
import { checkOwnerGuards } from "@/lib/owner/guards";
import { archiveParticipant, archiveCycle, archivePod } from "@/lib/owner/archive";
import { ownerActionSchema, ownerDeleteSchema } from "@/lib/validations/owner";

// Owner lifecycle management — the generalized, registry-driven surface.
//
//   DELETE /api/owner/{entity}/{id}          → hard delete (RPC; participants only)
//   POST   /api/owner/{entity}/{id} {action} → archive | reset
//
// The entity must be allowlisted in lib/owner/registry.ts (unknown → 404) and the
// verb must be supported by its descriptor (unsupported → 405). Phase 1 shipped
// `participants`; Phase 2 adds `cycles`, `pods`, `projects` (archive + reset only).
//
// CRITICAL: destructive RPCs (reset_*, delete_participant) are is_owner()-gated and
// is_owner() reads auth.uid(), so they are invoked through `auth.supabase` (the
// request's user client) — NEVER the service client. Reversible archive writes go
// through the service client, matching closeOutCycle.

type ArchiveHelper = (client: ReturnType<typeof createServiceClient>, id: number) => Promise<unknown>;
const ARCHIVE_HELPERS: Record<string, ArchiveHelper> = {
  archiveParticipant,
  archiveCycle,
  archivePod,
};

interface OwnerContext {
  descriptor: LifecycleDescriptor;
  targetId: number;
  label: string | null; // the entity's display label (email / name), may be null
  actorEmail: string | null;
}

/** Resolve + validate entity/id, load the target row and the acting owner's email. */
async function resolve(
  entity: string,
  idParam: string,
  auth: AuthenticatedRequest,
  service: ReturnType<typeof createServiceClient>
): Promise<OwnerContext | NextResponse> {
  const descriptor = getLifecycleDescriptor(entity);
  if (!descriptor) {
    return NextResponse.json({ error: "Unknown entity" }, { status: 404 });
  }
  const targetId = parseIntParam(idParam, "id");
  if (targetId instanceof NextResponse) return targetId;

  // The select list is built from the (allowlisted) descriptor, so Supabase's typed
  // query builder can't infer it — cast the row to a generic record.
  const targetPromise = service
    .from(descriptor.table)
    .select(`${descriptor.idColumn}, ${descriptor.labelField}`)
    .eq(descriptor.idColumn, targetId)
    .maybeSingle() as unknown as Promise<{ data: Record<string, unknown> | null }>;
  const actorPromise = auth.user.participantId != null
    ? service.from("participants").select("email").eq("id", auth.user.participantId).maybeSingle()
    : Promise.resolve({ data: null as { email: string | null } | null });
  const [{ data: target }, { data: actor }] = await Promise.all([targetPromise, actorPromise]);
  if (!target) {
    return NextResponse.json({ error: `${descriptor.label} not found` }, { status: 404 });
  }
  const label = (target[descriptor.labelField] as string | null) ?? null;
  return { descriptor, targetId, label, actorEmail: actor?.email ?? null };
}

/**
 * Confirmation policy. Destructive actions (reset, delete) require a non-empty
 * `confirm`, and — when the entity has a reliable label — an exact match. Archive
 * (reversible) only checks a supplied confirm. Returns an error message or null.
 */
function confirmProblem(action: OwnerAction, confirm: string | undefined, label: string | null): string | null {
  const destructive = action === "reset" || action === "delete";
  const typed = confirm != null && confirm.length > 0;
  if (destructive && !typed) return "Confirmation is required for this action.";
  if (typed && label != null && confirm !== label) return "Confirmation text does not match.";
  return null;
}

/** Run guards; run the RPC via the USER client (is_owner() reads auth.uid()). */
async function runRpc(
  auth: AuthenticatedRequest,
  fn: string,
  targetId: number,
  reason: string | undefined
): Promise<NextResponse | null> {
  const args: Record<string, unknown> = { target_id: targetId };
  if (reason) args.why = reason;
  const { error } = await auth.supabase.rpc(fn, args);
  if (error) return dbError(error, `owner-${fn}`);
  return null;
}

export const DELETE = withOwnerAuth(async (request: NextRequest, auth, params) => {
  const service = createServiceClient();
  const ctx = await resolve(params.entity, params.id, auth, service);
  if (ctx instanceof NextResponse) return ctx;

  if (!ctx.descriptor.delete) {
    return NextResponse.json({ error: "Delete is not supported for this entity." }, { status: 405 });
  }

  // Body optional on DELETE — reason/confirm may be absent.
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

  const badConfirm = confirmProblem("delete", parsed.data.confirm, ctx.label);
  if (badConfirm) return NextResponse.json({ error: badConfirm }, { status: 400 });

  const guard = await checkOwnerGuards(service, ctx.descriptor.guards, {
    actorParticipantId: auth.user.participantId,
    targetId: ctx.targetId,
  });
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const err = await runRpc(auth, ctx.descriptor.delete.fn, ctx.targetId, parsed.data.reason);
  if (err) return err;
  return NextResponse.json({ ok: true, deleted: true });
});

export const POST = withOwnerAuth(async (request: NextRequest, auth, params) => {
  const service = createServiceClient();
  const ctx = await resolve(params.entity, params.id, auth, service);
  if (ctx instanceof NextResponse) return ctx;

  const body = await parseBody(request, ownerActionSchema);
  if (isErrorResponse(body)) return body;

  const badConfirm = confirmProblem(body.action, body.confirm, ctx.label);
  if (badConfirm) return NextResponse.json({ error: badConfirm }, { status: 400 });

  const guard = await checkOwnerGuards(service, ctx.descriptor.guards, {
    actorParticipantId: auth.user.participantId,
    targetId: ctx.targetId,
  });
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { descriptor, targetId } = ctx;

  if (body.action === "archive") {
    if (!descriptor.archive) {
      return NextResponse.json({ error: "Archive is not supported for this entity." }, { status: 405 });
    }
    let detail: unknown;
    try {
      if (descriptor.archive.kind === "helper") {
        const helper = ARCHIVE_HELPERS[descriptor.archive.fn];
        if (!helper) return NextResponse.json({ error: "Archive is not available." }, { status: 500 });
        detail = await helper(service, targetId);
      } else if (descriptor.archive.kind === "status") {
        await service
          .from(descriptor.table)
          .update({ [descriptor.archive.column]: descriptor.archive.archivedValue })
          .eq(descriptor.idColumn, targetId);
        detail = { [descriptor.archive.column]: descriptor.archive.archivedValue };
      } else {
        const now = new Date().toISOString();
        await service
          .from(descriptor.table)
          .update({ [descriptor.archive.column]: now })
          .eq(descriptor.idColumn, targetId);
        detail = { [descriptor.archive.column]: now };
      }
    } catch (e) {
      return dbError(e, `owner-archive-${descriptor.key}`);
    }
    // Archive runs on the service client, so it records its own audit row (the
    // reset/delete RPCs write theirs in-transaction via auth.uid()).
    await service.from("owner_actions").insert({
      actor_participant_id: auth.user.participantId,
      actor_email: ctx.actorEmail,
      entity_type: descriptor.key,
      entity_id: String(targetId),
      entity_label: ctx.label,
      action: "archive",
      reason: body.reason ?? null,
      detail,
    });
    return NextResponse.json({ ok: true, action: "archive", detail });
  }

  // action === "reset"
  if (!descriptor.reset) {
    return NextResponse.json({ error: "Reset is not supported for this entity." }, { status: 405 });
  }
  const err = await runRpc(auth, descriptor.reset.fn, targetId, body.reason);
  if (err) return err;
  return NextResponse.json({ ok: true, action: "reset" });
});
