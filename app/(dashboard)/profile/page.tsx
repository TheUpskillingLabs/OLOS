import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getFollowerCount, getFollowingCount } from "@/lib/follows/queries";
import { resolveAvatarUrl } from "@/lib/participants/avatar";
import MemberProfileView from "./member-profile-view";
import UpdatesFeed from "../directory/updates-feed";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const serviceClient = createServiceClient();
  const { data: participant } = await serviceClient
    .from("participants")
    .select("*")
    .eq("auth_user_id", user.id)
    .single();

  if (!participant) {
    redirect("/register");
  }

  // Fetch multiselect options
  const { data: options } = await serviceClient
    .from("participant_options")
    .select("option_id, option_lists(id, list_name, value)")
    .eq("participant_id", participant.id);

  const grouped: Record<string, string[]> = {};
  for (const o of options || []) {
    const opt = o.option_lists as unknown as Record<string, unknown>;
    const listName = opt?.list_name as string;
    if (!grouped[listName]) grouped[listName] = [];
    grouped[listName].push(opt?.value as string);
  }

  // Fetch cycle enrollments
  const { data: enrollments } = await serviceClient
    .from("cycle_enrollments")
    .select("cycle_id, status, cycles(name)")
    .eq("participant_id", participant.id);

  // Resolve the metro display name (metro_slug → metros.name).
  let metroName: string | null = null;
  if (participant.metro_slug) {
    const { data: metro } = await serviceClient
      .from("metros")
      .select("name, st")
      .eq("slug", participant.metro_slug)
      .maybeSingle();
    metroName = metro ? [metro.name, metro.st].filter(Boolean).join(", ") : null;
  }

  const [followerCount, followingCount] = await Promise.all([
    getFollowerCount(serviceClient, "participant", participant.id),
    getFollowingCount(serviceClient, participant.id),
  ]);

  // The member's active pods & projects, linked on the profile.
  const [{ data: podRows }, { data: projRows }] = await Promise.all([
    serviceClient
      .from("pod_memberships")
      .select("pods!inner(id, name)")
      .eq("participant_id", participant.id)
      .is("inactive_at", null),
    serviceClient
      .from("project_memberships")
      .select("projects!inner(id, name)")
      .eq("participant_id", participant.id)
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
    participant.preferred_name ||
    `${participant.first_name} ${participant.last_name}`;

  // One precedence everywhere: uploaded photo → Google → initials.
  const avatarUrl = resolveAvatarUrl(participant, user);

  return (
    <MemberProfileView
      mode="owner"
      member={{
        id: participant.id,
        handle: participant.handle ?? null,
        displayName,
        firstInitial: participant.first_name?.[0] ?? "",
        lastInitial: participant.last_name?.[0] ?? "",
        avatarUrl,
        headline: participant.headline ?? null,
        bio: participant.bio ?? null,
        currentTitle: participant.current_title ?? null,
        primaryExpertise: participant.primary_expertise ?? null,
        metroName,
        roleIntents: participant.role_intents ?? [],
        createdAt: participant.created_at,
        email: participant.email,
        state: participant.state,
        neighborhood: participant.neighborhood,
        dcplCard: participant.dcpl_card,
        workSituation: participant.work_situation,
        mainFocus: participant.main_focus,
        sector: participant.sector,
        linkedin: participant.linkedin,
        aiToolFamiliarity: participant.ai_tool_familiarity,
      }}
      options={grouped}
      followerCount={followerCount}
      followingCount={followingCount}
      memberships={memberships}
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
          participantId={participant.id}
          title="Your shares"
          emptyTitle="You haven't shared anything yet"
          emptyDescription="Share a Learning Log to the community and it will appear here."
        />
      }
    />
  );
}
