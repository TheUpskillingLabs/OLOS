import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { dbError } from "@/lib/api/errors";
import { createServiceClient } from "@/lib/supabase/server";

// Set / clear the core-contributor flag (participants.is_staff, migration
// 00041 — the column keeps its historical name; the UI says "core
// contributor"). A visibility flag, never a permission: it hides the
// account from the community directory, follow suggestions, and public
// profiles, and excludes it from pod health math. Closes 00041's noted
// follow-up ("an admin UI control can follow") — until now the flag was
// settable only via SQL/entity explorer. Unlike testers there is no
// email-keyed side table: the flag does not need to survive a reset.

const staffFlagSchema = z.object({ participant_id: z.number().int() }).strict();

async function setFlag(request: NextRequest, isStaff: boolean) {
  const body = await parseBody(request, staffFlagSchema);
  if (isErrorResponse(body)) return body;

  const service = createServiceClient();
  const { data: participant } = await service
    .from("participants")
    .select("id")
    .eq("id", body.participant_id)
    .maybeSingle();
  if (!participant) {
    return NextResponse.json({ error: "Participant not found" }, { status: 404 });
  }

  const { error: flagError } = await service
    .from("participants")
    .update({ is_staff: isStaff })
    .eq("id", participant.id);
  if (flagError) return dbError(flagError, "staff-flag");

  return NextResponse.json({ core_contributor: isStaff });
}

export const POST = withAdminAuth(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (request: NextRequest, _auth: AuthenticatedRequest) => setFlag(request, true)
);

export const DELETE = withAdminAuth(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (request: NextRequest, _auth: AuthenticatedRequest) => setFlag(request, false)
);
