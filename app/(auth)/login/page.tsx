import { Suspense } from "react";
import LoginCard from "./login-card";

// The full-page Google-auth explainer — reached by hard navigation only:
// invite emails (/login?invite=…), the callback's auth-failure redirect,
// and direct loads/refreshes. Soft in-app navigations to /login are
// intercepted by app/@authmodal/(.)login and render the same card as a
// popup over the launching page instead.

export default function LoginPage() {
  return (
    <Suspense>
      <LoginCard />
    </Suspense>
  );
}
