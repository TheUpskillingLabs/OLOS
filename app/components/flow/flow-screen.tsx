"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/* ════════════════════════════════════════════════════════════════════════
   The flow engine — onboarding-proto's view-flow, extracted from the signup
   funnel once the cycle ceremony became its second consumer. One question
   per screen, confirm-to-advance, segmented progress, guarded autofocus,
   Enter advances when valid.

   Step types mirror FLOWS: info | text | textarea | fields | choice |
   consent | signature. (checks/tags arrive with the mentor/volunteer flows.)

   Agreement rule (hard, owner decision): ANY agreement — consent or
   signature — is scroll-gated: the agree/sign control stays inert until the
   reader scrolls the box to its end (content that fits counts as read).
   ════════════════════════════════════════════════════════════════════════ */

export type FlowAnswers = Record<
  string,
  string | boolean | string[] | undefined
>;

export interface ChoiceOption {
  v: string;
  label: string;
  sub?: string;
}

export interface FieldDef {
  id: string;
  label: string;
  ph: string;
  required: boolean;
  half?: boolean;
  inputmode?: "numeric";
}

export type FlowStep =
  | { id: string; type: "info"; q: string; help?: string; render: React.ReactNode }
  | {
      id: string;
      type: "text" | "textarea";
      q: string;
      help?: string;
      ph?: string;
      required?: boolean;
    }
  | { id: string; type: "fields"; q: string; help?: string; fields: FieldDef[] }
  | {
      id: string;
      type: "multiselect";
      q: string;
      help?: string;
      options: ChoiceOption[];
      /** minimum picks to be valid; omit ⇒ optional (0). */
      min?: number;
    }
  | {
      id: string;
      type: "scale";
      q: string;
      help?: string;
      lowLabel: string;
      highLabel: string;
      /** true ⇒ the step can be skipped without a pick. */
      optional?: boolean;
    }
  | {
      id: string;
      type: "choice";
      q: string;
      help?: string;
      options: ChoiceOption[];
      followUp?: {
        id: string;
        label: string;
        ph: string;
        when: (v: string | undefined) => boolean;
      };
    }
  | {
      id: string;
      type: "consent";
      q: string;
      agreementTitle: string;
      agreement: { h: string; p: string }[];
      text: string;
    }
  | {
      id: string;
      type: "signature";
      q: string;
      help?: string;
      intro: string;
      terms: { title: string; body: string }[];
      versionLine: string;
      ph: string;
    };

const pad2 = (n: number) => String(n).padStart(2, "0");

export function CheckIcon() {
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

export function BackIcon() {
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

/* The scroll-gate (attachAgreeGate twin): read = scrolled to the end;
   content that fits without scrolling counts as read (80ms initial check). */
function useAgreeGate() {
  const [read, setRead] = useState(false);
  const scrollEl = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollEl.current;
    if (!el) return;
    const check = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) {
        setRead(true);
      }
    };
    el.addEventListener("scroll", check, { passive: true });
    const t = setTimeout(check, 80);
    return () => {
      el.removeEventListener("scroll", check);
      clearTimeout(t);
    };
  }, []);
  return { read, scrollEl };
}

export function FlowScreen({
  eyebrow,
  steps,
  finalLabel,
  finalClass = "btn-teal",
  submittingLabel = "One moment…",
  onComplete,
  onExit,
}: {
  eyebrow: string;
  steps: FlowStep[];
  finalLabel: string;
  finalClass?: "btn-teal" | "btn-red";
  submittingLabel?: string;
  /** Runs on the last step's confirm. Return an error message to stay put, or null on success. */
  onComplete: (answers: FlowAnswers) => Promise<string | null>;
  onExit: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<FlowAnswers>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  // Signature steps gate on reading — tracked here so the footer button knows.
  const [gateOpen, setGateOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  const setAnswer = useCallback(
    (id: string, value: string | boolean | string[] | undefined) =>
      setAnswers((a) => ({ ...a, [id]: value })),
    []
  );

  const stepValid = useMemo(() => {
    switch (step.type) {
      case "info":
        return true;
      case "text":
      case "textarea":
        return step.required === false
          ? true
          : String(answers[step.id] ?? "").trim().length > 0;
      case "fields":
        return step.fields.every(
          (f) => !f.required || String(answers[f.id] ?? "").trim().length > 0
        );
      case "choice":
        return typeof answers[step.id] === "string";
      case "multiselect": {
        const v = answers[step.id];
        return (Array.isArray(v) ? v.length : 0) >= (step.min ?? 0);
      }
      case "scale":
        return step.optional ? true : typeof answers[step.id] === "string";
      case "consent":
        return answers[step.id] === true;
      case "signature": {
        const v = String(answers[step.id] ?? "").trim();
        // read to the end + a full name, not initials
        return gateOpen && v.length >= 3 && v.includes(" ");
      }
    }
  }, [step, answers, gateOpen]);

  const advance = useCallback(async () => {
    if (isLast) {
      setServerError("");
      setSubmitting(true);
      const err = await onComplete(answers);
      if (err) {
        setServerError(err);
        setSubmitting(false);
      }
    } else {
      setStepIndex((i) => i + 1);
      scrollRef.current?.scrollTo({ top: 0 });
    }
  }, [isLast, onComplete, answers]);

  const back = () => {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
    else onExit();
  };

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
          <div className="lbl lbl-teal flow-eyebrow">{eyebrow}</div>
          <h2 className="t-h1 flow-q">{step.q}</h2>
          {"help" in step && step.help && (
            <p className="t-body flow-help">{step.help}</p>
          )}
          <StepInput
            key={step.id}
            step={step}
            answers={answers}
            setAnswer={setAnswer}
            valid={stepValid}
            advance={advance}
            onGateChange={setGateOpen}
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
            className={`btn btn-block ${isLast ? finalClass : "btn-teal"}`}
            disabled={!stepValid || submitting}
            onClick={advance}
          >
            {isLast ? (submitting ? submittingLabel : finalLabel) : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StepInput({
  step,
  answers,
  setAnswer,
  valid,
  advance,
  onGateChange,
}: {
  step: FlowStep;
  answers: FlowAnswers;
  setAnswer: (id: string, value: string | boolean | string[] | undefined) => void;
  valid: boolean;
  advance: () => void;
  onGateChange: (open: boolean) => void;
}) {
  // Steps without a gate leave the footer button ungated.
  useEffect(() => {
    if (step.type !== "signature") onGateChange(true);
  }, [step.type, onGateChange]);

  switch (step.type) {
    case "info":
      return <>{step.render}</>;
    case "text":
    case "textarea":
      return (
        <TextInput step={step} answers={answers} setAnswer={setAnswer} valid={valid} advance={advance} />
      );
    case "fields":
      return (
        <FieldsInput step={step} answers={answers} setAnswer={setAnswer} valid={valid} advance={advance} />
      );
    case "choice":
      return <ChoiceInput step={step} answers={answers} setAnswer={setAnswer} />;
    case "multiselect":
      return (
        <MultiSelectInput step={step} answers={answers} setAnswer={setAnswer} />
      );
    case "scale":
      return <ScaleInput step={step} answers={answers} setAnswer={setAnswer} />;
    case "consent":
      return <ConsentInput step={step} answers={answers} setAnswer={setAnswer} />;
    case "signature":
      return (
        <SignatureInput step={step} answers={answers} setAnswer={setAnswer} valid={valid} advance={advance} onGateChange={onGateChange} />
      );
  }
}

/* Guarded autofocus — never steal focus from typing/autofill (proto F7). */
function useGuardedFocus(
  wrapRef: React.RefObject<HTMLElement | null>,
  targetRef: React.RefObject<HTMLElement | null>
) {
  useEffect(() => {
    const t = setTimeout(() => {
      const ae = document.activeElement;
      if (ae && ae !== document.body && wrapRef.current?.contains(ae)) return;
      targetRef.current?.focus();
      targetRef.current?.scrollIntoView({ block: "center" });
    }, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function TextInput({
  step,
  answers,
  setAnswer,
  valid,
  advance,
}: {
  step: Extract<FlowStep, { type: "text" | "textarea" }>;
  answers: FlowAnswers;
  setAnswer: (id: string, value: string) => void;
  valid: boolean;
  advance: () => void;
}) {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  useGuardedFocus(wrapRef, ref);
  const common = {
    ref,
    placeholder: step.ph ?? "",
    value: String(answers[step.id] ?? ""),
    onChange: (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => setAnswer(step.id, e.target.value),
  };
  return (
    <div className="field" ref={wrapRef}>
      {step.type === "textarea" ? (
        <textarea {...common} rows={4} />
      ) : (
        <input
          {...common}
          type="text"
          onKeyDown={(e) => {
            if (e.key === "Enter" && valid) {
              e.preventDefault();
              advance();
            }
          }}
        />
      )}
    </div>
  );
}

/* type:'fields' — several labeled inputs on one screen (3 asks max) */
function FieldsInput({
  step,
  answers,
  setAnswer,
  valid,
  advance,
}: {
  step: Extract<FlowStep, { type: "fields" }>;
  answers: FlowAnswers;
  setAnswer: (id: string, value: string) => void;
  valid: boolean;
  advance: () => void;
}) {
  const firstRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  useGuardedFocus(wrapRef, firstRef);

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

/* type:'choice' — optional inline follow-up input keeps related asks on ONE screen */
function ChoiceInput({
  step,
  answers,
  setAnswer,
}: {
  step: Extract<FlowStep, { type: "choice" }>;
  answers: FlowAnswers;
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

/* type:'multiselect' — pick any number of tags (value stored as string[]) */
function MultiSelectInput({
  step,
  answers,
  setAnswer,
}: {
  step: Extract<FlowStep, { type: "multiselect" }>;
  answers: FlowAnswers;
  setAnswer: (id: string, value: string[]) => void;
}) {
  const selected = Array.isArray(answers[step.id])
    ? (answers[step.id] as string[])
    : [];
  const toggle = (v: string) =>
    setAnswer(
      step.id,
      selected.includes(v)
        ? selected.filter((x) => x !== v)
        : [...selected, v]
    );

  return (
    <div className="tag-wrap" role="group" aria-label={step.q}>
      {step.options.map((o) => {
        const on = selected.includes(o.v);
        return (
          <button
            key={o.v}
            type="button"
            aria-pressed={on}
            className={`tag-btn${on ? " active" : ""}`}
            onClick={() => toggle(o.v)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* type:'scale' — a 1–5 pip row with low/high captions (value stored as "1".."5") */
function ScaleInput({
  step,
  answers,
  setAnswer,
}: {
  step: Extract<FlowStep, { type: "scale" }>;
  answers: FlowAnswers;
  setAnswer: (id: string, value: string | undefined) => void;
}) {
  const selected =
    typeof answers[step.id] === "string" ? (answers[step.id] as string) : "";
  return (
    <>
      <div className="scale-row" role="radiogroup" aria-label={step.q}>
        {["1", "2", "3", "4", "5"].map((n) => {
          const on = selected === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={on}
              className={`tag-btn scale-cell${on ? " active" : ""}`}
              onClick={() => setAnswer(step.id, on ? undefined : n)}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="scale-caption">
        <span>{step.lowLabel}</span>
        <span>{step.highLabel}</span>
      </div>
    </>
  );
}

/* type:'consent' — scroll-gated agreement + checkbox row */
function ConsentInput({
  step,
  answers,
  setAnswer,
}: {
  step: Extract<FlowStep, { type: "consent" }>;
  answers: FlowAnswers;
  setAnswer: (id: string, value: boolean) => void;
}) {
  const { read, scrollEl } = useAgreeGate();
  const checked = answers[step.id] === true;

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

/* type:'signature' — scroll-gated terms + typed full name IS the signature */
function SignatureInput({
  step,
  answers,
  setAnswer,
  valid,
  advance,
  onGateChange,
}: {
  step: Extract<FlowStep, { type: "signature" }>;
  answers: FlowAnswers;
  setAnswer: (id: string, value: string) => void;
  valid: boolean;
  advance: () => void;
  onGateChange: (open: boolean) => void;
}) {
  const { read, scrollEl } = useAgreeGate();
  useEffect(() => {
    onGateChange(read);
  }, [read, onGateChange]);

  const dateLine = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      <div
        className="agree-scroll"
        ref={scrollEl}
        tabIndex={0}
        role="region"
        aria-label={step.q}
      >
        <p
          className="t-small"
          style={{ marginBottom: 10, color: "var(--charcoal)" }}
        >
          {step.intro}
        </p>
        {step.terms.map((t, i) => (
          <div
            key={t.title}
            style={{
              display: "flex",
              gap: 12,
              padding: "10px 0",
              borderTop: "1px solid var(--rule)",
            }}
          >
            <span className="idx" style={{ flexShrink: 0 }}>
              {i + 1}
            </span>
            <div>
              <div className="t-h4" style={{ fontSize: 15, marginBottom: 2 }}>
                {t.title}
              </div>
              <p className="t-small">{t.body}</p>
            </div>
          </div>
        ))}
        <p
          className="t-small"
          style={{
            paddingTop: 10,
            borderTop: "1px solid var(--rule)",
            color: "var(--meta)",
          }}
        >
          {step.versionLine}
        </p>
      </div>
      <div className={`agree-hint${read ? " read" : ""}`}>
        {read ? "Read to the end ✓" : "↓ Scroll to the end to sign"}
      </div>
      <div className="field" style={{ marginTop: 14 }}>
        <label htmlFor="ff-signature">Sign with your full name</label>
        <input
          id="ff-signature"
          type="text"
          autoComplete="name"
          placeholder={step.ph}
          value={String(answers[step.id] ?? "")}
          onChange={(e) => setAnswer(step.id, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && valid) {
              e.preventDefault();
              advance();
            }
          }}
        />
      </div>
      <p className="t-small" style={{ marginTop: 10, color: "var(--meta)" }}>
        Signing on {dateLine} · recorded on your profile
      </p>
    </>
  );
}
