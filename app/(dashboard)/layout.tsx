import { headers } from "next/headers";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { resolveUserRoles, isModerator, can } from "@/lib/auth/roles";
import { canManageLifecycle } from "@/lib/auth/cycle-access";
import { hasPlaceholderName } from "@/lib/participants/placeholder";
import AppNav, { type EnforcementStatus } from "@/app/components/chrome/app-nav";
import TabBar from "@/app/components/chrome/tab-bar";
import OrbDefs from "@/app/components/chrome/orb-defs";
import FeedbackWidget from "@/app/components/feedback/feedback-widget";
import { copy as pulseCopy } from "./pulse-check/copy";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch participant profile for name + enforcement baseline
  const serviceClient = createServiceClient();
  const { data: participant } = await serviceClient
    .from("participants")
    .select("preferred_name, first_name, last_name, last_pulse_completed_at, created_at")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  // Resolve the current pathname once and use it for every redirect gate
  // below. The header order tries Next 16's canonical key first, then the
  // older invoke-path key, then a generic fallback for any edge runtime
  // that surfaces the URL under a different name.
  const hdrs = await headers();
  const pathname =
    hdrs.get("x-pathname") ||
    hdrs.get("x-invoke-path") ||
    hdrs.get("next-url") ||
    "";

  // Placeholder-name gate (architecture review broken edge #3).
  //
  // Participants with first_name='Unknown' or last_name='Unknown' must
  // complete their profile before any dashboard interaction. The migration
  // script wrote these stubs for rows missing name data; without this
  // gate they would reach /dashboard rendering as "Welcome, Unknown".
  //
  // Runs BEFORE the pulse-check enforcement because Phase B.4's submission-
  // endpoint guards will reject placeholder-name participants from pulse
  // submission anyway — they must fix their name first. Order: identity
  // first, then phase obligations.
  //
  // Skip when already on /profile/edit (would infinite-loop). The
  // ?next= query param preserves where they were headed so the form's
  // Mode B post-save handler can return them to the original path.
  if (
    participant &&
    hasPlaceholderName(participant.first_name, participant.last_name) &&
    !pathname.startsWith("/profile/edit")
  ) {
    const next = pathname || "/dashboard";
    redirect(`/profile/edit?required=true&next=${encodeURIComponent(next)}`);
  }

  // Compute pulse-check enforcement status
  let enforcementStatus: EnforcementStatus = "ok";
  if (participant) {
    const baseline = participant.last_pulse_completed_at ?? participant.created_at;
    if (baseline) {
      const deadlineMs = new Date(baseline).getTime() + SEVEN_DAYS_MS;
      const ms = deadlineMs - new Date().getTime();
      if (ms <= 0) enforcementStatus = "overdue";
      else if (ms < ONE_DAY_MS) enforcementStatus = "warning_1day";
      else if (ms <= THREE_DAYS_MS) enforcementStatus = "warning_3day";
    }
  }

  // Hard block: if overdue and not on the pulse-check page, redirect.
  if (
    enforcementStatus === "overdue" &&
    !pathname.startsWith("/pulse-check") &&
    !pathname.startsWith("/api/")
  ) {
    redirect("/pulse-check");
  }

  // Check if user has any cycle enrollment (controls nav visibility)
  const participantId = participant
    ? await serviceClient
        .from("participants")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle()
        .then((r) => r.data?.id)
    : null;

  let hasEnrollment = false;
  if (participantId) {
    const { data: enrollment } = await serviceClient
      .from("cycle_enrollments")
      .select("id")
      .eq("participant_id", participantId)
      .limit(1)
      .maybeSingle();
    hasEnrollment = !!enrollment;
  }

  const userRoles = await resolveUserRoles(serviceClient, user.id);
  // The Admin nav destination is available to anyone who can manage the
  // lifecycle — full admins/owners and metro-scoped labs leads.
  const adminUser = canManageLifecycle(userRoles);
  const moderatorUser = isModerator(userRoles);
  const showPods = can(userRoles, "pods:read") || moderatorUser;

  const displayName =
    participant?.preferred_name ||
    (participant
      ? `${participant.first_name} ${participant.last_name}`
      : user.email) ||
    "";

  const initials = participant
    ? `${participant.first_name[0]}${participant.last_name[0]}`
    : (user.email?.[0] ?? "?").toUpperCase();

  const pulseNavLabel =
    enforcementStatus === "overdue"
      ? pulseCopy.nav.overdue
      : enforcementStatus === "warning_1day"
        ? pulseCopy.nav.oneDay
        : enforcementStatus === "warning_3day"
          ? pulseCopy.nav.threeDay
          : pulseCopy.nav.ok;

  return (
    <div className="flex min-h-screen flex-col">
      <OrbDefs />
      <AppNav
        initials={initials}
        displayName={displayName}
        isAdmin={adminUser}
        isModerator={moderatorUser}
        showPods={showPods}
        hasEnrollment={hasEnrollment}
        enforcementStatus={enforcementStatus}
        pulseNavLabel={pulseNavLabel}
      />
      <main className="app-main container w-full flex-1 py-8">{children}</main>
      <TabBar initials={initials} hasEnrollment={hasEnrollment} />
      <FeedbackWidget />
    </div>
  );
}
