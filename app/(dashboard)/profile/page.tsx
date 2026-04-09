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

  const displayName =
    participant.preferred_name ||
    `${participant.first_name} ${participant.last_name}`;

  // Avatar from Google OAuth metadata
  const avatarUrl: string | null = user.user_metadata?.avatar_url ?? null;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-md border border-whisper bg-white/[0.02] p-8">
        {/* Header with avatar */}
        <div className="flex items-center gap-6 border-b border-whisper pb-6">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="h-20 w-20 rounded-full"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-md bg-shadow text-2xl font-bold text-cloud">
              {participant.first_name[0]}
              {participant.last_name[0]}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white">
              {displayName}
            </h1>
            <p className="text-sm text-cloud/60">
              {participant.email}
            </p>
            {participant.current_title && (
              <p className="mt-1 text-sm text-cloud">
                {participant.current_title}
              </p>
            )}
            <p className="mt-1 text-xs text-cloud/60">
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
          <Section title="Professional context">
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
          <Section title="AI background">
            <Field
              label="Tool Familiarity"
              value={`${participant.ai_tool_familiarity} / 5`}
            />
            {grouped.ai_tools && (
              <Field label="Tools Used" value={grouped.ai_tools.join(", ")} />
            )}
          </Section>

          {/* Labs Fit */}
          <Section title="Labs fit">
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
            <Section title="Cycle enrollments">
              <div className="space-y-2">
                {enrollments.map((e) => {
                  const cycle = e.cycles as unknown as Record<string, unknown>;
                  return (
                    <div
                      key={e.cycle_id}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm text-cloud">
                        {(cycle?.name as string) || `Cycle ${e.cycle_id}`}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          e.status === "active"
                            ? "bg-teal/20 text-aqua"
                            : "bg-white/10 text-cloud/60"
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
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-cloud/60">
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
      <span className="w-32 shrink-0 text-sm text-cloud/60">
        {label}
      </span>
      {isLink ? (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-aqua hover:underline"
        >
          {value}
        </a>
      ) : (
        <span className="text-sm text-cloud">
          {value}
        </span>
      )}
    </div>
  );
}
