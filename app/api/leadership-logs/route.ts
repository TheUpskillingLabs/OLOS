import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { dbError } from "@/lib/api/errors";
import { requireCompleteProfile } from "@/lib/participants/placeholder";
import { leadershipLogSchema } from "@/lib/validations/leadership-logs";
import { leadershipScopesFor } from "@/lib/leadership-logs/scopes";

// The Leadership Log (docs/ORG_CYCLES.md §4a; migration 00069) — the lead
// tiers of the org weekly cascade. NON-BLOCKING: unlike the Learning Log there
// is no gate read/clear; the dashboard surfaces a due card and a reminder cron
// nudges. POST authorizes the submitted scope against the scopes the
// participant actually occupies (a co-led run pod, or a led lab) before
// inserting — you can only log for a tier/scope you hold.
export const POST = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const participantId = auth.user.participantId;
    if (!participantId) {
      return NextResponse.json({ error: "No participant record" }, { status: 403 });
    }

    const guard = await requireCompleteProfile(auth.supabase, participantId);
    if (guard) return guard;

    const body = await parseBody(request, leadershipLogSchema);
    if (isErrorResponse(body)) return body;

    // Authorize: the submitted (tier, cycle, pod|lab) must be a scope this
    // participant occupies right now.
    const scopes = await leadershipScopesFor(
      participantId,
      auth.user.labLeadLabIds ?? []
    );
    const match = scopes.find(
      (s) =>
        s.tier === body.tier &&
        s.cycleId === body.cycle_id &&
        (s.podId ?? null) === (body.pod_id ?? null) &&
        (s.labId ?? null) === (body.lab_id ?? null)
    );
    if (!match) {
      return NextResponse.json(
        { error: "You don't hold that leadership scope." },
        { status: 403 }
      );
    }

    const { data: log, error } = await auth.supabase
      .from("leadership_logs")
      .insert({
        participant_id: participantId,
        cycle_id: body.cycle_id,
        tier: body.tier,
        // Honor the one-scope CHECK regardless of stray body fields.
        pod_id: body.tier === "workstream_lead" ? body.pod_id : null,
        lab_id: body.tier === "lab_lead" ? body.lab_id : null,
        clarity: body.clarity,
        alignment: body.alignment,
        is_blocked: body.is_blocked,
        blocker_context: body.is_blocked
          ? body.blocker_context?.trim() || null
          : null,
        accomplished: body.accomplished?.trim() || null,
        exploring: body.exploring?.trim() || null,
        next_focus: body.next_focus?.trim() || null,
      })
      .select("id, created_at")
      .single();
    if (error || !log) return dbError(error, "leadership-log");

    return NextResponse.json({ saved: true }, { status: 201 });
  }
);

// The lead's own leadership logs — feeds the card's reviewable history.
export const GET = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest) => {
    const participantId = auth.user.participantId;
    if (!participantId) {
      return NextResponse.json({ logs: [], count: 0 });
    }
    const { data: logs, count } = await auth.supabase
      .from("leadership_logs")
      .select(
        "id, cycle_id, tier, pod_id, lab_id, clarity, alignment, is_blocked, accomplished, exploring, next_focus, created_at",
        { count: "exact" }
      )
      .eq("participant_id", participantId)
      .order("created_at", { ascending: false })
      .limit(50);
    return NextResponse.json({ logs: logs ?? [], count: count ?? 0 });
  }
);
