import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { ambassadorApplicationSchema } from "@/lib/validations/ambassador";
import { AMBASSADOR_AGREEMENT_VERSION } from "@/lib/ambassador/content";
import { gradeQuiz, QUIZ_VERSION } from "@/lib/ambassador/quiz";
import { ambassadorStage, canSubmit, quizPassed, type AmbassadorApplication } from "@/lib/ambassador/status";
import {
  APPLICATION_SELECT,
  checkInvite,
  getAmbassadorSelf,
  grantAmbassadorRole,
  recordReview,
  resolveReferrer,
} from "@/lib/ambassador/data";
import { AMB_JOIN_COOKIE, parseAmbJoin } from "@/lib/ambassador/join-cookie";

/**
 * The ambassador apply flow (docs/ambassadors/CLAUDE.md) — one action per
 * screen, in the order the flow gives before it takes: oriented (the film or
 * the short read) → quiz (graded here) → agreement → submit.
 *
 * Submit from the open front door makes the application "pending": two
 * reviewers decide it (lib/ambassador/review.ts, 00105). A valid pre-approved
 * invite skips review — finishing the onboarding is what makes the invitee an
 * ambassador, and the invite is recorded as the inviter's approval.
 */
export const POST = withAuth(async (request: NextRequest, auth) => {
  const participantId = auth.user.participantId;
  if (!participantId) {
    return NextResponse.json({ error: "Finish creating your account first." }, { status: 403 });
  }
  const body = await parseBody(request, ambassadorApplicationSchema);
  if (isErrorResponse(body)) return body;

  const service = createServiceClient();
  const self = await getAmbassadorSelf(service, participantId);
  if (!self) return NextResponse.json({ error: "Participant not found." }, { status: 404 });
  if (self.role) {
    return NextResponse.json({ error: "You're already an ambassador." }, { status: 409 });
  }

  // Every action starts (or resumes) the one application row.
  let app = self.application;
  if (!app) {
    const { data, error } = await service
      .from("ambassador_applications")
      .upsert({ participant_id: participantId }, { onConflict: "participant_id", ignoreDuplicates: true })
      .select(APPLICATION_SELECT)
      .maybeSingle();
    if (error) return dbError(error, "ambassador-application-create");
    app = (data as AmbassadorApplication | null) ?? null;
    if (!app) {
      const { data: again } = await service
        .from("ambassador_applications")
        .select(APPLICATION_SELECT)
        .eq("participant_id", participantId)
        .single();
      app = again as AmbassadorApplication;
    }
  }

  const now = new Date().toISOString();
  const update = async (fields: Partial<AmbassadorApplication>) => {
    const { data, error } = await service
      .from("ambassador_applications")
      .update({ ...fields, updated_at: now })
      .eq("id", app!.id)
      .select(APPLICATION_SELECT)
      .single();
    return { data: data as AmbassadorApplication | null, error };
  };
  const reply = (a: AmbassadorApplication, extra: Record<string, unknown> = {}, hasRole = false) =>
    NextResponse.json({ application: a, stage: ambassadorStage(a, hasRole), ...extra });

  const editable = app.status === "started";

  switch (body.action) {
    case "oriented": {
      if (!editable || app.oriented_at) return reply(app);
      const { data, error } = await update({ oriented_at: now });
      if (error || !data) return dbError(error, "ambassador-oriented");
      return reply(data);
    }

    case "quiz": {
      const result = gradeQuiz(body.answers);
      if (!result) return NextResponse.json({ error: "Answer every question first." }, { status: 400 });
      if (!editable || !result.passed) return reply(app, { quiz: result });
      const { data, error } = await update({
        quiz_version: QUIZ_VERSION,
        quiz_score: result.score,
        quiz_total: result.total,
        quiz_passed_at: now,
        oriented_at: app.oriented_at ?? now,
      });
      if (error || !data) return dbError(error, "ambassador-quiz");
      return reply(data, { quiz: result });
    }

    case "agreement": {
      if (body.version !== AMBASSADOR_AGREEMENT_VERSION) {
        return NextResponse.json(
          { error: "The agreement was updated. Reload the page to read the current version." },
          { status: 409 }
        );
      }
      if (!quizPassed(app)) {
        return NextResponse.json({ error: "Pass the ten questions first." }, { status: 400 });
      }
      if (!editable) return reply(app);
      const { error: aErr } = await service.from("agreement_acceptances").insert({
        participant_id: participantId,
        doc: "ambassador",
        version: AMBASSADOR_AGREEMENT_VERSION,
        source: "ambassador_flow",
      });
      if (aErr && aErr.code !== "23505") return dbError(aErr, "ambassador-agreement-acceptance");
      const { data, error } = await update({
        agreement_version: AMBASSADOR_AGREEMENT_VERSION,
        agreement_accepted_at: now,
      });
      if (error || !data) return dbError(error, "ambassador-agreement");
      return reply(data);
    }

    case "submit": {
      if (app.status !== "started" && app.status !== "pending") return reply(app);
      if (!canSubmit(app)) {
        return NextResponse.json(
          { error: "Pass the ten questions and agree to the Ambassador Agreement first." },
          { status: 400 }
        );
      }

      // The invite and referrer come from the request, else from the front
      // door's cookie (set by /ambassador/start before sign-in).
      const parked = parseAmbJoin(request.cookies.get(AMB_JOIN_COOKIE)?.value);
      const token = body.invite_token || parked.invite || "";
      const checked = token
        ? await checkInvite(service, token, self.participant)
        : { invite: null, problem: null };
      let usable = checked.invite && !checked.problem ? checked.invite : null;
      let problem = checked.problem;

      // A pre-approved invite is single-use: claim it atomically, so two
      // people opening the same link can't both ride it. Losing the race
      // makes it an ordinary application (two reviews).
      if (usable && !usable.accepted_participant_id) {
        const { data: claimed } = await service
          .from("ambassador_invites")
          .update({ accepted_at: now, accepted_participant_id: participantId })
          .eq("id", usable.id)
          .is("accepted_participant_id", null)
          .select("id");
        if (!claimed || claimed.length === 0) {
          usable = null;
          problem = "used";
        }
      }

      const labId = app.lab_id ?? self.participant.metro_id ?? usable?.lab_id ?? null;
      const referrerId =
        app.referred_by_participant_id ?? (await resolveReferrer(service, body.ref || parked.ref, participantId));

      const fields: Partial<AmbassadorApplication> = {
        lab_id: labId,
        referred_by: body.referred_by || app.referred_by || usable?.inviter_name || null,
        referred_by_participant_id: referrerId,
        submitted_at: app.submitted_at ?? now,
      };

      // An open application waits for two reviews (00105). An invited one is
      // already approved by whoever invited them: finishing the onboarding
      // (canSubmit above) is all that's left, so it goes straight to
      // ambassador. The invite is kept as a review row for the record.
      if (usable) {
        fields.invite_id = app.invite_id ?? usable.id;
        fields.status = "approved";
        fields.decided_at = now;
        fields.decided_by = usable.invited_by;
        fields.decision_note = `Pre-approved invite #${usable.id}`;
        const { error: gErr } = await grantAmbassadorRole(
          service,
          participantId,
          labId,
          usable.invited_by,
          `Pre-approved invite #${usable.id}, application #${app.id}`
        );
        if (gErr) return dbError(gErr, "ambassador-invite-grant");
      } else if (app.status === "started") {
        fields.status = "pending";
      }

      const { data: submitted, error } = await update(fields);
      if (error || !submitted) return dbError(error, "ambassador-submit");

      if (usable?.invited_by && usable.invited_by !== participantId) {
        const { error: rErr, duplicate } = await recordReview(service, {
          applicationId: submitted.id,
          reviewerId: usable.invited_by,
          decision: "approve",
          note: `Pre-approved invite #${usable.id}`,
          source: "invite",
        });
        if (rErr && !duplicate) return dbError(rErr, "ambassador-invite-review");
      }
      const granted = submitted.status === "approved";
      const res = reply(submitted, { invite_problem: token ? problem : null }, granted);
      res.cookies.set(AMB_JOIN_COOKIE, "", { path: "/", maxAge: 0 });
      return res;
    }
  }
});
