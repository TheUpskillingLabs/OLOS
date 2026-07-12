"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Soft navigations to /login skip the Google-auth explainer popup and go
// straight to Google (owner ask, July 2026 — the popup added a click without
// adding information). Hard loads — invite links, auth-failure redirects,
// refreshes — still get the full page at app/(auth)/login, which keeps the
// explainer copy.

function StraightToGoogle() {
  const searchParams = useSearchParams();

  useEffect(() => {
    // Same invite-token handoff the full login page does, in case a soft
    // navigation ever carries ?invite=.
    const inviteToken = searchParams.get("invite");
    if (inviteToken) {
      document.cookie = `invite_token=${inviteToken}; path=/; max-age=3600; SameSite=Lax`;
    }
    const supabase = createClient();
    supabase.auth
      .signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
        },
      })
      .then(({ error }) => {
        // If the OAuth kickoff fails, fall back to the full login page so
        // the member isn't stranded on a blank overlay.
        if (error) window.location.assign("/login");
      });
  }, [searchParams]);

  // Minimal scrim while the browser follows the Google redirect — the
  // .gate-modal vocabulary matches the old popup so nothing flashes oddly.
  return (
    <div className="gate-modal open" aria-busy="true">
      <div
        className="gate-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Signing in with Google"
      >
        <p className="t-body" style={{ padding: "28px 0", textAlign: "center" }}>
          Taking you to Google&hellip;
        </p>
      </div>
    </div>
  );
}

export default function InterceptedLogin() {
  return (
    <Suspense>
      <StraightToGoogle />
    </Suspense>
  );
}
