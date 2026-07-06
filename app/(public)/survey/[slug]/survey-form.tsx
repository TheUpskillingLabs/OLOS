"use client";

import { useState } from "react";
import { STANDPOINTS } from "@/lib/validations/survey-response";

/* The field-survey form (SENSEMAKING_FLOW.md §3). Onboarding-minded ordering:
   lead with the observation (the reason they came), then optional context,
   then contact, with the required participation consent as the last gate
   before submit. Anonymous by default — contact fields are opt-in.
   Posts to /api/surveys/[slug]/responses. */

type Standpoint = (typeof STANDPOINTS)[number];

const STANDPOINT_LABELS: Record<Standpoint, string> = {
  work_in_field: "I work in this field",
  affected: "I've been personally affected by it",
  tried_to_fix: "I've tried to fix something like this before",
  research: "I research or study this area",
  pay_attention: "I just pay close attention",
  other: "Other",
};

const SALIENCE_LOW = "I noticed it in passing";
const SALIENCE_HIGH = "This is something I think about a lot";

const fieldStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--rule)",
  borderRadius: "var(--r)",
  padding: 14,
  font: "inherit",
  fontSize: 16,
  background: "var(--white)",
};

function Req() {
  return (
    <span className="text-red" aria-hidden style={{ marginLeft: 2 }}>
      *
    </span>
  );
}

export default function SurveyForm({
  slug,
  domain,
}: {
  slug: string;
  domain: string;
}) {
  const [observation, setObservation] = useState("");
  const [standpoint, setStandpoint] = useState<Set<Standpoint>>(new Set());
  const [salience, setSalience] = useState<number | null>(null);
  const [priorAttempts, setPriorAttempts] = useState("");
  const [contactable, setContactable] = useState(false);
  const [mentorInterest, setMentorInterest] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);

  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleStandpoint = (s: Standpoint) =>
    setStandpoint((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  async function submit() {
    setError(null);
    if (!observation.trim()) {
      return setError("Tell us what you're seeing — a sentence is plenty.");
    }
    if (!consent) {
      return setError("Please confirm the consent below to submit.");
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/surveys/${slug}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          observation: observation.trim(),
          consent_participation: true,
          standpoint: [...standpoint],
          salience,
          prior_attempts: priorAttempts.trim(),
          contactable,
          mentor_interest: mentorInterest,
          submitter_name: name.trim(),
          submitter_email: email.trim(),
          submitter_phone: phone.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong — try again.");
      }
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="lcard" style={{ padding: 40, textAlign: "center" }}>
        <div className="t-h3" style={{ marginBottom: 8 }}>
          Thank you — your observation is in ✓
        </div>
        <p
          className="t-body text-meta"
          style={{ maxWidth: "52ch", margin: "0 auto 20px" }}
        >
          It joins the {domain} insights repository that Upskillers draw on as
          they form their problem frames. Seen something else worth sharing?
        </p>
        <button
          className="btn btn-ghost-teal"
          type="button"
          onClick={() => {
            setObservation("");
            setStandpoint(new Set());
            setSalience(null);
            setPriorAttempts("");
            setContactable(false);
            setMentorInterest(false);
            setName("");
            setEmail("");
            setPhone("");
            setConsent(false);
            setDone(false);
          }}
        >
          Share another observation
        </button>
      </div>
    );
  }

  return (
    <form
      className="card"
      style={{ padding: 28 }}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      noValidate
    >
      {/* 1 — the observation (required) */}
      <div style={{ marginBottom: 28 }}>
        <label className="lbl" htmlFor="observation" style={{ display: "block", marginBottom: 6 }}>
          What are you observing in the field of {domain.toLowerCase()}?
          <Req />
        </label>
        <p className="t-small text-meta" style={{ marginBottom: 10 }}>
          What do you see that feels stuck, broken, or missing? Is there
          anything that keeps being a problem no matter what people try? A
          sentence is fine. So is a page — there&rsquo;s no right format.
        </p>
        <textarea
          id="observation"
          rows={6}
          value={observation}
          onChange={(e) => setObservation(e.target.value)}
          placeholder="Just tell us what you see."
          style={{ ...fieldStyle, resize: "vertical" }}
          required
        />
      </div>

      {/* 2 — optional context */}
      <fieldset style={{ border: 0, padding: 0, margin: "0 0 28px" }}>
        <legend className="lbl" style={{ marginBottom: 6 }}>
          What is your experience with this?{" "}
          <span className="text-meta" style={{ fontWeight: 400 }}>
            (optional)
          </span>
        </legend>
        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          {STANDPOINTS.map((s) => {
            const checked = standpoint.has(s);
            return (
              <label
                key={s}
                className="tappable"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  border: `1px solid ${checked ? "var(--teal)" : "var(--rule)"}`,
                  borderRadius: "var(--r)",
                  cursor: "pointer",
                  background: checked ? "var(--teal-wash, rgba(0,0,0,0.02))" : "transparent",
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleStandpoint(s)}
                  style={{ width: 18, height: 18, accentColor: "var(--teal)" }}
                />
                <span className="t-body">{STANDPOINT_LABELS[s]}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* 3 — salience 1–5 */}
      <fieldset style={{ border: 0, padding: 0, margin: "0 0 28px" }}>
        <legend className="lbl" style={{ marginBottom: 10 }}>
          How much does this matter to you personally?{" "}
          <span className="text-meta" style={{ fontWeight: 400 }}>
            (optional)
          </span>
        </legend>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[1, 2, 3, 4, 5].map((n) => {
            const active = salience === n;
            return (
              <button
                key={n}
                type="button"
                aria-pressed={active}
                onClick={() => setSalience(active ? null : n)}
                style={{
                  flex: "1 1 44px",
                  minWidth: 44,
                  padding: "12px 0",
                  border: `1px solid ${active ? "var(--teal)" : "var(--rule)"}`,
                  borderRadius: "var(--r)",
                  background: active ? "var(--teal)" : "var(--white)",
                  color: active ? "#fff" : "var(--ink)",
                  font: "inherit",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 120ms",
                }}
              >
                {n}
              </button>
            );
          })}
        </div>
        <div
          className="t-small text-meta"
          style={{ display: "flex", justifyContent: "space-between", marginTop: 8, gap: 12 }}
        >
          <span>{SALIENCE_LOW}</span>
          <span style={{ textAlign: "right" }}>{SALIENCE_HIGH}</span>
        </div>
      </fieldset>

      {/* 4 — prior attempts */}
      <div style={{ marginBottom: 32 }}>
        <label className="lbl" htmlFor="prior" style={{ display: "block", marginBottom: 6 }}>
          Has anyone tried to address this before?{" "}
          <span className="text-meta" style={{ fontWeight: 400 }}>
            (optional)
          </span>
        </label>
        <p className="t-small text-meta" style={{ marginBottom: 10 }}>
          Even if it didn&rsquo;t work — especially if it didn&rsquo;t work. What
          happened?
        </p>
        <textarea
          id="prior"
          rows={3}
          value={priorAttempts}
          onChange={(e) => setPriorAttempts(e.target.value)}
          style={{ ...fieldStyle, resize: "vertical" }}
        />
      </div>

      {/* 5 — staying in touch (optional, opt-in) */}
      <div
        style={{
          borderTop: "1px solid var(--rule)",
          paddingTop: 24,
          marginBottom: 28,
        }}
      >
        <h3 className="t-h4" style={{ marginBottom: 4 }}>
          Staying in touch{" "}
          <span className="text-meta" style={{ fontWeight: 400, fontSize: "0.85em" }}>
            (optional)
          </span>
        </h3>
        <p className="t-small text-meta" style={{ marginBottom: 16 }}>
          Your submission is anonymous unless you fill these in.
        </p>

        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            marginBottom: 16,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={contactable}
            onChange={(e) => setContactable(e.target.checked)}
            style={{ width: 18, height: 18, marginTop: 2, accentColor: "var(--teal)" }}
          />
          <span className="t-body">
            I&rsquo;m open to being contacted by program participants.
            <span className="text-meta" style={{ display: "block", fontSize: "0.9em", marginTop: 2 }}>
              If participants use your observation, they may reach out with
              follow-up questions or to acknowledge your contribution. Your
              contact info is shared only with those participants.
            </span>
          </span>
        </label>

        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <label className="lbl" htmlFor="name" style={{ display: "block", marginBottom: 6 }}>
              Your name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Priya Shah"
              style={fieldStyle}
            />
          </div>
          <div>
            <label className="lbl" htmlFor="email" style={{ display: "block", marginBottom: 6 }}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={fieldStyle}
            />
          </div>
          <div>
            <label className="lbl" htmlFor="phone" style={{ display: "block", marginBottom: 6 }}>
              Phone{" "}
              <span className="text-meta" style={{ fontWeight: 400 }}>
                (if you prefer call or text over email)
              </span>
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={fieldStyle}
            />
          </div>
        </div>

        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            marginTop: 16,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={mentorInterest}
            onChange={(e) => setMentorInterest(e.target.checked)}
            style={{ width: 18, height: 18, marginTop: 2, accentColor: "var(--teal)" }}
          />
          <span className="t-body">
            I&rsquo;m interested in volunteering as a mentor in the {domain} Build
            Cycle.
            <span className="text-meta" style={{ display: "block", fontSize: "0.9em", marginTop: 2 }}>
              Please add your name and email above so we can reach you.
            </span>
          </span>
        </label>
      </div>

      {/* 6 — required consent + submit */}
      <div
        style={{
          borderTop: "1px solid var(--rule)",
          paddingTop: 24,
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            marginBottom: 20,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            style={{ width: 18, height: 18, marginTop: 2, accentColor: "var(--teal)" }}
            aria-required
          />
          <span className="t-small">
            <strong>
              Consent to participation
              <Req />
            </strong>
            <span style={{ display: "block", marginTop: 4 }} className="text-meta">
              I have read and understood the above. I consent to my submission
              being used by The Upskilling Labs in the development of public
              projects and shared with program participants for research and
              project-development purposes.
            </span>
          </span>
        </label>

        {error && (
          <p
            className="t-small"
            role="alert"
            style={{ color: "var(--red)", marginBottom: 12 }}
          >
            {error}
          </p>
        )}

        <button
          className="btn btn-teal btn-block btn-lg"
          type="submit"
          disabled={busy}
        >
          {busy ? "Submitting…" : "Submit observation"}
        </button>
      </div>
    </form>
  );
}
