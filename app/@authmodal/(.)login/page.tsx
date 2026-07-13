import { Suspense } from "react";
import AuthModal from "@/app/components/auth/auth-modal";
import LoginCard from "@/app/(auth)/login/login-card";

// Soft navigations to /login land here: a popup opens over the launching
// page. Two doors (owner ask, July 2026): join CTAs (/login?intent=join)
// and invite links get the Google-auth explainer; plain "Log in" links get
// a compact sign-in card — just the Google button, no pitch. LoginCard
// picks the variant from the URL. Hard loads — invite emails, auth-failure
// redirects, refreshes — skip interception and get the full page at
// app/(auth)/login.

export default function InterceptedLogin() {
  return (
    <Suspense>
      <AuthModal>
        <LoginCard inModal />
      </AuthModal>
    </Suspense>
  );
}
