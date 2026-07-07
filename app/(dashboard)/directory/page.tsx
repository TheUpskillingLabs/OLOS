import Link from "next/link";
import { MapPin } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getFollowedTargetKeys } from "@/lib/follows/queries";
import DirectoryGrid from "./directory-grid";
import UpdatesFeed from "./updates-feed";

/**
 * /directory — the community directory (roadmap Phase 2). Members-only: the
 * (dashboard)/layout.tsx guard gates the whole route group, and the weekly
 * Learning-Log gate applies (locked members bounce Home).
 *
 * Security: we read the display-column allowlist via the SERVICE client — never
 * a widened participants RLS. No PII column (email, phone, zip, dcpl_card,
 * notes, google_id) is selected. Test accounts are excluded.
 */

export const dynamic = "force-dynamic";

const DISPLAY_COLUMNS =
  "id, handle, preferred_name, first_name, last_name, headline, primary_expertise, role_intents, profile_image_url, metro_slug, is_test";

export interface DirectoryMember {
  id: number;
  handle: string | null;
  displayName: string;
  firstInitial: string;
  lastInitial: string;
  headline: string | null;
  primary_expertise: string | null;
  role_intents: string[];
  profile_image_url: string | null;
  metroName: string | null;
}

export interface DirectoryEntity {
  id: number;
  kind: "pod" | "project";
  name: string;
  tagline: string | null;
  status: string;
  logo_url: string | null;
}

export default async function DirectoryPage() {
  const service = createServiceClient();
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();

  const [
    { data: rows, error: rowsErr },
    { data: metros },
    { data: podRows },
    { data: projectRows },
  ] = await Promise.all([
    service
      .from("participants")
      .select(DISPLAY_COLUMNS)
      // Members only — internal (test + staff) accounts are hidden everywhere
      // else in the app (the Poderator's visibleMembers()); match that here.
      .eq("is_test", false)
      .eq("is_staff", false)
      .order("created_at", { ascending: false }),
    service.from("metros").select("slug, name, st"),
    // Directory inclusion is opt-in per entity (00060). Read a fixed display
    // allowlist via the service client — same posture as the participants read.
    service
      .from("pods")
      .select("id, name, tagline, status, logo_url")
      .eq("directory_visible", true)
      .order("name"),
    service
      .from("projects")
      .select("id, name, tagline, status, logo_url")
      .eq("directory_visible", true)
      .order("name"),
  ]);

  // Surface a failed read instead of silently rendering an empty directory — a
  // 400 (e.g. a drifted/renamed column) otherwise looks exactly like "no
  // members." Logs to the server (Vercel), never to the client.
  if (rowsErr) {
    console.error("[directory] participants query failed:", rowsErr.message);
  }

  // The viewer's follow-set powers the Following filter + card state. One query;
  // reads only the viewer's own rows.
  let followedKeys: string[] = [];
  if (user) {
    const { data: p } = await service
      .from("participants")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (p?.id) followedKeys = [...(await getFollowedTargetKeys(service, p.id))];
  }

  const metroBySlug = new Map<string, string>();
  for (const m of metros ?? []) {
    metroBySlug.set(m.slug, [m.name, m.st].filter(Boolean).join(", "));
  }

  const members: DirectoryMember[] = (rows ?? []).map((m) => ({
    id: m.id,
    handle: m.handle,
    displayName:
      m.preferred_name || `${m.first_name} ${m.last_name}`.trim() || "A member",
    firstInitial: m.first_name?.[0] ?? "",
    lastInitial: m.last_name?.[0] ?? "",
    headline: m.headline ?? null,
    primary_expertise: m.primary_expertise ?? null,
    role_intents: m.role_intents ?? [],
    profile_image_url: m.profile_image_url ?? null,
    metroName: m.metro_slug ? (metroBySlug.get(m.metro_slug) ?? null) : null,
  }));

  const pods: DirectoryEntity[] = (podRows ?? []).map((p) => ({
    id: p.id,
    kind: "pod",
    name: p.name || `Pod ${p.id}`,
    tagline: p.tagline ?? null,
    status: p.status,
    logo_url: p.logo_url ?? null,
  }));

  const projects: DirectoryEntity[] = (projectRows ?? []).map((p) => ({
    id: p.id,
    kind: "project",
    name: p.name || `Project ${p.id}`,
    tagline: p.tagline ?? null,
    status: p.status,
    logo_url: p.logo_url ?? null,
  }));

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="t-h1 text-ink">Directory</h1>
          <p className="mt-1 t-small">Find your people. Build your edge.</p>
        </div>
        <Link
          href="/local-labs"
          className="inline-flex items-center gap-1.5 rounded-card border border-ink/10 bg-white px-3.5 py-2 text-sm font-medium text-teal-deep shadow-card transition-colors duration-150 hover:border-teal/40 hover:text-ink"
        >
          <MapPin className="h-4 w-4" aria-hidden />
          Cities
        </Link>
      </header>

      <DirectoryGrid
        members={members}
        pods={pods}
        projects={projects}
        followedKeys={followedKeys}
      />

      <UpdatesFeed />
    </div>
  );
}
