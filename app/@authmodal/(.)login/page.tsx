import { Suspense } from "react";
import AuthModal from "@/app/components/auth/auth-modal";
import LoginCard from "@/app/(auth)/login/login-card";

// Soft navigations to /login land here: the Google-auth card opens as a
// popup over the launching page (owner ask, July 2026). Hard loads —
// invite links, auth-failure redirects, refreshes — skip interception and
// get the full page at app/(auth)/login.

export default function InterceptedLogin() {
  return (
    <Suspense>
      <AuthModal>
        <LoginCard inModal />
      </AuthModal>
    </Suspense>
  );
}
