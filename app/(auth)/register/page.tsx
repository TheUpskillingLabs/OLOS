import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import RegisterForm from "./register-form";

export default async function RegisterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if already registered
  const serviceClient = createServiceClient();
  const { data: existing } = await serviceClient
    .from("participants")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (existing) {
    redirect("/cycles");
  }

  const email = user.email ?? "";
  const profileImageUrl = user.user_metadata?.avatar_url ?? null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8 text-center">
        {profileImageUrl && (
          <img
            src={profileImageUrl}
            alt=""
            className="mx-auto mb-4 h-20 w-20 rounded-full"
          />
        )}
        <h1 className="text-2xl font-bold text-white">
          Become an Upskiller
        </h1>
        <p className="mt-2 text-sm text-cloud/80">
          Complete your profile to join The Upskilling Labs
        </p>
      </div>
      <RegisterForm
        email={email}
        authUserId={user.id}
        profileImageUrl={profileImageUrl}
      />
    </div>
  );
}
