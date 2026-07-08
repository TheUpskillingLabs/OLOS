import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { parseIntParam } from "@/lib/api/params";
import { cycleInterestSchema } from "@/lib/validations/cycle-interest";
import { requireActiveLabMembership } from "@/lib/labs/membership";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

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

    // Active-lab gate (docs/LOCAL_LABS.md): only a member of an ACTIVE Local
    // Lab can register for a cycle — waitlisted/lab-less members are held.
    const labGate = await requireActiveLabMembership(supabase, participantId);
    if (labGate) return labGate;

    // Open for the running cohort ('active') and the next one ('upcoming') —
    // the upcoming cohort collects interest pre-kickoff. The enrollment written
    // below stays 'inactive' until the reconciler activates it. Org cycles
    // (invite-only, docs/ORG_CYCLES.md) never accept self-serve interest.
    const { data: cycle } = await supabase
      .from("cycles")
      .select("id, status, mode")
      .eq("id", cycleId)
      .maybeSingle();

    if (!cycle) {
      return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
    }
    if (cycle.mode === "org") {
      return NextResponse.json(
        { error: "Organization cycles are invite-only." },
        { status: 403 }
      );
    }
    if (cycle.status !== "active" && cycle.status !== "upcoming") {
      return NextResponse.json(
        { error: "This cycle is not currently accepting interest" },
        { status: 400 }
      );
    }

    const body = await parseBody(request, cycleInterestSchema);
    if (isErrorResponse(body)) return body;

    const {
      availability,
      group_strengths,
      availability_commitment,
      ...profileFields
    } = body;

    // Upsert long-form fields onto participant row
    const { error: updateError } = await supabase
      .from("participants")
      .update(profileFields)
      .eq("id", participantId);

    if (updateError) {
      return dbError(updateError, "cycle-interest-profile");
    }

    // Upsert participant_options: delete old + insert new
    const multiSelectArrays = {
      availability,
      group_strengths,
    };

    const allOptionIds: number[] = [];
    for (const arr of Object.values(multiSelectArrays)) {
      if (arr) allOptionIds.push(...arr);
    }

    // Delete existing options for this participant then re-insert
    await supabase
      .from("participant_options")
      .delete()
      .eq("participant_id", participantId);

    if (allOptionIds.length > 0) {
      const rows = allOptionIds.map((option_id: number) => ({
        participant_id: participantId,
        option_id,
      }));
      const { error: optError } = await supabase
        .from("participant_options")
        .insert(rows);

      if (optError) {
        return dbError(optError, "cycle-interest-options");
      }
    }

    // Upsert cycle_enrollments with status='inactive'
    const { data: existingEnrollment } = await supabase
      .from("cycle_enrollments")
      .select("id")
      .eq("participant_id", participantId)
      .eq("cycle_id", cycleId)
      .maybeSingle();

    let enrollmentId: number;

    if (existingEnrollment) {
      enrollmentId = existingEnrollment.id;
    } else {
      const { data: enrollment, error: enError } = await supabase
        .from("cycle_enrollments")
        .insert({
          participant_id: participantId,
          cycle_id: cycleId,
          status: "inactive",
        })
        .select("id")
        .single();

      if (enError) {
        return dbError(enError, "cycle-interest-enrollment");
      }
      enrollmentId = enrollment.id;
    }

    return NextResponse.json({ enrollment_id: enrollmentId }, { status: 200 });
  }
);
