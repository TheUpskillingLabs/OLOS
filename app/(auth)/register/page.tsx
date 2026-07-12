import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import RegistrationFunnel from "./funnel";

// The registration funnel (onboarding-proto: view-role-intent → FLOWS('signup')).
// The auth callback lands new Google sign-ins here when no participants row
// exists; returning members are bounced straight to the dashboard.
export default async function RegisterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const serviceClient = createServiceClient();
  const { data: existing } = await serviceClient
    .from("participants")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (existing) {
    redirect("/dashboard");
  }

  // Google's OAuth profile rides along on user_metadata — seed the name
  // fields from it so a new member isn't retyping what we already know
  // (July 2026 feedback). Fall back to splitting the display name when the
  // structured fields are absent.
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const displayName =
    typeof meta.full_name === "string"
      ? meta.full_name
      : typeof meta.name === "string"
        ? meta.name
        : "";
  const firstName =
    typeof meta.given_name === "string"
      ? meta.given_name
      : (displayName.split(" ")[0] ?? "");
  const lastName =
    typeof meta.family_name === "string"
      ? meta.family_name
      : displayName.split(" ").slice(1).join(" ");

  return (
    <RegistrationFunnel
      email={user.email ?? ""}
      authUserId={user.id}
      initialFirstName={firstName}
      initialLastName={lastName}
    />
  );
}
