"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import AuthModal from "@/app/components/auth/auth-modal";
import LoginCard from "@/app/(auth)/login/login-card";
import { createClient } from "@/lib/supabase/client";

// Soft navigations to /login land here. Two doors (owner ask, July 2026):
// - Join CTAs (/login?intent=join) and invite links keep the Google-auth
//   explainer popup — newcomers get the pitch.
// - Plain "Log in" links skip the popup and go straight to Google — members
//   who tapped Log in have already decided.
// Hard loads — invite emails, auth-failure redirects, refreshes — skip
// interception entirely and get the full page at app/(auth)/login.

function StraightToGoogle() {
  useEffect(() => {
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
  }, []);

  // Minimal scrim while the browser follows the Google redirect.
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

function LoginDoor() {
  const searchParams = useSearchParams();
  const joining =
    searchParams.get("intent") === "join" || !!searchParams.get("invite");

  if (joining) {
    return (
      <AuthModal>
        <LoginCard inModal />
      </AuthModal>
    );
  }
  return <StraightToGoogle />;
}

export default function InterceptedLogin() {
  return (
    <Suspense>
      <LoginDoor />
    </Suspense>
  );
}
