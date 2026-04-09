import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { resolveUserRoles, isAdmin } from "@/lib/auth/roles";

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

  // Fetch participant profile for name
  const serviceClient = createServiceClient();
  const { data: participant } = await serviceClient
    .from("participants")
    .select("preferred_name, first_name, last_name")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const userRoles = await resolveUserRoles(serviceClient, user.id);
  const adminUser = isAdmin(userRoles);

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
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link
            href="/cycles"
            className="text-lg font-bold text-zinc-900 dark:text-zinc-50"
          >
            The Upskilling Labs
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              href="/cycles"
              className="text-sm text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              Cycles
            </Link>
            <Link
              href="/pulse-check"
              className="text-sm text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              Pulse Check
            </Link>
            {adminUser && (
              <Link
                href="/admin"
                className="text-sm text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                Admin
              </Link>
            )}
            <Link
              href="/profile"
              className="flex items-center gap-2 text-sm text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName ?? ""}
                  className="h-7 w-7 rounded-full"
                />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                  {initials}
                </span>
              )}
              <span className="hidden sm:inline">{displayName}</span>
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
