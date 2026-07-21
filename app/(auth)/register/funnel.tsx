"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  HEAR_ABOUT_SOURCES,
  PARTICIPANT_AGREEMENT_VERSION,
  ZIP_REGEX,
  type RoleIntent,
  type LabChoice,
} from "@/lib/validations/funnel-registration";
import {
  FlowScreen,
  CheckIcon,
  BackIcon,
  type FlowStep,
  type FlowAnswers,
} from "@/app/components/flow/flow-screen";
import { metroLabel } from "@/lib/metros-label";

/* ════════════════════════════════════════════════════════════════════════
   The onboarding funnel — ported from onboarding-proto:
     view-role-intent  → the RoleIntentScreen below
     FLOWS('signup')   → SIGNUP_STEPS on the shared flow engine
   All user-facing copy is owner-approved — change it in the prototype first.

   Post-signup routing: every new member lands on the dashboard, whatever
   intents they picked. The dashboard is the home base where the next steps
   surface — the recruiting-cycle join CTA, the setup checklist, the Learning
   Log — so the intents shape what a member sees there, not where they land.
   ════════════════════════════════════════════════════════════════════════ */

/* The Participant Agreement — the single agreement everyone accepts to join,
   regardless of role. Rendered in full (a plain-language summary) on the consent
   step, behind the scroll-gate; it incorporates the canonical Terms, Privacy
   Policy, and Code of Conduct linked at the end of the gated region.
   NOTE: owner-approved copy — mirror any change in the onboarding-proto prototype,
   and treat the version bump as a legal-review item (see funnel-registration.ts). */
const PARTICIPANT_AGREEMENT: { h: string; p: string }[] = [
  {
    h: "Who this is between",
    p: "You and the Upskilling Labs. Everyone joins through the same registration and accepts this same agreement: whether you take part as a learner, mentor, organizer, or builder.",
  },
  {
    h: "The full terms",
    p: "This is a plain-language summary. Our Terms of Service, Privacy Policy, and Code of Conduct (linked below) are part of this agreement and govern in full.",
  },
  {
    h: "Be someone people can build with",
    p: "Real name, honest work, no harassment. The Labs runs on mutual reliance — treat members, mentors, and hosts accordingly. Our Code of Conduct sets this out in full.",
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
    p: "Public events are free and open. If you RSVP, we plan for you to show up. Sessions may be photographed — you can opt out of photography consent when registering for the event.",
  },
  {
    h: "Updates",
    p: "We’ll email you about your cycle and Labs news. Unsubscribe anytime; account-critical messages still arrive.",
  },
  {
    h: "Leaving",
    p: "Close your account whenever you like. Contributions already submitted to the Labs will stay with the Labs — we're open-source.",
  },
];

const WORK = [
  "Employed full time",
  "Employed part-time",
  "Self-employed",
  "Unemployed and jobseeking",
  "In a career transition",
  "Student",
  "Prefer not to say",
].map((w) => ({ v: w.toLowerCase(), label: w }));

function signupSteps(email: string): FlowStep[] {
  return [
    {
      id: "email",
      type: "info",
      q: "Signing up as",
      help: "We pulled this from your Google account.",
      render: <div className="flow-emaillarge">{email}</div>,
    },
    {
      id: "about",
      type: "fields",
      q: "Tell us who you are",
      fields: [
        { id: "first", label: "First name", ph: "Alex", required: true, half: true },
        { id: "last", label: "Last name", ph: "Rivera", required: true, half: true },
        {
          id: "zip",
          label: "Zip code",
          ph: "20001",
          required: true,
          inputmode: "numeric",
          pattern: ZIP_REGEX,
          error: "Enter a 5-digit zip code",
        },
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
      help: "Help us thank the people and places that send folks our way.",
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
        when: (v) => v === "referral" || v === "invited" || v === "other",
      },
    },
    {
      id: "consent",
      type: "consent",
      q: "One last thing",
      agreementTitle: "The Participant Agreement",
      agreement: PARTICIPANT_AGREEMENT,
      references: [
        { label: "Terms of Service", href: "/terms" },
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Code of Conduct", href: "/code-of-conduct" },
      ],
      text: "I agree to the Participant Agreement — including the Terms of Service, Privacy Policy, and Code of Conduct — and consent to receive updates from The Upskilling Labs.",
    },
  ];
}

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
    sub: "Join a pod, take on a real problem, and ship something you’re proud of. Three months.",
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

export default function RegistrationFunnel({
  email,
  authUserId,
  initialFirstName = "",
  initialLastName = "",
}: {
  email: string;
  authUserId: string;
  /** Prefill from the Google OAuth profile — editable like any answer. */
  initialFirstName?: string;
  initialLastName?: string;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<"roles" | "flow" | "lab" | "already">(
    "roles"
  );
  const [roles, setRoles] = useState<RoleIntent[]>([]);
  const [flowAnswers, setFlowAnswers] = useState<FlowAnswers | null>(null);
  const steps = useMemo(() => signupSteps(email), [email]);

  const submit = async (
    answers: FlowAnswers,
    labChoice: LabChoice
  ): Promise<string | null> => {
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
        lab_choice: labChoice,
      }),
    }).catch(() => null);

    const json = res ? await res.json().catch(() => null) : null;
    if (res?.ok && json) {
      if (json.already_registered) {
        setStage("already");
        return null;
      }
      // Every new member lands on the dashboard, whatever intents they picked.
      // The next steps (join the recruiting cycle, finish the setup checklist,
      // start a Learning Log) surface there — no intent silently chains into
      // another flow.
      router.push("/dashboard");
      return null;
    }
    return json?.error || "Registration failed — try again.";
  };

  if (stage === "already") {
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

  if (stage === "roles") {
    return (
      <RoleIntentScreen
        roles={roles}
        setRoles={setRoles}
        onContinue={() => setStage("flow")}
      />
    );
  }

  if (stage === "lab") {
    // Guard: reached only after the flow captured its answers.
    if (!flowAnswers) {
      setStage("flow");
      return null;
    }
    return (
      <LabChoiceScreen
        zip={String(flowAnswers.zip ?? "")}
        onBack={() => setStage("flow")}
        onSubmit={(choice) => submit(flowAnswers, choice)}
      />
    );
  }

  return (
    <FlowScreen
      eyebrow="Your profile"
      steps={steps}
      finalLabel="Continue"
      finalClass="btn-red"
      submittingLabel="One moment…"
      initialAnswers={
        flowAnswers ??
        (initialFirstName || initialLastName
          ? { first: initialFirstName, last: initialLastName }
          : undefined)
      }
      initialStepIndex={flowAnswers ? steps.length - 1 : 0}
      onComplete={async (answers) => {
        setFlowAnswers(answers);
        setStage("lab");
        return null;
      }}
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

/* ── Choose your Local Lab (docs/LOCAL_LABS.md — the membership spine) ──
   Labs are local: join an ACTIVE lab to take part in a cycle, hop on an
   existing lab's waitlist, or start one for your city. The zip typed on the
   previous step suggests the nearest lab (metroFromZip, via /api/labs/suggest);
   the member confirms or chooses otherwise. Only an active-lab join unlocks
   cycle participation — the waitlist branches hold. */
interface LabLite {
  id: number;
  slug: string;
  name: string;
  st: string | null;
  status: "active" | "waitlist";
}
interface SuggestResponse {
  suggested: LabLite | null;
  active: LabLite[];
  waitlist: LabLite[];
}

function labLabel(l: LabLite): string {
  return metroLabel(l.name, l.st);
}

function LabOptCard({
  selected,
  onSelect,
  title,
  badge,
  sub,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  badge?: string;
  sub: string;
}) {
  return (
    <label className={`opt-card${selected ? " selected" : ""}`}>
      <input type="radio" name="lab" checked={selected} onChange={onSelect} />
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
          <span className="t-h4">{title}</span>
          {badge && (
            <span className="lbl lbl-teal" style={{ fontSize: 10 }}>
              {badge}
            </span>
          )}
        </div>
        <p className="t-small">{sub}</p>
      </div>
    </label>
  );
}

function LabChoiceScreen({
  zip,
  onBack,
  onSubmit,
}: {
  zip: string;
  onBack: () => void;
  onSubmit: (choice: LabChoice) => Promise<string | null>;
}) {
  const [data, setData] = useState<SuggestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  // sel keys: `active:<id>` | `wait:<id>` | `start`
  const [sel, setSel] = useState<string | null>(null);
  const [city, setCity] = useState("");
  const [stField, setStField] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/labs/suggest?zip=${encodeURIComponent(zip)}`)
      .then((r) => r.json())
      .then((d: SuggestResponse) => {
        if (cancelled) return;
        setData(d);
        if (d.suggested) {
          setSel(
            d.suggested.status === "active"
              ? `active:${d.suggested.id}`
              : `wait:${d.suggested.id}`
          );
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [zip]);

  const toChoice = (): LabChoice | null => {
    if (sel === "start") {
      if (!city.trim()) return null;
      return {
        kind: "start_waitlist",
        city: city.trim(),
        st: stField.trim() || undefined,
      };
    }
    if (sel?.startsWith("active:"))
      return { kind: "join_active", metro_id: Number(sel.slice(7)) };
    if (sel?.startsWith("wait:"))
      return { kind: "join_waitlist", metro_id: Number(sel.slice(5)) };
    return null;
  };

  const go = async () => {
    const choice = toChoice();
    if (!choice) {
      setError(sel === "start" ? "Enter your city" : "Pick your lab");
      return;
    }
    setSubmitting(true);
    setError(null);
    const err = await onSubmit(choice);
    if (err) {
      setError(err);
      setSubmitting(false);
    }
    // success → the parent navigates to /dashboard
  };

  const suggestedId = data?.suggested?.id ?? null;
  const activeOthers = (data?.active ?? []).filter((l) => l.id !== suggestedId);
  const waitOthers = (data?.waitlist ?? []).filter((l) => l.id !== suggestedId);

  const activeSub = "Active — join now and take part in the current cycle.";
  const waitSub =
    "Forming — join the waitlist; you’ll be able to take part when it launches.";

  return (
    <div className="view light onboard s-paper">
      <div className="sheet">
        <div className="topbar">
          <button className="icon-btn" aria-label="Back" onClick={onBack}>
            <BackIcon />
          </button>
        </div>
        <div className="vscroll pad">
          <div className="lbl lbl-teal" style={{ marginBottom: 16 }}>
            Your Local Lab
          </div>
          <h2 className="t-h1" style={{ marginBottom: 14 }}>
            Where will you build?
          </h2>
          <p className="t-lede" style={{ marginBottom: 28 }}>
            The Labs are local. Join an active lab to take part in a Build
            Cycle, hop on a waitlist, or start one for your city.
          </p>

          {loading ? (
            <p className="t-body">Finding labs near you…</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {data?.suggested &&
                (() => {
                  const key =
                    data.suggested.status === "active"
                      ? `active:${data.suggested.id}`
                      : `wait:${data.suggested.id}`;
                  return (
                    <LabOptCard
                      selected={sel === key}
                      onSelect={() => setSel(key)}
                      title={labLabel(data.suggested)}
                      badge="Nearest you"
                      sub={
                        data.suggested.status === "active" ? activeSub : waitSub
                      }
                    />
                  );
                })()}
              {activeOthers.map((l) => (
                <LabOptCard
                  key={`active:${l.id}`}
                  selected={sel === `active:${l.id}`}
                  onSelect={() => setSel(`active:${l.id}`)}
                  title={labLabel(l)}
                  sub={activeSub}
                />
              ))}
              {waitOthers.map((l) => (
                <LabOptCard
                  key={`wait:${l.id}`}
                  selected={sel === `wait:${l.id}`}
                  onSelect={() => setSel(`wait:${l.id}`)}
                  title={labLabel(l)}
                  sub={waitSub}
                />
              ))}

              <label className={`opt-card${sel === "start" ? " selected" : ""}`}>
                <input
                  type="radio"
                  name="lab"
                  checked={sel === "start"}
                  onChange={() => setSel("start")}
                />
                <span className="opt-check">
                  <CheckIcon />
                </span>
                <div style={{ flex: 1 }}>
                  <div className="t-h4" style={{ marginBottom: 4 }}>
                    My city isn’t here — start a list
                  </div>
                  <p className="t-small">
                    We come where the list is longest. Yours could be next.
                  </p>
                </div>
              </label>

              {sel === "start" && (
                <div className="field-grid" style={{ marginTop: 4 }}>
                  <div className="field">
                    <label htmlFor="lab-city">City</label>
                    <input
                      id="lab-city"
                      type="text"
                      placeholder="Austin"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  </div>
                  <div className="field half">
                    <label htmlFor="lab-st">State</label>
                    <input
                      id="lab-st"
                      type="text"
                      placeholder="TX"
                      maxLength={2}
                      value={stField}
                      onChange={(e) => setStField(e.target.value.toUpperCase())}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <p
              className="t-small"
              style={{ color: "var(--red)", marginTop: 14 }}
              role="alert"
            >
              {error}
            </p>
          )}
        </div>
        <div className="actionbar light-bar">
          <button
            className="btn btn-red btn-block"
            disabled={loading || submitting || !sel}
            onClick={go}
          >
            {submitting ? "Setting you up…" : "Become an Upskiller"}
          </button>
        </div>
      </div>
    </div>
  );
}
