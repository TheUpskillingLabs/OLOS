import { notFound } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { CycleInfo } from "@/app/components/cycle/cycle-info";
import { OsFooter } from "@/app/components/chrome/site-footers";

// Public, shareable cycle information page (no auth). Renders non-sensitive
// cycle info with a "Sign in to register" CTA — the shareable link for a wave of
// new registrants. Distinct segment (/c/[id]) so it never collides with the
// authenticated /cycles/[id] route.
export default async function PublicCyclePage({
  params,
}: {
  params: Promise<{ cycle_id: string }>;
}) {
  const { cycle_id } = await params;
  const cycleId = parseInt(cycle_id, 10);
  if (isNaN(cycleId)) notFound();

  const supabase = createServiceClient();
  const { data: cycle } = await supabase
    .from("cycles")
    .select(
      "id, name, start_date, end_date, status, description, what_you_build"
    )
    .eq("id", cycleId)
    .maybeSingle();

  // Draft cycles are not yet public.
  if (!cycle || cycle.status === "draft") notFound();

  return (
    <>
      <main className="flex-1">
        <header className="border-b border-ink/10">
          <div className="flex items-center justify-between px-6 py-4">
            <span className="font-semibold tracking-tight text-ink">
              The Upskilling Labs
            </span>
            <Link
              href="/login"
              className="text-sm font-semibold text-teal-deep hover:underline"
            >
              Sign in
            </Link>
          </div>
        </header>
        <div className="px-6 py-12">
          <CycleInfo
            cycle={cycle}
            cta={
              <Link href="/login" className="btn btn-teal btn-block">
                Sign in to register
              </Link>
            }
          />
        </div>
      </main>
      <OsFooter />
    </>
  );
}
