import { notFound } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { resolveUserRoles } from "@/lib/auth/roles";
import {
  isFollowing,
  getFollowerCount,
  getFollowingCount,
} from "@/lib/follows/queries";
import FollowButton from "@/app/components/follow-button";
import MemberProfileView from "../../profile/member-profile-view";
import UpdatesFeed from "../../directory/updates-feed";

/**
 * /u/[handle] — a member's public-to-members profile (visitor mode).
 *
 * Security: this page fetches ONLY the display-column allowlist via the service
 * client. No PII column (email, phone, zip, dcpl_card, notes, google_id, …) is
 * ever selected, so nothing sensitive can leak through the shared view. The
 * (dashboard)/layout.tsx auth guard already gates the whole route group to
 * signed-in members; test accounts are excluded from resolution here too.
 */

const DISPLAY_COLUMNS =
  "id, handle, preferred_name, first_name, last_name, headline, bio, current_title, primary_expertise, role_intents, profile_image_url, metro_slug, created_at, is_test, is_staff";

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const service = createServiceClient();

  // Stored handles are always lowercase (the CHECK constraint + slugify enforce
  // it), so an exact lowercased match is correct — and avoids ilike treating a
  // `%`/`_` in the URL param as a wildcard that could resolve the wrong member.
  const { data: member, error: memberErr } = await service
    .from("participants")
    .select(DISPLAY_COLUMNS)
    .eq("handle", handle.toLowerCase())
    .maybeSingle();

  // A failed read (e.g. a drifted column → 400) would otherwise notFound() like
  // a missing handle; log it so it's diagnosable rather than a silent 404.
  if (memberErr) {
    console.error("[u/handle] participant query failed:", memberErr.message);
  }

  // Unknown handle, or an internal account (test/staff) — never surfaced in
  // the members-only directory, matching the grid + the Poderator's
  // visibleMembers().
  if (!member || member.is_test || member.is_staff) {
    notFound();
  }

  // Resolve the metro display name (metro_slug → metros.name).
  let metroName: string | null = null;
  if (member.metro_slug) {
    const { data: metro } = await service
      .from("metros")
      .select("name, st")
      .eq("slug", member.metro_slug)
      .maybeSingle();
    metroName = metro ? [metro.name, metro.st].filter(Boolean).join(", ") : null;
  }

  // Cycle enrollments (membership is visible within the members-only directory).
  const { data: enrollments } = await service
    .from("cycle_enrollments")
    .select("cycle_id, status, cycles(name)")
    .eq("participant_id", member.id);

  // Resolve the viewer to render their follow state (no flash) and hide the
  // button on their own profile. Follower/following counts come via the service
  // client — a self-scoped RLS read would only see the viewer's own rows.
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  const viewerRoles = user ? await resolveUserRoles(service, user.id) : null;
  const viewerId = viewerRoles?.participantId ?? null;
  const isSelf = viewerId === member.id;

  const [following, followerCount, followingCount] = await Promise.all([
    viewerId && !isSelf
      ? isFollowing(service, viewerId, "participant", member.id)
      : Promise.resolve(false),
    getFollowerCount(service, "participant", member.id),
    getFollowingCount(service, member.id),
  ]);

  // The member's active pods & projects — so a visitor can see what they build.
  const [{ data: podRows }, { data: projRows }] = await Promise.all([
    service
      .from("pod_memberships")
      .select("pods!inner(id, name)")
      .eq("participant_id", member.id)
      .is("inactive_at", null),
    service
      .from("project_memberships")
      .select("projects!inner(id, name)")
      .eq("participant_id", member.id)
      .is("left_at", null),
  ]);
  const memberships = {
    pods: (podRows ?? []).map((r) => {
      const p = r.pods as unknown as { id: number; name: string | null };
      return { id: p.id, name: p.name || `Pod ${p.id}` };
    }),
    projects: (projRows ?? []).map((r) => {
      const p = r.projects as unknown as { id: number; name: string | null };
      return { id: p.id, name: p.name || `Project ${p.id}` };
    }),
  };

  const displayName =
    member.preferred_name || `${member.first_name} ${member.last_name}`;

  return (
    <MemberProfileView
      mode="visitor"
      followerCount={followerCount}
      followingCount={followingCount}
      memberships={memberships}
      followSlot={
        viewerId && !isSelf ? (
          <FollowButton
            targetType="participant"
            targetId={member.id}
            initialFollowing={following}
            initialCount={followerCount}
          />
        ) : null
      }
      member={{
        id: member.id,
        handle: member.handle,
        displayName,
        firstInitial: member.first_name?.[0] ?? "",
        lastInitial: member.last_name?.[0] ?? "",
        avatarUrl: member.profile_image_url ?? null,
        headline: member.headline ?? null,
        bio: member.bio ?? null,
        currentTitle: member.current_title ?? null,
        primaryExpertise: member.primary_expertise ?? null,
        metroName,
        roleIntents: member.role_intents ?? [],
        createdAt: member.created_at,
      }}
      enrollments={(enrollments ?? []).map((e) => {
        const cycle = e.cycles as unknown as Record<string, unknown>;
        return {
          cycle_id: e.cycle_id,
          status: e.status,
          cycle_name: (cycle?.name as string) ?? null,
        };
      })}
      updatesSlot={
        <UpdatesFeed
          participantId={member.id}
          title={`${displayName}'s updates`}
          emptyTitle="No updates yet"
          emptyDescription={`${displayName} hasn't shared anything to the community yet.`}
        />
      }
    />
  );
}
