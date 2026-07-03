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

  return <RegistrationFunnel email={user.email ?? ""} authUserId={user.id} />;
}
