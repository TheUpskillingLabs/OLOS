import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { resolveUserRoles, isAdmin } from "@/lib/auth/roles";
import StoriesAdmin, { type AdminSpotlight } from "./stories-admin";

/* Admin review of Upskiller Spotlights — submissions land here (status
   'submitted'); the Labs team enriches the editorial fields and publishes to
   /stories. Same admin guard as the rest of /admin. */

export const dynamic = "force-dynamic";

export default async function AdminStoriesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const userRoles = await resolveUserRoles(service, user.id);
  if (!isAdmin(userRoles)) redirect("/cycles");

  const { data } = await service
    .from("spotlights")
    .select(
      "id, slug, name, role, tag, tag_label, quote, story, grad, submitter_email, status, sort_order, created_at"
    )
    .order("created_at", { ascending: false });

  const rows = (data as AdminSpotlight[]) ?? [];

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm text-meta transition-colors duration-150 hover:text-teal-deep"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Admin
        </Link>
        <h1 className="t-h1 mt-2 text-ink">Upskiller Spotlights</h1>
        <p className="mt-1 text-sm text-meta">
          Review submissions, edit the story, and publish to the public /stories page.
        </p>
      </div>
      <StoriesAdmin initial={rows} />
    </div>
  );
}
