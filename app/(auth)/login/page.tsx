"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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


function LoginContent() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const [invited, setInvited] = useState(false);

  useEffect(() => {
    if (inviteToken) {
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
    <>
      {/* ── Hero ── */}
      <section className="flex min-h-svh flex-col justify-between px-6 pb-10 pt-12 lg:px-16 lg:pb-14 lg:pt-16">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-teal">
          The Upskilling Labs
        </p>

        <div className="my-auto max-w-3xl py-16">
          <h1 className="text-[clamp(2.25rem,5vw,4.5rem)] font-bold leading-[1.08] tracking-tight text-white">
            Build real skills.
            <br />
            Through real work.
            <br />
            <span className="text-aqua">With real people.</span>
          </h1>

          <p className="mt-6 max-w-md text-base leading-relaxed text-cloud/50 lg:mt-8 lg:text-lg">
            A place to learn by doing, alongside people who take the work
            seriously.
          </p>

          {invited && (
            <div className="mt-8 inline-flex items-center gap-2.5 rounded-full border border-aqua/20 bg-aqua/[0.06] px-4 py-2">
              <span
                className="h-2 w-2 rounded-full bg-aqua"
                aria-hidden="true"
              />
              <span className="text-sm font-medium text-aqua">
                You&apos;ve been invited to join
              </span>
            </div>
          )}

          <div className="mt-10 flex flex-col gap-5 sm:flex-row sm:items-center lg:mt-12">
            <button
              onClick={handleLogin}
              className="inline-flex items-center justify-center gap-3 rounded-full border border-white/[0.12] bg-white/[0.04] px-8 py-4 text-base font-medium text-white shadow-[0_0_0_0_rgba(77,187,194,0)] transition-all duration-300 ease-spring hover:border-aqua/40 hover:bg-white/[0.07] hover:shadow-[0_0_24px_rgba(77,187,194,0.18)] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
            >
              <GoogleLogo />
              {invited
                ? "Sign in to accept invitation"
                : "Join The Upskilling Labs"}
            </button>

            {!invited && (
              <button
                onClick={handleLogin}
                className="text-sm text-cloud/60 transition-colors duration-150 ease-out hover:text-aqua focus-visible:outline-none focus-visible:text-aqua"
              >
                Already a member? Log in
              </button>
            )}
          </div>
        </div>

        <p className="text-xs tracking-wide text-cloud/20">
          Real problems&ensp;·&ensp;Real collaboration&ensp;·&ensp;Real output
        </p>
      </section>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
