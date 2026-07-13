import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { parseIntParam } from "@/lib/api/params";
import { cycleAgreementSchema } from "@/lib/validations/cycle-agreement";
import { requireActiveLabMembership } from "@/lib/labs/membership";
import { registrationWindow } from "@/lib/cycles/schedule";
import { fmtLabDateTime } from "@/lib/cycles/lab-time";
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

    // Active-lab gate (docs/LOCAL_LABS.md): signing the cycle agreement is
    // cycle registration — only members of an ACTIVE Local Lab may do it.
    const labGate = await requireActiveLabMembership(supabase, participantId);
    if (labGate) return labGate;

    // Registration is open for the running cohort ('active') and the next one
    // ('upcoming') — the upcoming cohort pre-registers before kickoff. The
    // enrollment written below is 'inactive' either way; activation stays with
    // reconcileEnrollmentActivation (§3.7).
    const { data: cycle } = await supabase
      .from("cycles")
      .select("id, status, lab_id")
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

    // Sub-cohort model (docs/LOCAL_LABS.md, 00067): the signable participant
    // cycle is the single HQ one (live open cycles are lab_id NULL by the
    // cycles_open_is_hq_when_live CHECK) — this server-side twin of the join
    // page's guard remains as defense-in-depth against direct POSTs at
    // residual/historical per-lab cycles. HQ cycles are never blocked, so a
    // mis-zipped member always has a path.
    if (cycle.lab_id !== null) {
      const { data: me } = await supabase
        .from("participants")
        .select("metro_id")
        .eq("id", participantId)
        .maybeSingle();
      if (me?.metro_id !== cycle.lab_id) {
        return NextResponse.json(
          { error: "This cycle belongs to a different local lab" },
          { status: 403 }
        );
      }
    }

    const body = await parseBody(request, cycleAgreementSchema);
    if (isErrorResponse(body)) return body;

    // Mirror the weekly-commitment pick (answers.hours) onto the member's
    // profile availability — one shared field with the profile (00082). Runs
    // on every submit, including a re-sign, so the profile reflects the latest
    // registration. availability is single-valued here: replace any prior pick.
    const hours = (body.answers as { hours?: string } | undefined)?.hours;
    if (hours) {
      const { data: availOpts } = await supabase
        .from("option_lists")
        .select("id, value")
        .eq("list_name", "availability")
        .eq("active", true);
      const chosen = (availOpts ?? []).find((o) => o.value === hours);
      if (chosen && availOpts && availOpts.length > 0) {
        await supabase
          .from("participant_options")
          .delete()
          .eq("participant_id", participantId)
          .in(
            "option_id",
            availOpts.map((o) => o.id)
          );
        await supabase
          .from("participant_options")
          .insert({ participant_id: participantId, option_id: chosen.id });
      }
    }

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

    // D-10 (pod-registration.md, owner 2026-07-12): self-serve cycle
    // registration is open through pod_forming close and again during
    // pod_active_join. New signatures outside those windows are refused;
    // already-signed members returned above are unaffected, and invite
    // fulfillment never calls this route.
    const regWindow = await registrationWindow(supabase, cycleId);
    if (!regWindow.open) {
      return NextResponse.json(
        {
          error:
            regWindow.state === "dead_zone" && regWindow.reopensAt
              ? `Cycle registration is paused until pods reopen on ${fmtLabDateTime(
                  regWindow.reopensAt.toISOString()
                )}.`
              : "Cycle registration has closed for this cycle.",
        },
        { status: 403 }
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
