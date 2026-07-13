"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Two doors, one component (owner ask, July 2026):
// - Join CTAs link to /login?intent=join and get the Google-auth explainer —
//   copy ported from onboarding-proto's view-google-auth (owner-approved;
//   change it in the prototype first). Invite links count as joining.
// - Plain "Log in" links get a regular sign-in card on hard loads; soft
//   navigations skip even that and go straight to Google
//   (app/@authmodal/(.)login).

function GoogleLogo() {
  return (
    <svg
      style={{ width: 20, height: 20, flexShrink: 0 }}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 0 0 0 10.76l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
      />
    </svg>
  );
}

const BENEFITS = [
  "Free for everyone — no paid account needed",
  "Your profile is visible to Labs members — you control what you show",
  "Easy access to shared tools — Docs, Calendar, Slack",
];

export default function LoginCard({ inModal = false }: { inModal?: boolean }) {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const invited = !!inviteToken;
  const joining = searchParams.get("intent") === "join" || invited;
  const authFailed = searchParams.get("error") === "auth_failed";

  useEffect(() => {
    if (inviteToken) {
      document.cookie = `invite_token=${inviteToken}; path=/; max-age=3600; SameSite=Lax`;
    }
  }, [inviteToken]);

  const continueWithGoogle = async () => {
    // Tell the auth callback which door this attempt came through — logging
    // in with an unknown Google account should say "no account" rather than
    // silently opening registration. Cookie, not query param: the redirect
    // allowlist matches exact URLs (supabase/config.toml).
    document.cookie = `auth_intent=${joining ? "join" : "login"}; path=/; max-age=600; SameSite=Lax`;
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
        // Always show Google's account chooser so members pick which email
        // to sign in with instead of being auto-signed into the last one.
        queryParams: { prompt: "select_account" },
      },
    });
  };

  const invitedTag = invited && (
    <div className="open-tag" style={{ marginBottom: 14 }}>
      <svg viewBox="0 0 24 24" strokeWidth="2" aria-hidden="true">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
      You&rsquo;ve been invited to join
    </div>
  );

  const noAccount = searchParams.get("error") === "no_account";
  const attemptedEmail = searchParams.get("email");

  const noAccountAlert = noAccount && (
    <div
      style={{
        background: "var(--paper)",
        border: "1px solid var(--paper-edge)",
        borderLeft: "3px solid var(--teal)",
        borderRadius: "var(--r)",
        padding: "14px 16px",
        marginBottom: 24,
      }}
      role="alert"
    >
      <p className="t-body" style={{ fontWeight: 600, marginBottom: 4 }}>
        We couldn&rsquo;t find a Labs account
        {attemptedEmail ? (
          <>
            {" "}
            for <strong>{attemptedEmail}</strong>
          </>
        ) : null}
        .
      </p>
      <p className="t-small">
        Try again with a different Google account, or{" "}
        <a
          className="see"
          href="/login?intent=join"
          style={{ textDecoration: "underline" }}
        >
          Join the Labs
        </a>{" "}
        to create one.
      </p>
    </div>
  );

  const failedAlert = authFailed && (
    <div
      className="t-small"
      style={{
        color: "var(--red)",
        border: "1px solid rgba(225,29,42,.35)",
        borderRadius: "var(--r)",
        padding: "12px 14px",
        marginBottom: 14,
      }}
      role="alert"
    >
      That sign-in didn&rsquo;t go through. Give it another try.
    </div>
  );

  const benefits = (
    <div style={{ marginBottom: 8 }}>
      {BENEFITS.map((b, i) => (
        <div
          key={b}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 14,
            padding: "14px 0",
            borderBottom:
              i < BENEFITS.length - 1 ? "1px solid var(--rule)" : "none",
          }}
        >
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "var(--teal)",
              flexShrink: 0,
              marginTop: 7,
            }}
          />
          <span className="t-body">{b}</span>
        </div>
      ))}
    </div>
  );

  const googleButton = (
    <button className="google-btn" onClick={continueWithGoogle}>
      <GoogleLogo />
      {invited ? "Sign in to accept invitation" : "Continue with Google"}
    </button>
  );

  const finePrint = (
    <>
      <p className="t-small">
        We only access your name, email, and profile picture.
        {joining && (
          <> Already a member? Same door — Google signs you in either way.</>
        )}
      </p>
      <p className="t-small" style={{ marginTop: 8 }}>
        By continuing, you agree to our{" "}
        <a
          className="see"
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "underline" }}
        >
          Terms of Service
        </a>{" "}
        and{" "}
        <a
          className="see"
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "underline" }}
        >
          Privacy Policy
        </a>
        .
      </p>
    </>
  );

  // Hosted in the intercepted popup (app/@authmodal/(.)login). Joining gets
  // the full explainer; logging in gets a compact card — heading, Google
  // button, fine print — so the door is obvious without the pitch.
  if (inModal) {
    if (joining) {
      return (
        <>
          {invitedTag}
          {failedAlert}
          {noAccountAlert}
          <h2 className="t-h2" style={{ marginBottom: 8 }}>
            Sign in with Google
          </h2>
          <p className="t-body" style={{ marginBottom: 12 }}>
            One account you already have. Free, familiar, nothing new to
            remember.
          </p>
          <div style={{ marginBottom: 20 }}>{benefits}</div>
          <div style={{ marginBottom: 10 }}>{googleButton}</div>
          {finePrint}
        </>
      );
    }
    return (
      <>
        {failedAlert}
        <h2 className="t-h2" style={{ marginBottom: 8 }}>
          Sign in
        </h2>
        <p className="t-body" style={{ marginBottom: 20 }}>
          Use your Google account to sign in to The Upskilling Labs.
        </p>
        {noAccountAlert}
        <div style={{ marginBottom: 10 }}>{googleButton}</div>
        {finePrint}
      </>
    );
  }

  // Hard-loaded join door (invite emails land here): the full explainer.
  if (joining) {
    return (
      <div className="view light onboard s-paper">
        <div className="sheet">
          <div className="topbar" />
          <div className="vscroll pad">
            <div className="lbl lbl-teal" style={{ marginBottom: 16 }}>
              Create account
            </div>
            {invitedTag}
            {failedAlert}
            {noAccountAlert}
            <h2 className="t-h1" style={{ marginBottom: 16 }}>
              Sign in with Google
            </h2>
            <p className="t-lede" style={{ marginBottom: 32 }}>
              One account you already have. Free, familiar, nothing new to
              remember.
            </p>
            {benefits}
          </div>
          <div className="actionbar light-bar">
            {googleButton}
            {finePrint}
          </div>
        </div>
      </div>
    );
  }

  // Hard-loaded log-in door: a regular sign-in screen, no marketing copy.
  return (
    <div className="view light onboard s-paper">
      <div className="sheet">
        <div className="topbar" />
        <div
          className="vscroll pad"
          style={{ display: "flex", flexDirection: "column" }}
        >
          {/* margin:auto centers vertically but, unlike justify-content,
              still lets the top scroll into view if the card overflows. */}
          <div style={{ margin: "auto 0", padding: "16px 0 24px" }}>
            {failedAlert}
            <h2 className="t-h1" style={{ marginBottom: 12 }}>
              Sign in
            </h2>
            <p className="t-lede" style={{ marginBottom: 28 }}>
              Use your Google account to sign in to The Upskilling Labs.
            </p>
            {noAccountAlert}
            {googleButton}
            <div style={{ marginTop: 20 }}>{finePrint}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
