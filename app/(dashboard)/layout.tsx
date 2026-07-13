import { headers } from "next/headers";
import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { resolveUserRoles, isAdmin, isModerator, can } from "@/lib/auth/roles";
import { hasPlaceholderName } from "@/lib/participants/placeholder";
import { one } from "@/lib/supabase/embed";
import AppNav from "@/app/components/chrome/app-nav";
import FeedbackWidget from "@/app/components/feedback/feedback-widget";
import DashboardFooter from "@/app/components/chrome/dashboard-footer";
import { learningLogGate } from "@/lib/learning-logs/gate";

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
    .select("id, preferred_name, first_name, last_name, is_test, profile_image_url, metro_id")
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

  // The weekly Learning Log gate (Phase 1 — replaces the rolling pulse
  // timer). Fixed per-cycle window: the Friday cron arms it; saving a log
  // clears it instantly. Locked members are routed Home, where the log
  // lives — every other destination bounces. The ritual is cycle practice:
  // only active enrollees of the active cycle are ever gated.
  const participantId = participant?.id ?? null;
  const logGate = participantId
    ? await learningLogGate(participantId)
    : { active: false, armed: false, dueAt: null, cycleId: null };

  if (
    logGate.active &&
    !pathname.startsWith("/dashboard") &&
    !pathname.startsWith("/profile/edit") &&
    !pathname.startsWith("/api/") &&
    pathname !== ""
  ) {
    redirect("/dashboard");
  }

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
  const adminUser = isAdmin(userRoles);
  const moderatorUser = isModerator(userRoles);
  const showPods = can(userRoles, "pods:read") || moderatorUser;

  // The persona pill (B-2): "Co-lead" when every pod this member moderates
  // is an org workstream run, "Poderator" otherwise (participant-mode or
  // mixed) — and unchanged for admins with no moderator assignments at all.
  let coLeadOnly = false;
  if (userRoles.moderatorPodIds.length > 0) {
    const { data: moderatedPods } = await serviceClient
      .from("pods")
      .select("id, cycles(mode)")
      .in("id", userRoles.moderatorPodIds);
    coLeadOnly =
      !!moderatedPods &&
      moderatedPods.length > 0 &&
      moderatedPods.every((p) => one(p.cycles)?.mode === "org");
  }

  // Local Labs (docs/LOCAL_LABS.md): leads get a "Lab lead" entry in the
  // View-as switcher, pointing at the first lab they lead.
  let labLeadHref: string | null = null;
  if (userRoles.labLeadLabIds.length > 0) {
    const { data: leadMetro } = await serviceClient
      .from("metros")
      .select("slug")
      .in("id", userRoles.labLeadLabIds)
      .order("id")
      .limit(1)
      .maybeSingle();
    labLeadHref = leadMetro ? `/lab/${leadMetro.slug}` : null;
  }

  // Local Labs (docs/LOCAL_LABS.md — the membership spine): a member with no
  // active lab (metro_id NULL — lab-less or waitlisted) gets a non-blocking
  // prompt to pick one, since active-lab membership gates cycle participation.
  // Admins are exempt (they legitimately have no lab). No redirect — soft nudge.
  const needsLab = !!participant && !participant.metro_id && !adminUser;

  const displayName =
    participant?.preferred_name ||
    (participant
      ? `${participant.first_name} ${participant.last_name}`
      : user.email) ||
    "";

  const initials = participant
    ? `${participant.first_name[0]}${participant.last_name[0]}`
    : (user.email?.[0] ?? "?").toUpperCase();

  // The site-wide avatar: the member's photo (uploaded or Google), falling back
  // to the OAuth picture, then to initials in the chrome components.
  const avatarUrl =
    participant?.profile_image_url ||
    (user.user_metadata?.avatar_url as string | undefined) ||
    (user.user_metadata?.picture as string | undefined) ||
    null;

  return (
    <div className="flex min-h-screen flex-col">
      <AppNav
        initials={initials}
        avatarUrl={avatarUrl}
        displayName={displayName}
        isAdmin={adminUser}
        isModerator={moderatorUser}
        showPods={showPods}
        hasEnrollment={hasEnrollment}
        logDue={logGate.active}
        isTest={!!participant?.is_test}
        moderatorPersonaLabel={coLeadOnly ? "Co-lead" : "Poderator"}
        labLeadHref={labLeadHref}
      />
      {needsLab && (
        <div className="border-b border-teal/30 bg-teal/10 px-4 py-2 text-center text-sm text-ink">
          Join a Local Lab to take part in a Build Cycle.{" "}
          <Link
            href="/local-labs"
            className="font-semibold text-teal-deep hover:underline"
          >
            Choose your lab &rarr;
          </Link>
        </div>
      )}
      <main className="app-main container w-full flex-1 py-8">{children}</main>
      <DashboardFooter />
      <FeedbackWidget />
    </div>
  );
}
