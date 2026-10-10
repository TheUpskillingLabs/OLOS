import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdmin, isLabLead, resolveUserRoles } from "@/lib/auth/roles";
import { APPLICATION_SELECT, INVITE_SELECT, isCoordinator, reviewsFor, type AmbassadorInvite } from "@/lib/ambassador/data";
import { applicantRecord } from "@/lib/ambassador/record";
import {
  activeReviews,
  canSeeOtherReviews,
  outcomeLabel,
  reviewBlock,
  reviewOutcome,
  REVIEW_BLOCK_MESSAGE,
  REVIEWS_REQUIRED,
} from "@/lib/ambassador/review";
import { AMBASSADOR_AGREEMENT_VERSION, AMBASSADOR_COORDINATOR, AMBASSADOR_HOME } from "@/lib/ambassador/content";
import type { AmbassadorApplication } from "@/lib/ambassador/status";
import { formatDate } from "@/lib/format/date";
import { ReviewForm } from "./review-form";

/* One ambassador application, as its reviewers see it: the application (the
   quiz result, the agreement, who brought them in) beside the applicant's
   OLOS record (lib/ambassador/record.ts), and the review form. Two reviewers
   decide (lib/ambassador/review.ts); the other reviews stay hidden until you
   record yours, so each decision is your own.

   Gate: the REAL signed-in user, an admin or a lead of the application's Lab
   (HQ applications: admins only) — the same scope as the review route. */

export const dynamic = "force-dynamic";
export const metadata = { title: "Review · Ambassadors · The Upskilling Labs" };

const STATUS_LABEL: Record<AmbassadorApplication["status"], string> = {
  started: "Still applying",
  pending: "Waiting for reviews",
  approved: "Ambassador",
  declined: "Not now",
  stepped_back: "Stepped back",
};

export default async function ReviewApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const service = createServiceClient();
  const roles = await resolveUserRoles(service, user.id);
  if (!isCoordinator(roles)) redirect(AMBASSADOR_HOME);

  const { data } = await service.from("ambassador_applications").select(APPLICATION_SELECT).eq("id", id).maybeSingle();
  const app = data as AmbassadorApplication | null;
  if (!app) notFound();
  const admin = isAdmin(roles);
  if (!admin && (app.lab_id === null || !isLabLead(roles, app.lab_id))) redirect(AMBASSADOR_COORDINATOR);

  const [record, allReviews, inviteRes, referrerRes] = await Promise.all([
    applicantRecord(service, app.participant_id),
    reviewsFor(service, [app.id]),
    app.invite_id
      ? service.from("ambassador_invites").select(INVITE_SELECT).eq("id", app.invite_id).maybeSingle()
      : Promise.resolve({ data: null }),
    app.referred_by_participant_id
      ? service.from("participants").select("first_name, last_name, preferred_name").eq("id", app.referred_by_participant_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!record) notFound();

  const reviews = activeReviews(allReviews);
  const outcome = reviewOutcome(reviews);
  const who = { reviewerId: roles.participantId, reviewerIsAdmin: admin };
  const block = reviewBlock(app, reviews, who);
  const showOthers = canSeeOtherReviews(app, reviews, who);
  const reviewerIds = [...new Set(allReviews.map((r) => r.reviewer_id).filter((x): x is number => x != null))];
  const { data: reviewerRows } = reviewerIds.length
    ? await service.from("participants").select("id, first_name, last_name, preferred_name").in("id", reviewerIds)
    : { data: [] };
  const reviewerName = new Map(
    ((reviewerRows ?? []) as { id: number; first_name: string; last_name: string; preferred_name: string | null }[]).map((r) => [
      r.id,
      `${r.preferred_name || r.first_name} ${r.last_name}`.trim(),
    ])
  );
  const invite = inviteRes.data as AmbassadorInvite | null;
  const referrer = referrerRes.data as { first_name: string; last_name: string; preferred_name: string | null } | null;
  const p = record.profile;

  return (
    <div className="amb-wide">
      <Link className="amb-back" href={AMBASSADOR_COORDINATOR}>← All ambassadors</Link>
      <header className="amb-head">
        <p className="lbl lbl-teal">Ambassador application</p>
        <h1 className="t-h1 text-ink" style={{ marginTop: 6 }}>{p.name}</h1>
        <p className="t-lede">
          {STATUS_LABEL[app.status]}
          {app.status === "pending" ? ` · ${outcomeLabel(outcome)}` : ""}
          {p.lab ? ` · ${p.lab}` : " · HQ"}
        </p>
      </header>

      <div className="amb-review-grid">
        <section className="amb-panel" aria-labelledby="rv-app">
          <h2 id="rv-app" className="t-h3">The application</h2>
          <dl className="amb-facts">
            <dt>Quiz</dt>
            <dd>
              {app.quiz_passed_at
                ? `${app.quiz_score} of ${app.quiz_total}, passed ${formatDate(app.quiz_passed_at)}`
                : "Not passed yet"}
              {app.quiz_version ? <span className="t-small"> ({app.quiz_version})</span> : null}
            </dd>
            <dt>Agreement</dt>
            <dd>
              {app.agreement_accepted_at
                ? `Signed ${formatDate(app.agreement_accepted_at)}`
                : "Not signed"}
              {app.agreement_version && (
                <span className="t-small">
                  {" "}({app.agreement_version}
                  {app.agreement_version !== AMBASSADOR_AGREEMENT_VERSION ? ", an older version" : ""})
                </span>
              )}
            </dd>
            <dt>Watched or read the intro</dt>
            <dd>{app.oriented_at ? formatDate(app.oriented_at) : "No"}</dd>
            <dt>Brought in by</dt>
            <dd>
              {referrer ? `${referrer.preferred_name || referrer.first_name} ${referrer.last_name} (share link)` : app.referred_by ?? "Nobody named"}
            </dd>
            <dt>Invite</dt>
            <dd>{invite ? `From ${invite.inviter_name}, made ${formatDate(invite.created_at)}` : "None"}</dd>
            <dt>Submitted</dt>
            <dd>{app.submitted_at ? formatDate(app.submitted_at) : "Not yet"}</dd>
          </dl>
          <p className="amb-note">
            The quiz is graded on the server and only the score is kept, not each answer.
          </p>
        </section>

        <section className="amb-panel" aria-labelledby="rv-record">
          <h2 id="rv-record" className="t-h3">Their OLOS record</h2>
          <dl className="amb-facts">
            <dt>Profile</dt>
            <dd>
              {p.handle ? <Link href={`/u/${p.handle}`}>@{p.handle}</Link> : "No public profile"}
              {p.headline && <><br />{p.headline}</>}
            </dd>
            {p.bio && (<><dt>About</dt><dd>{p.bio}</dd></>)}
            <dt>Email</dt>
            <dd>{p.email}</dd>
            <dt>Lab</dt>
            <dd>{p.lab ?? "None yet"}{p.zip ? ` · ZIP ${p.zip}` : ""}</dd>
            <dt>Member since</dt>
            <dd>{p.joined ? formatDate(p.joined) : "—"}</dd>
            <dt>Situation</dt>
            <dd>{p.work_situation ?? "—"}</dd>
            <dt>Wanted to take part by</dt>
            <dd>{p.role_intents.length ? p.role_intents.join(", ") : "—"}</dd>
            <dt>Roles</dt>
            <dd>{record.roles.length ? record.roles.join(", ") : "Member"}</dd>
            <dt>Cycles</dt>
            <dd>{record.cycles.length ? record.cycles.map((c) => `${c.name} (${c.status})`).join(", ") : "None yet"}</dd>
            <dt>Pods</dt>
            <dd>{record.pods.length ? record.pods.map((x) => x.name).join(", ") : "None"}</dd>
            <dt>Projects</dt>
            <dd>{record.projects.length ? record.projects.map((x) => (x.role ? `${x.name} (${x.role})` : x.name)).join(", ") : "None"}</dd>
            <dt>Events</dt>
            <dd>
              {record.events.count === 0
                ? "No RSVPs yet"
                : `${record.events.count} RSVP${record.events.count === 1 ? "" : "s"}. Latest: ${record.events.recent
                    .map((e) => (e.start_at ? `${e.name} (${formatDate(e.start_at)})` : e.name))
                    .join(", ")}`}
            </dd>
            <dt>Agreements</dt>
            <dd>{record.agreements.length ? record.agreements.map((a) => `${a.doc} ${a.version}`).join(", ") : "None on file"}</dd>
          </dl>
          <p className="amb-note">Learning Logs and check-ins stay private and aren&apos;t shown here.</p>
        </section>
      </div>

      <section className="amb-section" aria-labelledby="rv-reviews">
        <h2 id="rv-reviews" className="t-h2">Reviews</h2>
        <p className="t-small">
          Two reviewers decide. Two approvals make them an ambassador; two declines mean not this time; a split
          goes to an admin, whose review decides. Notes are for reviewers only, never the applicant.
        </p>

        {showOthers ? (
          reviews.length === 0 ? (
            <p className="amb-empty">No reviews yet.</p>
          ) : (
            <ul className="amb-reviews">
              {reviews.map((r) => (
                <li key={r.id}>
                  <b>{r.reviewer_id ? reviewerName.get(r.reviewer_id) ?? "A reviewer" : "A former reviewer"}</b>{" "}
                  {r.decision === "approve" ? "approved" : "declined"}
                  {r.source === "invite" ? " (approved their invite)" : ""} · {formatDate(r.created_at)}
                  {r.note && r.source === "review" && <p className="t-small">“{r.note}”</p>}
                </li>
              ))}
            </ul>
          )
        ) : (
          <p className="amb-empty">
            {reviews.length} of {REVIEWS_REQUIRED} reviews in. The others show once you&apos;ve recorded yours.
          </p>
        )}

        {app.status === "pending" &&
          (block ? (
            <p className="amb-note" style={{ marginTop: 16 }}>{REVIEW_BLOCK_MESSAGE[block]}</p>
          ) : (
            <ReviewForm id={app.id} tiebreak={outcome.state === "split"} />
          ))}
      </section>
    </div>
  );
}
