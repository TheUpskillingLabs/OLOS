import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import {
  STEPS,
  fill,
  invite,
  program,
  stepHref,
  ui,
  AMBASSADOR_APPLY,
  AMBASSADOR_COORDINATOR,
  AMBASSADOR_NOMINATE,
  AMBASSADOR_PRESENT,
  AMBASSADOR_START,
} from "@/lib/ambassador/content";
import { loadAmbassadorPage } from "@/lib/ambassador/page";
import { guidePrimary } from "@/lib/ambassador/status";
import { referralCount } from "@/lib/ambassador/data";
import ReadyButton from "./ready-button";
import ShareLink from "./share-link";

/* The ambassador's home — the prototype's guide Home and dashboard, by stage:
     none / applying — what the role is, and the way in (or back in);
     pending        — "Almost there", and the guide to read meanwhile;
     declined       — the coordinator's note, and how to talk to them;
     ambassador     — welcome, the one button (Start → Continue → "Tell your
                      coordinator you're ready"), the five steps, the deck,
                      and Bring someone in.
   Coordinators (Lab leads, admins) also get their link to the queue. */

export const dynamic = "force-dynamic";
export const metadata = { title: "Ambassador · The Upskilling Labs" };

export default async function AmbassadorHome() {
  const { self, stage, progress, coordinator, firstName } = await loadAmbassadorPage();
  const app = self.application;
  const isAmbassador = stage === "ambassador";
  const primary = isAmbassador ? guidePrimary(progress, app?.ready_at ?? null) : null;
  const referrals = isAmbassador ? await referralCount(createServiceClient(), self.participant.id) : 0;
  const shareBase = process.env.NEXT_PUBLIC_APP_URL || "https://theupskillinglabs.org";

  return (
    <div className="amb">
      {coordinator && (
        <p className="t-small" style={{ marginBottom: 16 }}>
          <Link className="amb-linkbtn" href={AMBASSADOR_COORDINATOR}>Coordinator: ambassadors in your Lab →</Link>
        </p>
      )}

      <header className="amb-head">
        <p className="lbl lbl-teal">{program.role}</p>
        <h1 className="t-h1 text-ink" style={{ marginTop: 6 }}>
          {isAmbassador ? (progress.complete ? ui.home.doneTitle : ui.home.title) : program.hero.title[0]}
        </h1>
        {isAmbassador && <p className="t-lede">{fill(ui.home.welcome, { first: firstName })} {ui.home.member}</p>}
        {!isAmbassador && <p className="t-lede">{program.intro.lede}</p>}
      </header>

      {stage === "stepped_back" && (
        <div className="amb-panel">
          <h2 className="t-h3">You&apos;ve stepped back.</h2>
          <p className="t-body">You can come back any time. Tell your Lab&apos;s coordinator and they&apos;ll reopen your place.</p>
        </div>
      )}

      {(stage === "none" || stage === "applying") && (
        <div className="amb-panel">
          <h2 className="t-h3">{ui.home.nudgeTitle}</h2>
          <p className="t-body">{ui.home.nudge}</p>
          <div className="amb-row-actions">
            <Link className="btn btn-teal" href={AMBASSADOR_APPLY}>
              {stage === "applying" ? ui.home.applyContinue : ui.home.apply} →
            </Link>
          </div>
        </div>
      )}

      {stage === "pending" && (
        <div className="amb-panel">
          <h2 className="t-h3">Almost there.</h2>
          <p className="t-body">{ui.home.pending}</p>
        </div>
      )}

      {stage === "declined" && (
        <div className="amb-panel">
          <h2 className="t-h3">Not this time.</h2>
          <p className="t-body">
            Your coordinator didn&apos;t confirm you as an ambassador this round.
            {app?.decision_note ? ` Their note: “${app.decision_note}”` : ""} You&apos;re still a full member of The Labs, and the guide stays open to you.
          </p>
        </div>
      )}

      <section style={{ marginTop: 28 }}>
        <p className="amb-goal">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ambassador/button-400.webp" alt="" width={48} height={48} />
          <span>{progress.complete ? ui.home.doneGoal : ui.home.goal}</span>
        </p>

        {primary?.href && (
          <Link className="btn btn-teal btn-block btn-lg" href={primary.href}>{primary.label} →</Link>
        )}
        {primary?.action === "ready" && <ReadyButton label={primary.label} />}
        {isAmbassador && app?.ready_at && !app.button_given_at && (
          <p className="amb-ok">Your coordinator knows you&apos;re ready. They&apos;ll hand you your button in person.</p>
        )}
        {!isAmbassador && progress.next && (
          <Link className="btn btn-ghost btn-block" href={progress.next.href}>
            {progress.count === 0 ? ui.home.start : fill(ui.home.continue, { title: progress.next.title })} →
          </Link>
        )}

        <ol className="amb-steps" style={{ marginTop: 18 }} aria-label={fill(ui.nav.progress, { n: progress.count, total: progress.total })}>
          {STEPS.map((s, i) => {
            const done = progress.done.includes(s.id);
            return (
              <li key={s.id}>
                <Link href={stepHref(s.id)} className={`amb-step${done ? " is-done" : ""}`}>
                  <span className="amb-step-n">{done ? "✓" : i + 1}</span>
                  <span className="amb-step-t">
                    <b>{s.title}</b>
                    <span>{s.readTime} min</span>
                  </span>
                  <span aria-hidden>›</span>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="amb-panel" style={{ marginTop: 28 }}>
        <h2 className="t-h3">{ui.nav.present}</h2>
        <div className="amb-row-actions" style={{ marginTop: 8 }}>
          <Link className="btn btn-ghost" href={AMBASSADOR_PRESENT}>{ui.step.present}</Link>
          <Link className="btn btn-ghost" href={`${AMBASSADOR_PRESENT}?short`}>{ui.step.short}</Link>
          <Link className="amb-linkbtn" href={`${AMBASSADOR_PRESENT}?notes`}>Notes view</Link>
        </div>
      </section>

      {isAmbassador && (
        <section className="amb-panel" style={{ marginTop: 14 }}>
          <h2 className="t-h3">{invite.bring.title}</h2>
          <p className="amb-note">{invite.bring.shareHint}</p>
          {referrals > 0 && (
            <p className="amb-ok">
              {referrals === 1 ? "One new ambassador came in through you." : `${referrals} new ambassadors came in through you.`}
            </p>
          )}
          <div className="amb-row-actions">
            <ShareLink
              label={invite.bring.shareLabel}
              copied={invite.bring.copied}
              url={self.participant.handle ? `${shareBase}${AMBASSADOR_START}?ref=${self.participant.handle}` : `${shareBase}${AMBASSADOR_START}`}
            />
            <Link className="amb-linkbtn" href={AMBASSADOR_NOMINATE}>{invite.bring.nominate} →</Link>
          </div>
        </section>
      )}
    </div>
  );
}
