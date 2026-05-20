import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import ShortForm from "./short-form";

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
    redirect("/dashboard");
  }

  const email = user.email ?? "";

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 sm:px-6">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-whisper bg-white/[0.02] p-8">
          <div className="mb-6">
            <p className="text-sm font-medium uppercase tracking-widest text-cloud/40">
              The Upskilling Labs
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">
              Become an Upskiller
            </h1>
            <p className="mt-2 text-sm text-cloud/60">
              Complete your profile to get started.
            </p>
          </div>
          <ShortForm email={email} authUserId={user.id} />
        </div>
      </div>
    </div>
  );
}
