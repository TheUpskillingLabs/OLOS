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

// ── Value prop bullet item ───────────────────────────────────────────────────
function ValueProp({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal/20">
        <svg
          className="h-3 w-3 text-aqua"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M2 6l3 3 5-5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="text-sm leading-relaxed text-cloud/70">{text}</span>
    </li>
  );
}

// ── Left branding panel ──────────────────────────────────────────────────────
function BrandPanel() {
  return (
    <div className="relative flex flex-col justify-between overflow-hidden px-8 py-10 lg:px-12 lg:py-14">
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

      <div className="relative z-10">
        {/* Wordmark */}
        <div className="mb-10">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-teal">
            The Upskilling Labs
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-white lg:text-5xl">
            OLOS
          </h1>
        </div>

        {/* Tagline */}
        <p className="mb-2 text-2xl font-semibold leading-snug text-white lg:text-3xl">
          Build with AI.
          <br />
          <span className="text-aqua">Grow with peers.</span>
        </p>
        <p className="mb-10 text-sm leading-relaxed text-cloud/50">
          A curated community for professionals applying AI to real work.
        </p>

        {/* Value props */}
        <ul className="space-y-4">
          <ValueProp text="Apply AI tools to real challenges — not just tutorials" />
          <ValueProp text="Learn alongside a handpicked peer cohort" />
          <ValueProp text="Ship projects across a 13-week Build Cycle" />
          <ValueProp text="Get matched to pods based on your strengths and goals" />
        </ul>
      </div>

      {/* Bottom badge */}
      <div className="relative z-10 mt-12">
        <span className="inline-flex items-center gap-2 rounded-full border border-teal/20 bg-teal/[0.06] px-3 py-1.5 text-xs font-medium text-aqua">
          <span className="h-1.5 w-1.5 rounded-full bg-aqua" aria-hidden="true" />
          Invite-only community
        </span>
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
      {/* LEFT: Brand panel — 60% on desktop, full width on mobile */}
      <div className="w-full border-b border-whisper lg:w-[60%] lg:border-b-0 lg:border-r">
        <BrandPanel />
      </div>

      {/* RIGHT: Auth card — 40% on desktop, full width on mobile */}
      <div className="flex w-full flex-1 items-center justify-center px-6 py-12 lg:w-[40%] lg:px-12">
        <div className="w-full max-w-sm">
          {/* Invited state banner */}
          {invited && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-aqua/20 bg-aqua/[0.06] px-4 py-3">
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

          {/* Card heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-white">
              {invited ? "Accept your invitation" : "Welcome back"}
            </h2>
            <p className="mt-1.5 text-sm text-cloud/50">
              {invited
                ? "One click to get started."
                : "Sign in to your OLOS account."}
            </p>
          </div>

          {/* Google sign-in button */}
          <button
            onClick={handleLogin}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-white/[0.12] bg-white/[0.04] px-5 py-3.5 text-sm font-medium text-white transition-all duration-200 hover:border-aqua/40 hover:bg-white/[0.07] hover:shadow-[0_0_18px_rgba(77,187,194,0.12)]"
          >
            <GoogleLogo />
            <span>
              {invited ? "Sign in to accept invitation" : "Sign in with Google"}
            </span>
          </button>

          {/* Privacy note */}
          <p className="mt-6 text-center text-xs leading-relaxed text-cloud/30">
            By signing in, you agree to our terms of service. We only use your
            Google account to verify your identity — we never post on your
            behalf.
          </p>

          {/* Invite-only reminder for non-invited state */}
          {!invited && (
            <p className="mt-8 text-center text-xs text-cloud/25">
              Access is by invitation only.
            </p>
          )}
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
