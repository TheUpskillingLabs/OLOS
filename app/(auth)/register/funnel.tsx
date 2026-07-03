"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  HEAR_ABOUT_SOURCES,
  PARTICIPANT_AGREEMENT_VERSION,
  type RoleIntent,
} from "@/lib/validations/funnel-registration";

/* ════════════════════════════════════════════════════════════════════════
   The onboarding funnel — ported from onboarding-proto:
     view-role-intent  → the RoleIntentScreen below
     FLOWS('signup')   → SIGNUP_STEPS + the FlowScreen engine
   One question per screen, confirm-to-advance, segmented progress, and the
   scroll-gated Participant Agreement (owner decision: ANY agreement must be
   read to its end before the agree control activates).
   All user-facing copy is owner-approved — change it in the prototype first.
   ════════════════════════════════════════════════════════════════════════ */

type Answers = Record<string, string | boolean | undefined>;

interface ChoiceOption {
  v: string;
  label: string;
  sub?: string;
}

interface FieldDef {
  id: string;
  label: string;
  ph: string;
  required: boolean;
  half?: boolean;
  inputmode?: "numeric";
}

type Step =
  | { id: string; type: "info"; q: string; help?: string }
  | { id: string; type: "fields"; q: string; help?: string; fields: FieldDef[] }
  | {
      id: string;
      type: "choice";
      q: string;
      help?: string;
      options: ChoiceOption[];
      followUp?: { id: string; label: string; ph: string; when: (v: string | undefined) => boolean };
    }
  | {
      id: string;
      type: "consent";
      q: string;
      agreementTitle: string;
      agreement: { h: string; p: string }[];
      text: string;
    };

/* The Participant Agreement — rendered in full (not just referenced) on the
   consent step, behind the scroll-gate. Plain language on purpose. */
const PARTICIPANT_AGREEMENT: { h: string; p: string }[] = [
  {
    h: "Who this is between",
    p: "You and The Upskilling Labs, a community R&D lab. This covers your member account; registering for a Build Cycle adds its own agreement later.",
  },
  {
    h: "Be someone people can build with",
    p: "Real name, honest work, no harassment. The Labs runs on mutual reliance — treat members, mentors, and hosts accordingly.",
  },
  {
    h: "Your profile is members-only",
    p: "What you add to your profile is visible to Labs members, not the public web. You choose what to share beyond the basics.",
  },
  {
    h: "Your data",
    p: "We collect what you give us — profile, answers, Learning Logs — to run the Labs. Log health checks are visible only to your Poderator and the Labs team. We never sell your data.",
  },
  {
    h: "Events",
    p: "Public events are free and open. If you RSVP, show up or free the seat. Sessions may be photographed for the community archive — tell the host if you’d rather not appear.",
  },
  {
    h: "Updates",
    p: "We’ll email you about your cohort and Labs news. Unsubscribe anytime; account-critical messages still arrive.",
  },
  {
    h: "Leaving",
    p: "Close your account whenever you like. Contributions already returned to the commons stay in the commons.",
  },
];

const WORK: ChoiceOption[] = [
  "Employed full time",
  "Employed part-time",
  "Self-employed",
  "Unemployed and jobseeking",
  "In a career transition",
  "Student",
  "Prefer not to say",
].map((w) => ({ v: w.toLowerCase(), label: w }));

const SIGNUP_STEPS: Step[] = [
  {
    id: "email",
    type: "info",
    q: "Signing up as",
    help: "We pulled this from your Google account.",
  },
  {
    id: "about",
    type: "fields",
    q: "Tell us who you are",
    help: "Your zip just finds the lab nearest you — nothing else.",
    fields: [
      { id: "first", label: "First name", ph: "Alex", required: true, half: true },
      { id: "last", label: "Last name", ph: "Rivera", required: true, half: true },
      { id: "zip", label: "Zip code", ph: "20001", required: true, inputmode: "numeric" },
    ],
  },
  {
    id: "work",
    type: "choice",
    q: "What best describes you right now?",
    options: WORK,
  },
  {
    id: "hearAbout",
    type: "choice",
    q: "How did you hear about The Labs?",
    help: "Everyone registers through the same path — this helps us thank the people and places that send folks our way.",
    options: [
      { v: "referral", label: "A friend or colleague referred me" },
      {
        v: "invited",
        label: "Someone at The Labs invited me",
        sub: "A mentor, facilitator, or organizer",
      },
      { v: "event", label: "A workshop, summit, or event" },
      {
        v: "other",
        label: "Somewhere else",
        sub: "Social media, the library, word of mouth",
      },
    ],
    followUp: {
      id: "referredBy",
      label: "Who referred you? (optional — so we can thank them)",
      ph: "e.g. Priya Shah",
      when: (v) => v === "referral" || v === "invited",
    },
  },
  {
    id: "consent",
    type: "consent",
    q: "One last thing",
    agreementTitle: "The Participant Agreement",
    agreement: PARTICIPANT_AGREEMENT,
    text: "I agree to the Participant Agreement and consent to receive updates from The Upskilling Labs.",
  },
];

const ROLE_OPTIONS: {
  v: RoleIntent;
  title: string;
  badge?: string;
  sub: string;
}[] = [
  {
    v: "cycle",
    title: "Join a Cycle",
    badge: "Heart of the Labs",
    sub: "Join a pod, take on a real problem, and ship something you’re proud of. Thirteen weeks.",
  },
  {
    v: "events",
    title: "Attend events & workshops",
    sub: "Hands-on sessions and community events. Come when it suits you.",
  },
  {
    v: "volunteer",
    title: "Volunteer",
    sub: "Help run events, or help behind the scenes. The Labs runs on people who pitch in.",
  },
  {
    v: "mentor",
    title: "Mentor",
    sub: "Share what you know — office hours, workshops, and the occasional rescue.",
  },
];

const pad2 = (n: number) => String(n).padStart(2, "0");

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

export default function RegistrationFunnel({
  email,
  authUserId,
}: {
  email: string;
  authUserId: string;
}) {
  const [stage, setStage] = useState<"roles" | "flow">("roles");
  const [roles, setRoles] = useState<RoleIntent[]>([]);

  if (stage === "roles") {
    return (
      <RoleIntentScreen
        roles={roles}
        setRoles={setRoles}
        onContinue={() => setStage("flow")}
      />
    );
  }
  return (
    <FlowScreen
      email={email}
      authUserId={authUserId}
      roles={roles}
      onExit={() => setStage("roles")}
    />
  );
}

/* ── view-role-intent ── */
function RoleIntentScreen({
  roles,
  setRoles,
  onContinue,
}: {
  roles: RoleIntent[];
  setRoles: (r: RoleIntent[]) => void;
  onContinue: () => void;
}) {
  const toggle = (v: RoleIntent) =>
    setRoles(
      roles.includes(v) ? roles.filter((r) => r !== v) : [...roles, v]
    );

  return (
    <div className="view light onboard s-paper">
      <div className="sheet">
        <div className="topbar">
          <Link href="/login" className="icon-btn" aria-label="Back">
            <BackIcon />
          </Link>
        </div>
        <div className="vscroll pad">
          <div className="lbl lbl-teal" style={{ marginBottom: 16 }}>
            Get started
          </div>
          <h2 className="t-h1" style={{ marginBottom: 14 }}>
            How do you want to take part?
          </h2>
          <p className="t-lede" style={{ marginBottom: 28 }}>
            Pick at least one — you can change this any time.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {ROLE_OPTIONS.map((o) => {
              const selected = roles.includes(o.v);
              return (
                <label
                  key={o.v}
                  className={`opt-card${selected ? " selected" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggle(o.v)}
                  />
                  <span className="opt-check">
                    <CheckIcon />
                  </span>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                        marginBottom: 4,
                      }}
                    >
                      <span className="t-h4">{o.title}</span>
                      {o.badge && (
                        <span className="lbl lbl-teal" style={{ fontSize: 10 }}>
                          {o.badge}
                        </span>
                      )}
                    </div>
                    <p className="t-small">{o.sub}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
        <div className="actionbar light-bar">
          <button
            className="btn btn-red btn-block"
            disabled={roles.length === 0}
            onClick={onContinue}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── view-flow: the one-question-per-screen engine ── */
function FlowScreen({
  email,
  authUserId,
  roles,
  onExit,
}: {
  email: string;
  authUserId: string;
  roles: RoleIntent[];
  onExit: () => void;
}) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const steps = SIGNUP_STEPS;
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  const setAnswer = useCallback(
    (id: string, value: string | boolean | undefined) =>
      setAnswers((a) => ({ ...a, [id]: value })),
    []
  );

  const stepValid = useMemo(() => {
    switch (step.type) {
      case "info":
        return true;
      case "fields":
        return step.fields.every(
          (f) => !f.required || String(answers[f.id] ?? "").trim().length > 0
        );
      case "choice":
        return typeof answers[step.id] === "string";
      case "consent":
        return answers[step.id] === true;
    }
  }, [step, answers]);

  const submit = useCallback(async () => {
    setServerError("");
    setSubmitting(true);
    const hearAbout = String(answers.hearAbout ?? "");
    const referredBy = String(answers.referredBy ?? "").trim();
    const res = await fetch("/api/registrations/funnel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_user_id: authUserId,
        google_id: email,
        email,
        first_name: String(answers.first ?? "").trim(),
        last_name: String(answers.last ?? "").trim(),
        zip: String(answers.zip ?? "").trim(),
        work_situation: String(answers.work ?? ""),
        source: (HEAR_ABOUT_SOURCES as readonly string[]).includes(hearAbout)
          ? hearAbout
          : "other",
        referred_by: referredBy || undefined,
        role_intents: roles,
        contact_consent: answers.consent === true,
        agreement_version: PARTICIPANT_AGREEMENT_VERSION,
      }),
    }).catch(() => null);

    const json = res ? await res.json().catch(() => null) : null;
    if (res?.ok && json) {
      if (json.already_registered) {
        setAlreadyRegistered(true);
        setSubmitting(false);
      } else {
        router.push("/dashboard");
      }
    } else {
      setServerError(json?.error || "Registration failed — try again.");
      setSubmitting(false);
    }
  }, [answers, authUserId, email, roles, router]);

  const advance = useCallback(() => {
    if (isLast) {
      void submit();
    } else {
      setStepIndex((i) => i + 1);
      scrollRef.current?.scrollTo({ top: 0 });
    }
  }, [isLast, submit]);

  const back = () => {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
    else onExit();
  };

  if (alreadyRegistered) {
    return (
      <div className="view light onboard s-paper">
        <div className="sheet">
          <div className="topbar" />
          <div className="vscroll pad" style={{ paddingTop: 24 }}>
            <div className="lbl lbl-teal" style={{ marginBottom: 16 }}>
              Welcome back
            </div>
            <h2 className="t-h1" style={{ marginBottom: 16 }}>
              You already have an account
            </h2>
            <p className="t-lede">
              We sent you an email with a link to sign in. Check your inbox.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="view light onboard s-paper">
      <div className="sheet">
        <div className="topbar">
          <button className="icon-btn" aria-label="Back" onClick={back}>
            <BackIcon />
          </button>
          <div className="seg">
            {steps.map((s, i) => (
              <div
                key={s.id}
                className={`seg-bar${i < stepIndex ? " done" : ""}${
                  i === stepIndex ? " active" : ""
                }`}
              >
                <span className="seg-fill" />
              </div>
            ))}
          </div>
          <span className="lbl" style={{ flexShrink: 0 }}>
            {pad2(stepIndex + 1)} / {pad2(steps.length)}
          </span>
        </div>
        <div className="vscroll pad flow-scroll" ref={scrollRef}>
          <div className="lbl lbl-teal flow-eyebrow">Your profile</div>
          <h2 className="t-h1 flow-q">{step.q}</h2>
          {"help" in step && step.help && (
            <p className="t-body flow-help">{step.help}</p>
          )}
          <StepInput
            key={step.id}
            step={step}
            email={email}
            answers={answers}
            setAnswer={setAnswer}
            valid={stepValid}
            advance={advance}
          />
          {serverError && (
            <p
              className="t-small"
              style={{ color: "var(--red)", marginTop: 14 }}
              role="alert"
            >
              {serverError}
            </p>
          )}
        </div>
        <div className="actionbar light-bar">
          <button
            className={`btn btn-block ${isLast ? "btn-red" : "btn-teal"}`}
            disabled={!stepValid || submitting}
            onClick={advance}
          >
            {isLast
              ? submitting
                ? "Setting you up…"
                : "Become an Upskiller"
              : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StepInput({
  step,
  email,
  answers,
  setAnswer,
  valid,
  advance,
}: {
  step: Step;
  email: string;
  answers: Answers;
  setAnswer: (id: string, value: string | boolean | undefined) => void;
  valid: boolean;
  advance: () => void;
}) {
  if (step.type === "info") {
    return <div className="flow-emaillarge">{email}</div>;
  }
  if (step.type === "fields") {
    return (
      <FieldsInput
        step={step}
        answers={answers}
        setAnswer={setAnswer}
        valid={valid}
        advance={advance}
      />
    );
  }
  if (step.type === "choice") {
    return <ChoiceInput step={step} answers={answers} setAnswer={setAnswer} />;
  }
  return <ConsentInput step={step} answers={answers} setAnswer={setAnswer} />;
}

/* type:'fields' — several labeled inputs on one screen (3 asks max) */
function FieldsInput({
  step,
  answers,
  setAnswer,
  valid,
  advance,
}: {
  step: Extract<Step, { type: "fields" }>;
  answers: Answers;
  setAnswer: (id: string, value: string) => void;
  valid: boolean;
  advance: () => void;
}) {
  const firstRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Guarded autofocus — never steal focus from typing/autofill (proto F7).
  useEffect(() => {
    const t = setTimeout(() => {
      const ae = document.activeElement;
      if (ae && ae !== document.body && wrapRef.current?.contains(ae)) return;
      firstRef.current?.focus();
      firstRef.current?.scrollIntoView({ block: "center" });
    }, 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="field-grid" ref={wrapRef}>
      {step.fields.map((f, i) => (
        <div key={f.id} className={`field${f.half ? " half" : ""}`}>
          <label htmlFor={`ff-${f.id}`}>{f.label}</label>
          <input
            id={`ff-${f.id}`}
            ref={i === 0 ? firstRef : undefined}
            type="text"
            inputMode={f.inputmode}
            placeholder={f.ph}
            value={String(answers[f.id] ?? "")}
            onChange={(e) => setAnswer(f.id, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && valid) {
                e.preventDefault();
                advance();
              }
            }}
          />
        </div>
      ))}
    </div>
  );
}

/* type:'choice' — optional inline follow-up input (step.followUp) keeps
   related asks on ONE screen (hearAbout + "Who referred you?"). */
function ChoiceInput({
  step,
  answers,
  setAnswer,
}: {
  step: Extract<Step, { type: "choice" }>;
  answers: Answers;
  setAnswer: (id: string, value: string | undefined) => void;
}) {
  const followUpRef = useRef<HTMLInputElement>(null);
  const selected = answers[step.id] as string | undefined;
  const followUpOn = step.followUp ? step.followUp.when(selected) : false;

  const pick = (v: string) => {
    setAnswer(step.id, v);
    if (step.followUp && !step.followUp.when(v)) {
      setAnswer(step.followUp.id, undefined);
    } else if (step.followUp) {
      setTimeout(() => followUpRef.current?.focus(), 60);
    }
  };

  return (
    <>
      <div className="choice-list" role="radiogroup" aria-label={step.q}>
        {step.options.map((o) => (
          <div
            key={o.v}
            role="radio"
            aria-checked={selected === o.v}
            tabIndex={0}
            className={`choice${selected === o.v ? " selected" : ""}`}
            onClick={() => pick(o.v)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                pick(o.v);
              }
            }}
          >
            <div className="c-main">
              <div className="c-label">{o.label}</div>
              {o.sub && <div className="c-sub">{o.sub}</div>}
            </div>
            <span className="dot">
              <CheckIcon />
            </span>
          </div>
        ))}
      </div>
      {step.followUp && followUpOn && (
        <div className="field" style={{ marginTop: 14 }}>
          <label htmlFor={`ff-${step.followUp.id}`}>{step.followUp.label}</label>
          <input
            id={`ff-${step.followUp.id}`}
            ref={followUpRef}
            type="text"
            placeholder={step.followUp.ph}
            value={String(answers[step.followUp.id] ?? "")}
            onChange={(e) => setAnswer(step.followUp!.id, e.target.value)}
          />
        </div>
      )}
    </>
  );
}

/* type:'consent' — scroll-gated: the checkbox stays inert until the reader
   reaches the end of the agreement (content that fits counts as read). */
function ConsentInput({
  step,
  answers,
  setAnswer,
}: {
  step: Extract<Step, { type: "consent" }>;
  answers: Answers;
  setAnswer: (id: string, value: boolean) => void;
}) {
  const [read, setRead] = useState(false);
  const scrollEl = useRef<HTMLDivElement>(null);
  const checked = answers[step.id] === true;

  useEffect(() => {
    const el = scrollEl.current;
    if (!el) return;
    const check = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) {
        setRead(true);
      }
    };
    el.addEventListener("scroll", check, { passive: true });
    const t = setTimeout(check, 80); // fits-without-scrolling counts as read
    return () => {
      el.removeEventListener("scroll", check);
      clearTimeout(t);
    };
  }, []);

  return (
    <>
      <div
        className="agree-scroll"
        ref={scrollEl}
        tabIndex={0}
        role="region"
        aria-label={step.agreementTitle}
      >
        <div className="lbl lbl-teal" style={{ marginBottom: 12 }}>
          {step.agreementTitle}
        </div>
        {step.agreement.map((a) => (
          <div key={a.h} style={{ marginBottom: 12 }}>
            <div className="t-h4" style={{ fontSize: 14, marginBottom: 2 }}>
              {a.h}
            </div>
            <p className="t-small">{a.p}</p>
          </div>
        ))}
      </div>
      <div className={`agree-hint${read ? " read" : ""}`}>
        {read ? "Read to the end ✓" : "↓ Scroll to the end to agree"}
      </div>
      <label
        className={`choice${checked ? " selected" : ""}${read ? "" : " gated"}`}
        style={{ alignItems: "flex-start", marginTop: 14 }}
        onClick={(e) => {
          e.preventDefault();
          if (!read) return;
          setAnswer(step.id, !checked);
        }}
      >
        <span className="dot square" style={{ marginTop: 2 }}>
          <CheckIcon />
        </span>
        <div className="c-main">
          <div
            className="c-label"
            style={{
              fontWeight: 400,
              fontSize: 15,
              lineHeight: "22px",
              color: "var(--charcoal)",
            }}
          >
            {step.text}
          </div>
        </div>
      </label>
    </>
  );
}
