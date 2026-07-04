"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  HEAR_ABOUT_SOURCES,
  PARTICIPANT_AGREEMENT_VERSION,
  type RoleIntent,
} from "@/lib/validations/funnel-registration";
import {
  FlowScreen,
  CheckIcon,
  BackIcon,
  type FlowStep,
  type FlowAnswers,
} from "@/app/components/flow/flow-screen";

/* ════════════════════════════════════════════════════════════════════════
   The onboarding funnel — ported from onboarding-proto:
     view-role-intent  → the RoleIntentScreen below
     FLOWS('signup')   → SIGNUP_STEPS on the shared flow engine
   All user-facing copy is owner-approved — change it in the prototype first.

   Post-signup role branching: picking "Join a Cycle" routes into the cycle
   registration ceremony (the threshold — flows never silently chain; the
   ceremony IS the seam). Everything else lands on the dashboard; mentor and
   volunteer flows arrive with their stages.
   ════════════════════════════════════════════════════════════════════════ */

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
}: {
  email: string;
  authUserId: string;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<"roles" | "flow" | "already">("roles");
  const [roles, setRoles] = useState<RoleIntent[]>([]);
  const steps = useMemo(() => signupSteps(email), [email]);

  const submit = async (answers: FlowAnswers): Promise<string | null> => {
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
        setStage("already");
        return null;
      }
      // Role branch: the cycle is the commitment, and its seam is the
      // threshold ceremony — never a silent chain into more questions.
      if (roles.includes("cycle") && json.active_cycle_id) {
        router.push(`/cycles/${json.active_cycle_id}/join?from=signup`);
      } else {
        router.push("/dashboard");
      }
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

  return (
    <FlowScreen
      eyebrow="Your profile"
      steps={steps}
      finalLabel="Become an Upskiller"
      finalClass="btn-red"
      submittingLabel="Setting you up…"
      onComplete={submit}
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
