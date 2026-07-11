import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Lab-lead roster for one local lab (docs/LOCAL_LABS.md). HQ owns lead
 * appointment — both verbs are withAdminAuth; lab leads themselves cannot
 * appoint peers. Removal is DELETE .../leads/[participant_id] (stamps
 * removed_at; the partial unique index allows a later re-grant).
 */

const assignLeadSchema = z.object({
  participant_id: z.number().int().positive(),
});

export const GET = withAdminAuth(
  async (_request: NextRequest, _auth: AuthenticatedRequest, params: Record<string, string>) => {
    const labId = parseIntParam(params.lab_id, "lab_id");
    if (labId instanceof NextResponse) return labId;

    const serviceClient = createServiceClient();
    const { data, error } = await serviceClient
      .from("lab_leads")
      .select(
        "participant_id, assigned_at, participants!lab_leads_participant_id_fkey(first_name, last_name, preferred_name, email)"
      )
      .eq("lab_id", labId)
      .is("removed_at", null)
      .order("assigned_at");
    if (error) return dbError(error);
    return NextResponse.json(data ?? []);
  }
);

export const POST = withAdminAuth(
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const labId = parseIntParam(params.lab_id, "lab_id");
    if (labId instanceof NextResponse) return labId;

    const body = await parseBody(request, assignLeadSchema);
    if (isErrorResponse(body)) return body;

    const serviceClient = createServiceClient();

    const [{ data: metro }, { data: participant }] = await Promise.all([
      serviceClient.from("metros").select("id").eq("id", labId).maybeSingle(),
      serviceClient
        .from("participants")
        .select("id")
        .eq("id", body.participant_id)
        .maybeSingle(),
    ]);
    if (!metro) {
      return NextResponse.json({ error: "Lab not found" }, { status: 404 });
    }
    if (!participant) {
      return NextResponse.json({ error: "Participant not found" }, { status: 404 });
    }

    // Already an active lead? Idempotent success rather than a raw
    // unique-violation from one_active_lab_lead.
    const { data: existing } = await serviceClient
      .from("lab_leads")
      .select("id")
      .eq("participant_id", body.participant_id)
      .eq("lab_id", labId)
      .is("removed_at", null)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ id: existing.id, already_lead: true });
    }

    const { data, error } = await serviceClient
      .from("lab_leads")
      .insert({
        participant_id: body.participant_id,
        lab_id: labId,
        assigned_by: auth.user.participantId,
      })
      .select("id, participant_id, lab_id, assigned_at")
      .single();
    if (error) return dbError(error);
    return NextResponse.json(data, { status: 201 });
  }
);
