"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// ── Google SVG logo ─────────────────────────────────────────────────────────
function GoogleLogo() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

// ── Left branding panel ──────────────────────────────────────────────────────
function BrandPanel() {
  return (
    <div className="relative flex flex-col overflow-hidden px-8 py-10 lg:px-12 lg:py-14">
      {/* Dot-grid decorative pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "radial-gradient(circle, #4dbbc2 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
        aria-hidden="true"
      />

      {/* Teal glow blob */}
      <div
        className="pointer-events-none absolute -top-32 -left-32 h-[420px] w-[420px] rounded-full opacity-[0.12]"
        style={{
          background:
            "radial-gradient(circle, rgba(0,148,160,0.9) 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 space-y-8">
        {/* Wordmark */}
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal">
          The Upskilling Labs
        </p>

        {/* Hero */}
        <div>
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-white lg:text-4xl">
            Build real skills.
            <br />
            Through real work.
            <br />
            <span className="text-aqua">With real people.</span>
          </h1>
        </div>

        {/* Framing */}
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-cloud/70">
            A lot of learning is built around content about what is coming.
            <br />
            This is built around working on what is already here.
          </p>
          <p className="text-sm leading-relaxed text-cloud/50">
            The Upskilling Labs helps you take what you already know and use new
            tools — especially AI — on real problems in your community and field.
          </p>
        </div>

        {/* Steps */}
        <ul className="space-y-2.5">
          {[
            "Bring what you know",
            "Find a problem worth working on",
            "Join a small team",
            "Build something real",
            "Show your progress as you go",
          ].map((step) => (
            <li key={step} className="flex items-center gap-3">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-aqua"
                aria-hidden="true"
              />
              <span className="text-sm text-cloud/70">{step}</span>
            </li>
          ))}
        </ul>

        {/* Contrast */}
        <p className="text-sm leading-relaxed text-cloud/50">
          The work happens in small groups, on real problems, with people who
          share your commitment to getting something done.
        </p>

        {/* Bar */}
        <p className="text-sm leading-relaxed text-cloud/50">
          You do not need to have everything figured out. You just need to be
          comfortable using a computer, learning as you go, and working with
          others in good faith.
        </p>

        {/* Tagline */}
        <p className="text-xs tracking-wide text-cloud/30">
          Real problems&nbsp;&nbsp;·&nbsp;&nbsp;Real collaboration&nbsp;&nbsp;·&nbsp;&nbsp;Real output
        </p>
      </div>
    </div>
  );
}

// ── Main login content ───────────────────────────────────────────────────────
function LoginContent() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const [invited, setInvited] = useState(false);

  useEffect(() => {
    if (inviteToken) {
      // Store invite token in a cookie so it survives the OAuth redirect
      document.cookie = `invite_token=${inviteToken}; path=/; max-age=3600; SameSite=Lax`;
      setInvited(true);
    }
  }, [inviteToken]);

  const handleLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
  };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* LEFT: Brand panel — 60% on desktop, below auth on mobile */}
      <div className="order-2 w-full border-t border-whisper lg:order-1 lg:w-[60%] lg:border-t-0 lg:border-r">
        <BrandPanel />
      </div>

      {/* RIGHT: Auth card — 40% on desktop, first on mobile */}
      <div className="order-1 flex w-full flex-1 items-center justify-center px-6 py-12 lg:order-2 lg:w-[40%] lg:px-12">
        <div className="w-full max-w-sm space-y-8">
          {/* Heading */}
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-teal">
              The Upskilling Labs
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              {invited ? "You have been invited" : "Get started"}
            </h2>
          </div>

          {/* Invited state banner */}
          {invited && (
            <div className="flex items-start gap-3 rounded-lg border border-aqua/20 bg-aqua/[0.06] px-4 py-3">
              <svg
                className="mt-0.5 h-4 w-4 shrink-0 text-aqua"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <rect
                  x="1"
                  y="3"
                  width="14"
                  height="10"
                  rx="1.5"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
                <path
                  d="M1 5l7 5 7-5"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
              <div>
                <p className="text-sm font-semibold text-aqua">
                  You&apos;ve been invited
                </p>
                <p className="mt-0.5 text-xs text-cloud/60">
                  Sign in with Google to accept your invitation and join The
                  Upskilling Labs.
                </p>
              </div>
            </div>
          )}

          {/* Closing line */}
          <div>
            <p className="text-base font-medium leading-snug text-white">
              {invited
                ? "One click to accept your invitation and get started."
                : "A place to learn by doing, alongside people who take it seriously."}
            </p>
          </div>

          {/* Google sign-in button */}
          <button
            onClick={handleLogin}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-white/[0.12] bg-white/[0.04] px-5 py-3.5 text-sm font-medium text-white transition-all duration-200 hover:border-aqua/40 hover:bg-white/[0.07] hover:shadow-[0_0_18px_rgba(77,187,194,0.12)]"
          >
            <GoogleLogo />
            <span>
              {invited
                ? "Sign in to accept invitation"
                : "Join The Upskilling Labs"}
            </span>
          </button>

          {/* Returning user link */}
          {!invited && (
            <p className="text-center text-xs text-cloud/30">
              Already a member?{" "}
              <button
                onClick={handleLogin}
                className="text-cloud/50 underline underline-offset-2 transition-colors hover:text-aqua"
              >
                Log in
              </button>
            </p>
          )}

          {/* Privacy note */}
          <p className="text-center text-xs leading-relaxed text-cloud/25">
            We use Google to verify your identity. We never post on your behalf.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Page export ──────────────────────────────────────────────────────────────
export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
