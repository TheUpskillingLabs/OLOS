import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { hasPlaceholderName } from "@/lib/participants/placeholder";
import { EDITABLE_OPTION_LISTS } from "@/lib/validations/participants-update";
import ProfileEditForm from "./profile-edit-form";

// Allow only same-origin relative paths in the `next` query param so the
// redirect cannot be hijacked to push users at an arbitrary external URL.
function safeNextPath(raw: string | undefined): string {
  if (!raw) return "/dashboard";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProfileEditPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const requiredParam = Array.isArray(params.required)
    ? params.required[0]
    : params.required;
  const nextParam = Array.isArray(params.next) ? params.next[0] : params.next;

  // Mode B fires when the layout redirect sends a placeholder-name
  // participant here with ?required=true. Mode A is the voluntary path
  // (clicking "Edit profile" from /profile or nav).
  const required = requiredParam === "true";
  const nextPath = safeNextPath(nextParam);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Service client so we can read fields the cookie-bound client's RLS
  // would scope away. We're only displaying the participant's own row
  // (auth_user_id match below) so there's no cross-account exposure.
  const serviceClient = createServiceClient();
  const { data: participant } = await serviceClient
    .from("participants")
    .select(
      `id, email, first_name, last_name, preferred_name, headline, bio, handle,
       state, neighborhood, dcpl_card, zip, work_situation, main_focus,
       sector, current_title, linkedin, primary_expertise, ai_tool_familiarity,
       role_intents, profile_image_url`
    )
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!participant) redirect("/register");

  // The member's current multiselect answers + the available choices, both
  // grouped by list_name (the whole profile is editable).
  const [{ data: chosen }, { data: allOptions }] = await Promise.all([
    serviceClient
      .from("participant_options")
      .select("option_id, option_lists(list_name)")
      .eq("participant_id", participant.id),
    serviceClient
      .from("option_lists")
      .select("id, list_name, value, display_order")
      .eq("active", true)
      .order("display_order"),
  ]);

  const optionLists: Record<string, { id: number; value: string }[]> = {};
  for (const row of allOptions ?? []) {
    if (!EDITABLE_OPTION_LISTS.includes(row.list_name as never)) continue;
    (optionLists[row.list_name] ??= []).push({ id: row.id, value: row.value });
  }

  const selectedOptions: Record<string, number[]> = {};
  for (const o of chosen ?? []) {
    const list = (o.option_lists as unknown as { list_name?: string })?.list_name;
    // Only editable lists reach the form — a non-editable list_name (e.g.
    // pulse_benefits) would fail the route's .strict() options schema.
    if (!list || !EDITABLE_OPTION_LISTS.includes(list as never)) continue;
    (selectedOptions[list] ??= []).push(o.option_id);
  }

  const placeholder = hasPlaceholderName(
    participant.first_name,
    participant.last_name
  );

  const googleAvatar =
    (user.user_metadata?.avatar_url as string | undefined) ||
    (user.user_metadata?.picture as string | undefined) ||
    null;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-card border border-ink/10 bg-white p-6 shadow-card sm:p-8">
        <header className="border-b border-ink/10 pb-4">
          <h1 className="t-h2 text-ink">
            {required ? "Complete your profile to continue" : "Edit profile"}
          </h1>
          {required && placeholder && (
            <p className="mt-2 text-sm text-charcoal">
              We don&apos;t have your name on file yet. Please enter your first
              and last name below — you&apos;ll be returned to where you were
              headed once we save it.
            </p>
          )}
          {required && !placeholder && (
            <p className="mt-2 text-sm text-charcoal">
              Please review and confirm your profile to continue.
            </p>
          )}
          {!required && (
            <p className="mt-2 text-sm text-slate">
              Edit everything on your profile — photo, bio, location, and the
              rest.
            </p>
          )}
        </header>

        <ProfileEditForm
          participantId={participant.id}
          initial={{
            first_name: participant.first_name ?? "",
            last_name: participant.last_name ?? "",
            preferred_name: participant.preferred_name ?? "",
            headline: participant.headline ?? "",
            bio: participant.bio ?? "",
            handle: participant.handle ?? "",
            state: participant.state ?? "",
            neighborhood: participant.neighborhood ?? "",
            dcpl_card: participant.dcpl_card ?? "",
            zip: participant.zip ?? "",
            work_situation: participant.work_situation ?? "",
            main_focus: participant.main_focus ?? "",
            sector: participant.sector ?? "",
            current_title: participant.current_title ?? "",
            linkedin: participant.linkedin ?? "",
            primary_expertise: participant.primary_expertise ?? "",
            ai_tool_familiarity: participant.ai_tool_familiarity
              ? String(participant.ai_tool_familiarity)
              : "",
            role_intents: participant.role_intents ?? [],
            avatarUrl: participant.profile_image_url ?? googleAvatar,
            initials:
              `${(participant.first_name ?? "")[0] ?? ""}${(participant.last_name ?? "")[0] ?? ""}`.toUpperCase(),
          }}
          optionLists={optionLists}
          selectedOptions={selectedOptions}
          required={required}
          nextPath={nextPath}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}
