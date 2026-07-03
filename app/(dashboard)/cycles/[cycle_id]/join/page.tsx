import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import CycleCeremony from "./ceremony";

// The cycle registration ceremony (onboarding-proto: view-cycle-threshold →
// FLOWS('cycle') → the Open Cycle Agreement signature → view-cycle-signed).
// Every registration entry routes through here — account creation is light,
// the cycle is the commitment (owner decision: registration has gravity).
export default async function JoinCyclePage({
  params,
  searchParams,
}: {
  params: Promise<{ cycle_id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { cycle_id } = await params;
  const { from } = await searchParams;
  const cycleId = parseInt(cycle_id, 10);
  if (isNaN(cycleId)) redirect("/cycles");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const serviceClient = createServiceClient();

  const { data: participant } = await serviceClient
    .from("participants")
    .select("id, first_name, last_name, preferred_name")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!participant) redirect("/register");

  const { data: cycle } = await serviceClient
    .from("cycles")
    .select("id, name, status")
    .eq("id", cycleId)
    .single();

  if (!cycle || cycle.status !== "active") redirect("/cycles");

  // Already signed → the ceremony opens on the confirmation, not the pitch.
  const { data: agreement } = await serviceClient
    .from("cycle_agreements")
    .select("id, signed_at")
    .eq("participant_id", participant.id)
    .eq("cycle_id", cycleId)
    .maybeSingle();

  // Pod-registration window drives the confirmation's primary CTA.
  const { data: config } = await serviceClient
    .from("cycle_config")
    .select("pod_registration_open, pod_registration_close")
    .eq("cycle_id", cycleId)
    .maybeSingle();

  const now = new Date();
  const podRegistrationOpen =
    !!config?.pod_registration_open &&
    !!config?.pod_registration_close &&
    now >= new Date(config.pod_registration_open) &&
    now <= new Date(config.pod_registration_close);

  const fullName = `${participant.first_name} ${participant.last_name}`.trim();

  return (
    <CycleCeremony
      cycleId={cycleId}
      cycleName={cycle.name}
      fullName={fullName}
      fromSignup={from === "signup"}
      alreadySigned={!!agreement}
      signedAt={agreement?.signed_at ?? null}
      podRegistrationOpen={podRegistrationOpen}
    />
  );
}
