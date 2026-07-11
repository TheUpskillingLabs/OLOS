import { notFound } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import MemberProfileView from "../../profile/member-profile-view";
import UpdatesFeed from "../../directory/updates-feed";
import FollowButton from "@/app/components/follow-button";
import { isFollowing } from "@/lib/follows/data";
import { metroLabel } from "@/lib/metros-label";

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
    metroName = metro ? metroLabel(metro.name, metro.st) : null;
  }

  // Cycle enrollments (membership is visible within the members-only directory).
  const { data: enrollments } = await service
    .from("cycle_enrollments")
    .select("cycle_id, status, cycles(name)")
    .eq("participant_id", member.id);

  const displayName =
    member.preferred_name || `${member.first_name} ${member.last_name}`;

  // Resolve the viewer to seed the Follow button (hidden on your own profile).
  let viewerId: number | null = null;
  {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: me } = await service
        .from("participants")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      viewerId = me?.id ?? null;
    }
  }
  const canFollow = viewerId != null && viewerId !== member.id;
  const followingMember =
    viewerId != null && viewerId !== member.id
      ? await isFollowing(service, viewerId, { type: "user", id: member.id })
      : false;

  // Follower count — the audience this member's public updates reach.
  const { count: followerCount } = await service
    .from("follows")
    .select("id", { head: true, count: "exact" })
    .eq("followee_participant_id", member.id);

  return (
    <MemberProfileView
      mode="visitor"
      followSlot={
        <span className="flex items-center gap-3">
          <span className="text-sm text-meta tabular-nums">
            {followerCount ?? 0}{" "}
            {followerCount === 1 ? "follower" : "followers"}
          </span>
          {canFollow && (
            <FollowButton
              type="user"
              id={member.id}
              initialFollowing={followingMember}
              refreshOnChange
            />
          )}
        </span>
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
