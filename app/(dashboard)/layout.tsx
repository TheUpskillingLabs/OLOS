import Link from "next/link";
import { headers } from "next/headers";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { resolveUserRoles, isAdmin, isModerator, can } from "@/lib/auth/roles";
import { hasPlaceholderName } from "@/lib/participants/placeholder";
import LogoutButton from "./components/logout-button";
import { copy as pulseCopy } from "./pulse-check/copy";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

type EnforcementStatus = "ok" | "warning_3day" | "warning_1day" | "overdue";

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
  const adminUser = isAdmin(userRoles);
  const moderatorUser = isModerator(userRoles);
  const showPods = can(userRoles, "pods:read") || moderatorUser;

  const displayName =
    participant?.preferred_name ||
    (participant
      ? `${participant.first_name} ${participant.last_name}`
      : user.email);

  // Avatar comes from Google OAuth metadata — no DB column needed
  const avatarUrl: string | null = user.user_metadata?.avatar_url ?? null;
  const initials = participant
    ? `${participant.first_name[0]}${participant.last_name[0]}`
    : (user.email?.[0] ?? "?").toUpperCase();

  const navLinkClass =
    "text-sm text-cloud transition-colors duration-150 ease-out hover:text-aqua " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal " +
    "focus-visible:ring-offset-2 focus-visible:ring-offset-midnight rounded-sm";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-whisper bg-[rgba(42,49,66,0.97)] backdrop-blur-sm backdrop-saturate-150">
        <div className="mx-auto flex h-[60px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/dashboard"
            className="text-sm font-semibold tracking-wide text-white"
          >
            The Upskilling Labs
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/dashboard" className={navLinkClass}>
              Dashboard
            </Link>
            {hasEnrollment && (
              <Link href="/cycles" className={navLinkClass}>
                Cycles
              </Link>
            )}
            {hasEnrollment && (
              <PulseCheckNavLink status={enforcementStatus} />
            )}
            {showPods && (
              <Link href="/moderator" className={navLinkClass}>
                {moderatorUser ? "Poderator" : "All pods"}
              </Link>
            )}
            {adminUser && (
              <Link href="/admin" className={navLinkClass}>
                Admin
              </Link>
            )}
            <Link
              href="/profile"
              className={`flex items-center gap-2 ${navLinkClass}`}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-shadow-teal text-xs font-semibold text-white">
                {initials}
              </span>
              <span className="hidden sm:inline truncate max-w-[150px]">{displayName}</span>
            </Link>
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}

function PulseCheckNavLink({ status }: { status: EnforcementStatus }) {
  const styles: Record<EnforcementStatus, { wrap: string; dot: string; label: string }> = {
    ok: {
      wrap: "bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20",
      dot: "bg-yellow-300",
      label: pulseCopy.nav.ok,
    },
    warning_3day: {
      wrap: "bg-yellow-500/15 text-yellow-200 hover:bg-yellow-500/25",
      dot: "bg-yellow-300",
      label: pulseCopy.nav.threeDay,
    },
    warning_1day: {
      wrap: "bg-red/15 text-red-300 hover:bg-red/25",
      dot: "bg-red-300",
      label: pulseCopy.nav.oneDay,
    },
    overdue: {
      wrap: "bg-red text-white hover:bg-crimson shadow-[0_2px_8px_rgba(238,28,37,0.18)]",
      dot: "bg-white",
      label: pulseCopy.nav.overdue,
    },
  };
  const s = styles[status];
  return (
    <Link
      href="/pulse-check"
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight ${s.wrap}`}
    >
      <span className="relative flex h-2 w-2" aria-hidden>
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${s.dot}`}
        />
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${s.dot}`}
        />
      </span>
      {s.label}
    </Link>
  );
}
