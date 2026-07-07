import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { parseIntParam } from "@/lib/api/params";
import { cycleAgreementSchema } from "@/lib/validations/cycle-agreement";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

// The Open Cycle Agreement signature (backend doc §2c) — the completion of
// the registration ceremony. Insert-only: signing records the agreement and
// ensures the status='inactive' interest enrollment exists (the same row
// /api/cycles/[cycle_id]/interest creates). It NEVER activates an
// enrollment — activation stays exclusively with
// reconcileEnrollmentActivation (§3.7), which can read this table as a
// precondition.
export const POST = withAuth(
  async (
    request: NextRequest,
    auth: AuthenticatedRequest,
    params: Record<string, string>
  ) => {
    const cycleId = parseIntParam(params.cycle_id, "cycle_id");
    if (cycleId instanceof NextResponse) return cycleId;

    const participantId = auth.user.participantId;
    if (!participantId) {
      return NextResponse.json(
        { error: "Not a registered participant", redirect: "/register" },
        { status: 403 }
      );
    }

    const supabase = createServiceClient();

    // Registration is open for the running cohort ('active') and the next one
    // ('upcoming') — the upcoming cohort pre-registers before kickoff. The
    // enrollment written below is 'inactive' either way; activation stays with
    // reconcileEnrollmentActivation (§3.7).
    const { data: cycle } = await supabase
      .from("cycles")
      .select("id, status")
      .eq("id", cycleId)
      .single();

    if (!cycle) {
      return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
    }
    if (cycle.status !== "active" && cycle.status !== "upcoming") {
      return NextResponse.json(
        { error: "This cycle is not currently accepting registrations" },
        { status: 400 }
      );
    }

    const body = await parseBody(request, cycleAgreementSchema);
    if (isErrorResponse(body)) return body;

    // Insert-only: a second signature attempt returns the existing row
    // rather than mutating it (the signature is a record, not a setting).
    const { data: existing } = await supabase
      .from("cycle_agreements")
      .select("id, agreement_version, signed_at")
      .eq("participant_id", participantId)
      .eq("cycle_id", cycleId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { agreement: existing, already_signed: true },
        { status: 200 }
      );
    }

    const { data: agreement, error: aError } = await supabase
      .from("cycle_agreements")
      .insert({
        participant_id: participantId,
        cycle_id: cycleId,
        agreement_version: body.agreement_version,
        signature_name: body.signature_name,
        answers: body.answers ?? null,
      })
      .select("id, agreement_version, signed_at")
      .single();

    if (aError) {
      return dbError(aError, "cycle-agreement");
    }

    // Ensure the interest enrollment exists (status='inactive' — the same
    // row the interest endpoint creates; never an activation).
    const { data: existingEnrollment } = await supabase
      .from("cycle_enrollments")
      .select("id")
      .eq("participant_id", participantId)
      .eq("cycle_id", cycleId)
      .maybeSingle();

    if (!existingEnrollment) {
      const { error: enError } = await supabase.from("cycle_enrollments").insert({
        participant_id: participantId,
        cycle_id: cycleId,
        status: "inactive",
      });
      if (enError) {
        return dbError(enError, "cycle-agreement-enrollment");
      }
    }

    return NextResponse.json({ agreement }, { status: 201 });
  }
);

// GET /api/cycles/[cycle_id]/agreement — the caller's own signature
// (surfaces on the profile's Build Cycle credential and the Poderator
// member drawer).
export const GET = withAuth(
  async (
    _request: NextRequest,
    auth: AuthenticatedRequest,
    params: Record<string, string>
  ) => {
    const cycleId = parseIntParam(params.cycle_id, "cycle_id");
    if (cycleId instanceof NextResponse) return cycleId;

    const participantId = auth.user.participantId;
    if (!participantId) {
      return NextResponse.json({ agreement: null }, { status: 200 });
    }

    const supabase = createServiceClient();
    const { data: agreement } = await supabase
      .from("cycle_agreements")
      .select("id, agreement_version, signature_name, signed_at")
      .eq("participant_id", participantId)
      .eq("cycle_id", cycleId)
      .maybeSingle();

    return NextResponse.json({ agreement }, { status: 200 });
  }
);
