import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import MemberProfileView from "./member-profile-view";
import UpdatesFeed from "../directory/updates-feed";
import { metroLabel } from "@/lib/metros-label";

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
    metroName = metro ? metroLabel(metro.name, metro.st) : null;
  }

  const displayName =
    participant.preferred_name ||
    `${participant.first_name} ${participant.last_name}`;

  // Avatar: the Google OAuth photo (own session) falls back to the stored
  // profile image, then to initials in the view.
  const avatarUrl: string | null =
    user.user_metadata?.avatar_url ?? participant.profile_image_url ?? null;

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
          title="Your updates"
          emptyTitle="You haven't posted anything yet"
          emptyDescription="Post an update from your dashboard — or share a Learning Log — and it will appear here."
        />
      }
    />
  );
}
