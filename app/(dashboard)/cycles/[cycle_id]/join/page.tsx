import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { windowOpen, fmtLabDateTime } from "@/lib/cycles/lab-time";
import { registrationWindow } from "@/lib/cycles/schedule";
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
    .select("id, first_name, last_name, preferred_name, metro_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!participant) redirect("/register");

  // Active-lab gate (docs/LOCAL_LABS.md — the membership spine): only members
  // of an ACTIVE Local Lab can register for a cycle. Waitlisted or lab-less
  // members are sent to pick/start a lab before any ceremony renders.
  if (!participant.metro_id) redirect("/local-labs");
  const { data: memberLab } = await serviceClient
    .from("metros")
    .select("status")
    .eq("id", participant.metro_id)
    .maybeSingle();
  if (memberLab?.status !== "active") redirect("/local-labs");

  const { data: cycle } = await serviceClient
    .from("cycles")
    .select("id, name, status, mode, lab_id")
    .eq("id", cycleId)
    .single();

  // Registration is open for the running cohort ('active') AND the next cohort
  // ('upcoming') — the Civics wave pre-registers before kickoff. The agreement
  // route writes an 'inactive' enrollment either way; the reconciler activates
  // it when the cycle starts. Anything else (draft/closed/archived) has no
  // registration ceremony.
  if (!cycle || (cycle.status !== "active" && cycle.status !== "upcoming"))
    redirect("/cycles");

  // Org cycles (docs/ORG_CYCLES.md) are invite-only — no self-serve join
  // ceremony. Redirect before any interest/agreement UI renders.
  if (cycle.mode === "org") redirect("/cycles");

  // Sub-cohort model (docs/LOCAL_LABS.md, 00067): the joinable participant
  // cycle is the single HQ one (live open cycles are lab_id NULL by the
  // cycles_open_is_hq_when_live CHECK), so this guard never fires for it —
  // it remains as defense-in-depth against deep links into residual or
  // historical per-lab cycles. Members with no metro are never blocked.
  if (cycle.lab_id !== null && cycle.lab_id !== participant.metro_id) {
    redirect("/cycles");
  }

  // Already signed → the ceremony opens on the confirmation, not the pitch.
  const { data: agreement } = await serviceClient
    .from("cycle_agreements")
    .select("id, signed_at")
    .eq("participant_id", participant.id)
    .eq("cycle_id", cycleId)
    .maybeSingle();

  // D-10 gate (docs/requirements/pod-registration.md, owner 2026-07-12):
  // self-serve registration is open only while a new member can still land
  // in a pod — through pod-forming close, and again during the active-join
  // window. Members who already signed pass through to their confirmation;
  // the agreement API enforces the same rule server-side, this is the
  // friendly surface for it.
  if (!agreement) {
    const regWindow = await registrationWindow(serviceClient, cycleId);
    if (!regWindow.open) {
      return (
        <div className="mx-auto max-w-xl py-12">
          <div className="rounded-card border border-ink/10 bg-white p-8 shadow-card">
            <div className="lbl mb-2">Registration closed</div>
            <h1 className="t-h2 text-ink">{cycle.name}</h1>
            <p className="mt-3 text-meta">
              {regWindow.state === "dead_zone" && regWindow.reopensAt
                ? `Pods are forming right now, so registration is paused. It reopens ${fmtLabDateTime(
                    regWindow.reopensAt.toISOString()
                  )}, when pods open to new members — check back then.`
                : "Registration for this cycle has closed. Keep an eye out for the next Build Cycle."}
            </p>
            <Link
              href="/cycles"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold tracking-tight text-teal-deep hover:underline"
            >
              Back to cycles
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      );
    }
  }

  // Pod-registration window drives the confirmation's primary CTA.
  const { data: config } = await serviceClient
    .from("cycle_config")
    .select("pod_registration_open, pod_registration_close")
    .eq("cycle_id", cycleId)
    .maybeSingle();

  // Naive window columns are UTC instants (lib/cycles/lab-time.ts).
  const podRegistrationOpen = windowOpen(
    config?.pod_registration_open,
    config?.pod_registration_close
  );

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
