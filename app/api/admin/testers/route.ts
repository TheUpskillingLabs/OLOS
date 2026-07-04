import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { dbError } from "@/lib/api/errors";
import { createServiceClient } from "@/lib/supabase/server";

// Grant / revoke tester status (the testing pathway, migration 00042).
// The grant lives in two places on purpose: participants.is_test (what the
// UI reads today) and the email-keyed testers table (what survives a full
// reset, so the funnel can re-flag the account on re-registration).

const testerSchema = z.object({ participant_id: z.number().int() }).strict();

export const POST = withAdminAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const body = await parseBody(request, testerSchema);
    if (isErrorResponse(body)) return body;

    const service = createServiceClient();
    const { data: participant } = await service
      .from("participants")
      .select("id, email")
      .eq("id", body.participant_id)
      .maybeSingle();
    if (!participant) {
      return NextResponse.json({ error: "Participant not found" }, { status: 404 });
    }

    const { error: grantError } = await service.from("testers").upsert(
      {
        email: participant.email.toLowerCase(),
        granted_by: auth.user.participantId,
      },
      { onConflict: "email" }
    );
    if (grantError) return dbError(grantError, "tester-grant");

    const { error: flagError } = await service
      .from("participants")
      .update({ is_test: true })
      .eq("id", participant.id);
    if (flagError) return dbError(flagError, "tester-flag");

    return NextResponse.json({ tester: true, email: participant.email });
  }
);

export const DELETE = withAdminAuth(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (request: NextRequest, _auth: AuthenticatedRequest) => {
    const body = await parseBody(request, testerSchema);
    if (isErrorResponse(body)) return body;

    const service = createServiceClient();
    const { data: participant } = await service
      .from("participants")
      .select("id, email")
      .eq("id", body.participant_id)
      .maybeSingle();
    if (!participant) {
      return NextResponse.json({ error: "Participant not found" }, { status: 404 });
    }

    await service
      .from("testers")
      .delete()
      .eq("email", participant.email.toLowerCase());
    const { error: flagError } = await service
      .from("participants")
      .update({ is_test: false })
      .eq("id", participant.id);
    if (flagError) return dbError(flagError, "tester-unflag");

    return NextResponse.json({ tester: false, email: participant.email });
  }
);
