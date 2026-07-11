import { ENTITY_EXPLORER_ENABLED } from "@/lib/entity-explorer/flag";
import { requireAdmin } from "@/lib/auth/guards";
import AdminNav from "./_components/admin-nav";
import { EnvBanner } from "./_components/env-banner";

/**
 * The admin shell. Owns the single admin gate (`requireAdmin()` — fails closed
 * for non-admins), the persistent section nav, and the always-on environment
 * banner so every admin page carries the PROD/DEV indicator.
 *
 * The parent (dashboard)/layout.tsx still owns the global chrome (AppNav +
 * TabBar); this nested layout only adds the admin-specific rail inside <main>.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6 md:flex-row md:gap-8">
      <AdminNav showData={ENTITY_EXPLORER_ENABLED} />
      <div className="min-w-0 flex-1">
        <EnvBanner />
        {children}
      </div>
    </div>
  );
}
