import Link from "next/link";
import { headers } from "next/headers";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { resolveUserRoles, isAdmin, isModerator, can } from "@/lib/auth/roles";
import LogoutButton from "./components/logout-button";

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
  const hdrs = await headers();
  const pathname =
    hdrs.get("x-pathname") ||
    hdrs.get("x-invoke-path") ||
    hdrs.get("next-url") ||
    "";
  if (
    enforcementStatus === "overdue" &&
    !pathname.startsWith("/pulse-check") &&
    !pathname.startsWith("/api/")
  ) {
    redirect("/pulse-check");
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

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-whisper bg-[rgba(11,16,22,0.97)]">
        <div className="mx-auto flex h-[60px] max-w-7xl items-center justify-between px-4">
          <Link
            href="/cycles"
            className="text-lg font-bold text-white"
          >
            The Upskilling Labs
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              href="/cycles"
              className="text-sm text-cloud transition-colors hover:text-aqua"
            >
              Cycles
            </Link>
            <PulseCheckNavLink status={enforcementStatus} />
            {showPods && (
              <Link
                href="/moderator"
                className="text-sm text-cloud transition-colors hover:text-aqua"
              >
                My Pods
              </Link>
            )}
            {adminUser && (
              <Link
                href="/admin"
                className="text-sm text-cloud transition-colors hover:text-aqua"
              >
                Admin
              </Link>
            )}
            <Link
              href="/profile"
              className="flex items-center gap-2 text-sm text-cloud transition-colors hover:text-aqua"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName ?? ""}
                  className="h-7 w-7 rounded-full"
                />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded bg-shadow text-xs font-medium text-cloud">
                  {initials}
                </span>
              )}
              <span className="hidden sm:inline">{displayName}</span>
            </Link>
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}

function PulseCheckNavLink({ status }: { status: EnforcementStatus }) {
  const styles: Record<EnforcementStatus, { wrap: string; dot: string; label: string }> = {
    ok: {
      wrap: "bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20",
      dot: "bg-yellow-400",
      label: "Pulse Check",
    },
    warning_3day: {
      wrap: "bg-orange-500/15 text-orange-300 hover:bg-orange-500/25",
      dot: "bg-orange-400",
      label: "Due in 3 days",
    },
    warning_1day: {
      wrap: "bg-red-500/15 text-red-300 hover:bg-red-500/25",
      dot: "bg-red-400",
      label: "Due tomorrow",
    },
    overdue: {
      wrap: "bg-red-500 text-white hover:bg-red-600",
      dot: "bg-white",
      label: "Overdue — Submit Now",
    },
  };
  const s = styles[status];
  return (
    <Link
      href="/pulse-check"
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-colors ${s.wrap}`}
    >
      <span className={`inline-block h-1.5 w-1.5 animate-pulse rounded-full ${s.dot}`} />
      {s.label}
    </Link>
  );
}
