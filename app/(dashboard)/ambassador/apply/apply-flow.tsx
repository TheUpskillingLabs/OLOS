"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apply, fill, ui, coordinatorContact, AMBASSADOR_AGREEMENT_VERSION, AMBASSADOR_HOME, STEPS, stepHref } from "@/lib/ambassador/content";
import { askMessage, smsHref } from "@/lib/ambassador/ask";
import type { AmbassadorSession } from "@/lib/ambassador/session";
import type { ApplyStage } from "@/lib/ambassador/status";
import type { InviteProblem } from "@/lib/ambassador/data";
import type { QuizResult } from "@/lib/ambassador/quiz";
import { askStore, profileStore, shareText } from "@/app/components/ambassador/local-store";

export interface ApplyInvite {
  token: string;
  by: string | null;
  note: string | null;
  /** A second coordinator has approved the invite (00106). */
  approved: boolean;
  problem: InviteProblem | null;
}

type Outcome = "in" | "pending" | null;
const SCREENS: ApplyStage[] = ["video", "quiz", "agreement", "details", "done"];
const NAV = [apply.video.nav, apply.quiz.nav, apply.agreement.nav, apply.you.nav];

async function post(body: unknown): Promise<{ ok: boolean; json: Record<string, unknown> | null }> {
  const res = await fetch("/api/ambassadors/application", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  const json = res ? ((await res.json().catch(() => null)) as Record<string, unknown> | null) : null;
  return { ok: Boolean(res?.ok), json };
}

export default function ApplyFlow({
  initialStage,
  initialOutcome,
  quiz,
  me,
  referredBy: initialReferredBy,
  invite,
  refHandle,
  session,
}: {
  initialStage: ApplyStage;
  initialOutcome: Outcome;
  quiz: { pass: number; questions: { q: string; options: string[]; hint: string }[] };
  me: { first: string; last: string; email: string; zip: string };
  referredBy: string;
  invite: ApplyInvite | null;
  refHandle: string | null;
  session: AmbassadorSession | null;
}) {
  const router = useRouter();
  const [screen, setScreen] = useState<ApplyStage>(initialStage);
  const [outcome, setOutcome] = useState<Outcome>(initialOutcome);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>(() => quiz.questions.map(() => null));
  const [result, setResult] = useState<QuizResult | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [referredBy, setReferredBy] = useState(initialReferredBy || invite?.by || "");
  const [inviteProblem, setInviteProblem] = useState<InviteProblem | null>(invite?.problem ?? null);
  const heading = useRef<HTMLHeadingElement>(null);

  // Move focus to each new screen's title (the prototype did the same).
  useEffect(() => {
    heading.current?.focus();
  }, [screen]);

  const go = (s: ApplyStage) => {
    setError(null);
    setScreen(s);
    window.scrollTo({ top: 0 });
  };

  const run = async (body: unknown, onOk: (json: Record<string, unknown>) => void) => {
    setBusy(true);
    setError(null);
    const { ok, json } = await post(body);
    setBusy(false);
    if (!ok || !json) {
      setError((json?.error as string) ?? "Something went wrong. Try again.");
      return;
    }
    onOk(json);
  };

  const submit = () =>
    run(
      { action: "submit", referred_by: referredBy.trim() || undefined, invite_token: invite?.token, ref: refHandle ?? undefined },
      (json) => {
        setOutcome(json.stage === "ambassador" ? "in" : "pending");
        setInviteProblem((json.invite_problem as InviteProblem | null) ?? null);
        go("done");
        router.refresh();
      }
    );

  const step = SCREENS.indexOf(screen);
  const invitedBanner = invite && !inviteProblem && invite.by && outcome !== "in";

  return (
    <div className="amb">
      {screen !== "done" && (
        <>
          <p className="lbl lbl-teal">{fill(apply.stepOf, { n: step + 1, total: NAV.length })}</p>
          <div className="amb-progress" aria-hidden>
            {NAV.map((n, i) => (
              <span key={n} className={i <= step ? "on" : ""} />
            ))}
          </div>
        </>
      )}

      {invitedBanner && (
        <div className="amb-panel" style={{ marginBottom: 20 }}>
          <p className="t-body"><b>{fill(invite.approved ? apply.invited.banner : apply.invited.bannerPending, { by: invite.by! })}</b></p>
          {invite.note && <p className="amb-note">{fill(apply.invited.note, { by: invite.by! })} “{invite.note}”</p>}
        </div>
      )}
      {invite && inviteProblem && screen !== "done" && (
        <div className="amb-panel" style={{ marginBottom: 20 }}>
          <p className="amb-note">{apply.invalidInvite[inviteProblem]}</p>
        </div>
      )}

      {screen === "video" && (
        <section aria-labelledby="ap-video">
          <h1 id="ap-video" ref={heading} tabIndex={-1} className="t-h1 text-ink">{apply.video.title}</h1>
          <p className="t-lede" style={{ marginTop: 8 }}>{apply.video.lede}</p>
          <div style={{ marginTop: 20 }}>
            {apply.video.src ? (
              <video className="amb-video" controls playsInline preload="metadata" poster={apply.video.poster || undefined}>
                <source src={apply.video.src} />
                {apply.video.captions && <track kind="captions" src={apply.video.captions} srcLang="en" label="English" default />}
              </video>
            ) : (
              <p className="amb-placeholder">{apply.video.placeholder}</p>
            )}
          </div>
          <div className="amb-panel amb-read" style={{ marginTop: 20 }}>
            <h2 className="t-h3">{apply.video.readTitle}</h2>
            {apply.video.read.map((p) => (
              <p key={p} className="t-body">{p}</p>
            ))}
          </div>
          <div className="amb-row-actions" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-teal" disabled={busy} onClick={() => run({ action: "oriented" }, () => go("quiz"))}>
              {apply.video.watched} →
            </button>
          </div>
        </section>
      )}

      {screen === "quiz" && (
        <section aria-labelledby="ap-quiz">
          <h1 id="ap-quiz" ref={heading} tabIndex={-1} className="t-h1 text-ink">{apply.quiz.title}</h1>
          <p className="t-lede" style={{ marginTop: 8 }}>{apply.quiz.lede}</p>
          <form
            style={{ marginTop: 22 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (answers.some((a) => a === null)) {
                setError(apply.quiz.unanswered);
                return;
              }
              run({ action: "quiz", answers }, (json) => setResult(json.quiz as QuizResult));
            }}
          >
            <ol className="amb-quiz">
              {quiz.questions.map((q, i) => {
                const r = result?.results[i];
                return (
                  <li key={q.q}>
                    <fieldset>
                      <legend>{i + 1}. {q.q}</legend>
                      {q.options.map((o, k) => (
                        <label key={o}>
                          <input
                            type="radio"
                            name={`q${i}`}
                            value={k}
                            checked={answers[i] === k}
                            disabled={Boolean(result?.passed)}
                            onChange={() => {
                              setAnswers((a) => a.map((x, j) => (j === i ? k : x)));
                              if (result && !result.passed) setResult(null);
                            }}
                          />
                          <span>{o}</span>
                        </label>
                      ))}
                      {r && (
                        <p className={`amb-quiz-note ${r.right ? "is-right" : "is-wrong"}`}>
                          <b>{r.right ? apply.quiz.right : apply.quiz.wrong}</b> {r.note}
                        </p>
                      )}
                    </fieldset>
                  </li>
                );
              })}
            </ol>
            <div role="status" aria-live="polite" style={{ marginTop: 18 }}>
              {result && (
                <p className="t-body">
                  <b>{fill(apply.quiz.result, { score: result.score, total: result.total })}</b>{" "}
                  {result.passed ? apply.quiz.passed : apply.quiz.failed}
                </p>
              )}
            </div>
            <div className="amb-row-actions" style={{ justifyContent: "space-between" }}>
              <button type="button" className="btn btn-ghost" onClick={() => go("video")}>{apply.back}</button>
              {result?.passed ? (
                <button type="button" className="btn btn-teal" onClick={() => go("agreement")}>{apply.next} →</button>
              ) : (
                <button type="submit" className="btn btn-teal" disabled={busy}>
                  {result ? apply.quiz.retry : apply.quiz.check}
                </button>
              )}
            </div>
          </form>
        </section>
      )}

      {screen === "agreement" && (
        <section aria-labelledby="ap-agreement">
          <h1 id="ap-agreement" ref={heading} tabIndex={-1} className="t-h1 text-ink">{apply.agreement.title}</h1>
          <p className="t-lede" style={{ marginTop: 8 }}>{apply.agreement.lede}</p>
          <form
            style={{ marginTop: 20 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (!agreed) {
                setError(apply.agreement.error);
                return;
              }
              run({ action: "agreement", version: AMBASSADOR_AGREEMENT_VERSION }, () => go("details"));
            }}
          >
            <div className="amb-agreement" tabIndex={0} role="region" aria-label={apply.agreement.title}>
              {apply.agreement.sections.map((s) => (
                <section key={s.h}>
                  <h3>{s.h}</h3>
                  <p className="t-body">{s.p}</p>
                </section>
              ))}
              <section>
                <a className="amb-linkbtn" href="/code-of-conduct" target="_blank" rel="noreferrer">{apply.agreement.conductLabel} →</a>
                <p className="t-small" style={{ marginTop: 8 }}>{AMBASSADOR_AGREEMENT_VERSION}</p>
              </section>
            </div>
            <label className="check-row" style={{ marginTop: 8 }}>
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span className="t-body">{apply.agreement.check}</span>
            </label>
            <div className="amb-row-actions" style={{ justifyContent: "space-between" }}>
              <button type="button" className="btn btn-ghost" onClick={() => go("quiz")}>{apply.back}</button>
              <button type="submit" className="btn btn-teal" disabled={busy}>{apply.next} →</button>
            </div>
          </form>
        </section>
      )}

      {screen === "details" && (
        <section aria-labelledby="ap-you">
          <h1 id="ap-you" ref={heading} tabIndex={-1} className="t-h1 text-ink">{apply.you.title}</h1>
          <p className="t-lede" style={{ marginTop: 8 }}>{apply.you.lede}</p>
          <form
            style={{ marginTop: 20 }}
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="amb-panel">
              <div className="kv"><span className="k lbl">{apply.you.first}</span><span>{me.first} {me.last}</span></div>
              <div className="kv"><span className="k lbl">{apply.you.email}</span><span>{me.email}</span></div>
              {me.zip && <div className="kv"><span className="k lbl">{apply.you.zip}</span><span>{me.zip}</span></div>}
              <p className="amb-note" style={{ marginTop: 8 }}>
                {apply.privacy} <Link className="amb-linkbtn" href="/profile/edit">Edit profile</Link>
              </p>
            </div>
            <div className="field" style={{ marginTop: 18 }}>
              <label htmlFor="ap-ref">{apply.you.referredBy}</label>
              <input id="ap-ref" maxLength={255} value={referredBy} onChange={(e) => setReferredBy(e.target.value)} aria-describedby="ap-ref-hint" />
              <p className="t-small" id="ap-ref-hint">{apply.you.referredByHint}</p>
            </div>
            <div className="amb-row-actions" style={{ justifyContent: "space-between" }}>
              <button type="button" className="btn btn-ghost" onClick={() => go("agreement")}>{apply.back}</button>
              <button type="submit" className="btn btn-teal" disabled={busy}>{apply.finish} →</button>
            </div>
          </form>
        </section>
      )}

      {screen === "done" && (
        <Pass
          outcome={outcome}
          me={me}
          session={session}
          heading={heading}
          confirmWithInvite={outcome === "pending" && invite && !inviteProblem ? submit : null}
          busy={busy}
        />
      )}

      {error && <p className="amb-error" role="alert">{error}</p>}
    </div>
  );
}

function Pass({
  outcome,
  me,
  session,
  heading,
  confirmWithInvite,
  busy,
}: {
  outcome: Outcome;
  me: { first: string; last: string };
  session: AmbassadorSession | null;
  heading: React.RefObject<HTMLHeadingElement | null>;
  confirmWithInvite: (() => void) | null;
  busy: boolean;
}) {
  const [first, setFirst] = useState("");
  const [sent, setSent] = useState(false);
  const coord = coordinatorContact();
  const isIn = outcome === "in";

  const sendFirst = async () => {
    const name = first.trim();
    if (!name) return;
    const myName = profileStore.get().me || me.first;
    const text = askMessage(ui.ask.message, ui.ask.messageNoDate, name, myName, session);
    if (await shareText(text, smsHref(text))) {
      askStore.remember(name);
      profileStore.set({ me: myName });
      setSent(true);
    }
  };

  return (
    <section aria-labelledby="ap-done" className="amb-stack">
      <div className="amb-pass">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ambassador/button-art.webp" alt={apply.done.buttonAlt} width={120} height={120} />
        <h1 id="ap-done" ref={heading} tabIndex={-1} className="t-h1">{isIn ? apply.done.title : apply.pending.title}</h1>
        <p className="amb-pass-who">{fill(apply.done.who, { first: me.first, last: me.last })}</p>
        <p style={{ marginTop: 10 }}>{isIn ? apply.done.handover : apply.pending.lede}</p>
      </div>

      {confirmWithInvite && (
        <div className="amb-panel">
          <p className="t-body">You have an invite. Add it to your application; once a coordinator has approved it, you&apos;re in, with no further review.</p>
          <button type="button" className="btn btn-teal" style={{ marginTop: 10 }} disabled={busy} onClick={confirmWithInvite}>
            Add my invite to my application
          </button>
        </div>
      )}

      {isIn && (
        <form className="amb-panel" onSubmit={(e) => { e.preventDefault(); sendFirst(); }}>
          <h2 className="t-h3">{apply.done.ask.title}</h2>
          <p className="t-small">{apply.done.ask.lede}</p>
          <div className="amb-ask-list" style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <input
              style={{ flex: 1, minWidth: 0, border: "1px solid var(--rule)", borderRadius: "var(--r)", padding: "10px 14px", fontSize: 16 }}
              aria-label={apply.done.ask.label}
              placeholder={apply.done.ask.label}
              maxLength={40}
              autoComplete="off"
              value={first}
              onChange={(e) => { setFirst(e.target.value); setSent(false); }}
            />
            <button type="submit" className="btn btn-teal btn-sm" disabled={!first.trim()}>
              {sent ? apply.done.ask.sent : apply.done.ask.send}
            </button>
          </div>
        </form>
      )}

      {coord && (
        <p>
          <a className="amb-linkbtn" href={coord.phone ? `sms:${coord.phone}` : `mailto:${coord.email}`}>{apply.done.sayHi} →</a>
        </p>
      )}

      <Link className="btn btn-teal btn-block btn-lg" href={STEPS.length ? stepHref(STEPS[0].id) : AMBASSADOR_HOME}>
        {isIn ? apply.done.guide : apply.pending.guide} →
      </Link>
      <p className="amb-note">{isIn ? apply.done.guideNote : apply.pending.guideNote}</p>
    </section>
  );
}
