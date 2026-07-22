import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { isEnrolledParticipant, isActiveParticipant } from "@/lib/auth/roles";
import { isCurrentlyRevoked } from "@/lib/enrollment/revocation";
import { checkWindow } from "@/lib/auth/windows";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { problemStatementSchema } from "@/lib/validations/votes";
import { requireCompleteProfile } from "@/lib/participants/placeholder";
import { rejectOrgCycle } from "@/lib/cycle/guards";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

export const POST = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const body = await parseBody(request, problemStatementSchema);
    if (isErrorResponse(body)) return body;
    const { cycle_id, statement_text, proposal_data } = body;
    const participant_id = auth.user.participantId;

    if (!participant_id) {
      return NextResponse.json({ error: "Not a registered participant" }, { status: 403 });
    }

    // Placeholder-named accounts must finish their profile before publishing
    // (vibe-scan PA1) — every other submission endpoint already guards this;
    // without it a statement renders as "Unknown Unknown" cycle-wide.
    const guard = await requireCompleteProfile(auth.supabase, participant_id);
    if (guard) return guard;

    const orgRejection = await rejectOrgCycle(
      auth.supabase,
      cycle_id,
      "Organization cycles don't collect problem statements — workstreams are chartered directly."
    );
    if (orgRejection) return orgRejection;

    // Check window
    const window = await checkWindow(auth.supabase, cycle_id, "problem_statement");
    if (!window.open) {
      return NextResponse.json({ error: window.message }, { status: 403 });
    }

    // Check enrollment. Enrolled-but-'inactive' is the normal state before
    // pod registration — enrollment status only flips to 'active' once the
    // participant joins an active pod (see isEnrolledParticipant docs), so
    // requiring 'active' here would deadlock every app-populated cycle.
    if (!isEnrolledParticipant(auth.user, cycle_id)) {
      return NextResponse.json({ error: "You must be enrolled in this cycle" }, { status: 403 });
    }

    // Revoked participants also sit at status 'inactive' (the revocation
    // flow never writes 'revoked'), so the enrollment check alone can't
    // tell them apart from the normal pre-pod state — consult the
    // access_revocations audit trail.
    if (
      !isActiveParticipant(auth.user, cycle_id) &&
      (await isCurrentlyRevoked(participant_id, cycle_id))
    ) {
      return NextResponse.json(
        { error: "Your access to this cycle has been revoked." },
        { status: 403 }
      );
    }

    // Snapshot the submitter's lab (docs/LOCAL_LABS.md) — per-lab voting and
    // formation read this, and the snapshot stays stable if the member later
    // changes labs. NULL = the grandfathered HQ bucket.
    const { data: me } = await auth.supabase
      .from("participants")
      .select("metro_id")
      .eq("id", participant_id)
      .maybeSingle();

    const row: Record<string, unknown> = {
      cycle_id,
      participant_id,
      statement_text,
      metro_id: me?.metro_id ?? null,
    };
    if (proposal_data) row.proposal_data = proposal_data;

    // Insert via the service client, like the agreement and votes writes:
    // participant_id comes from the authenticated session and the guard
    // chain above (window, enrollment, revocation) already enforces
    // everything the problem_statements_insert RLS policy checked. Going
    // through the user client left this as the one write path exposed to
    // current_participant_id() resolution, which rejects the insert in prod.
    const { data, error } = await createServiceClient()
      .from("problem_statements")
      .insert(row)
      .select("id, created_at")
      .single();

    if (error) {
      return dbError(error);
    }

    return NextResponse.json(data, { status: 201 });
  }
);
