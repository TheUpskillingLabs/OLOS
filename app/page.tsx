import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if user has completed Upskiller registration
  const serviceClient = createServiceClient();
  const { data: participant } = await serviceClient
    .from("participants")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!participant) {
    redirect("/register");
  }

  redirect("/dashboard");
}
