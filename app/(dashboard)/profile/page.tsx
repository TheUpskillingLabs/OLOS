import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";

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
    .select(
      `id, email, first_name, last_name, preferred_name, gender,
       state, neighborhood, dcpl_card,
       work_situation, main_focus, sector, current_title, linkedin,
       ai_tool_familiarity, participation_commitment, primary_expertise, volunteer_interest,
       created_at`
    )
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

  const displayName =
    participant.preferred_name ||
    `${participant.first_name} ${participant.last_name}`;

  // Avatar from Google OAuth metadata
  const avatarUrl: string | null = user.user_metadata?.avatar_url ?? null;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
        {/* Header with avatar */}
        <div className="flex items-center gap-6 border-b border-zinc-200 pb-6 dark:border-zinc-800">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="h-20 w-20 rounded-full"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-200 text-2xl font-bold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
              {participant.first_name[0]}
              {participant.last_name[0]}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {displayName}
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {participant.email}
            </p>
            {participant.current_title && (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                {participant.current_title}
              </p>
            )}
            <p className="mt-1 text-xs text-zinc-400">
              Upskiller since{" "}
              {new Date(participant.created_at).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        {/* Profile sections */}
        <div className="mt-6 space-y-6">
          {/* Location */}
          <Section title="Location">
            <Field label="State" value={participant.state} />
            <Field label="Neighborhood" value={participant.neighborhood} />
            <Field label="DCPL Card" value={participant.dcpl_card} />
          </Section>

          {/* Professional */}
          <Section title="Professional Context">
            <Field label="Work Situation" value={participant.work_situation} />
            <Field label="Main Focus" value={participant.main_focus} />
            {participant.sector && (
              <Field label="Sector" value={participant.sector} />
            )}
            {participant.linkedin && (
              <Field label="LinkedIn" value={participant.linkedin} isLink />
            )}
          </Section>

          {/* AI Background */}
          <Section title="AI Background">
            <Field
              label="Tool Familiarity"
              value={`${participant.ai_tool_familiarity} / 5`}
            />
            {grouped.ai_tools && (
              <Field label="Tools Used" value={grouped.ai_tools.join(", ")} />
            )}
          </Section>

          {/* Labs Fit */}
          <Section title="Labs Fit">
            {grouped.labs_goals && (
              <Field label="Goals" value={grouped.labs_goals.join(", ")} />
            )}
            {grouped.availability && (
              <Field
                label="Availability"
                value={grouped.availability.join(", ")}
              />
            )}
            {grouped.work_style && (
              <Field
                label="Work Style"
                value={grouped.work_style.join(", ")}
              />
            )}
            {grouped.group_strengths && (
              <Field
                label="Strengths"
                value={grouped.group_strengths.join(", ")}
              />
            )}
            {participant.primary_expertise && (
              <Field
                label="Primary Expertise"
                value={participant.primary_expertise}
              />
            )}
          </Section>

          {/* Cycle Enrollments */}
          {enrollments && enrollments.length > 0 && (
            <Section title="Cycle Enrollments">
              <div className="space-y-2">
                {enrollments.map((e) => {
                  const cycle = e.cycles as unknown as Record<string, unknown>;
                  return (
                    <div
                      key={e.cycle_id}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">
                        {(cycle?.name as string) || `Cycle ${e.cycle_id}`}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          e.status === "active"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {e.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  isLink,
}: {
  label: string;
  value: string;
  isLink?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="w-32 shrink-0 text-sm text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      {isLink ? (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          {value}
        </a>
      ) : (
        <span className="text-sm text-zinc-800 dark:text-zinc-200">
          {value}
        </span>
      )}
    </div>
  );
}
