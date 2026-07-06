import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/app/components/ui";

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
      <div className="rounded-card border border-ink/10 bg-white p-6 shadow-card sm:p-8">
        {/* Header with avatar */}
        <div className="flex items-center gap-6 border-b border-ink/10 pb-6">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="h-20 w-20 rounded-full ring-1 ring-ink/10"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-teal-deep text-2xl font-bold text-white">
              {participant.first_name[0]}
              {participant.last_name[0]}
            </div>
          )}
          <div>
            <h1 className="t-h1 text-ink">
              {displayName}
            </h1>
            <p className="text-sm text-charcoal">{participant.email}</p>
            {participant.current_title && (
              <p className="mt-1 text-sm text-charcoal">
                {participant.current_title}
              </p>
            )}
            <p className="mt-1 text-xs text-meta tabular-nums">
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
          {participant.state && (
            <Section title="Location">
              <Field label="State" value={participant.state} />
            </Section>
          )}

          {/* Professional */}
          {(participant.work_situation ||
            participant.main_focus ||
            participant.sector ||
            participant.linkedin) && (
            <Section title="Professional context">
              {participant.work_situation && (
                <Field label="Work Situation" value={participant.work_situation} />
              )}
              {participant.main_focus && (
                <Field label="Main Focus" value={participant.main_focus} />
              )}
              {participant.sector && (
                <Field label="Sector" value={participant.sector} />
              )}
              {participant.linkedin && (
                <Field label="LinkedIn" value={participant.linkedin} isLink />
              )}
            </Section>
          )}

          {/* AI Background */}
          {(participant.ai_tool_familiarity != null || grouped.ai_tools) && (
            <Section title="AI background">
              {participant.ai_tool_familiarity != null && (
                <Field
                  label="Tool Familiarity"
                  value={`${participant.ai_tool_familiarity} / 5`}
                />
              )}
              {grouped.ai_tools && (
                <Field label="Tools Used" value={grouped.ai_tools.join(", ")} />
              )}
            </Section>
          )}

          {/* Cycle Enrollments */}
          {enrollments && enrollments.length > 0 && (
            <Section title="Cycle enrollments">
              <div className="space-y-2">
                {enrollments.map((e) => {
                  const cycle = e.cycles as unknown as Record<string, unknown>;
                  return (
                    <div
                      key={e.cycle_id}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="text-sm text-charcoal">
                        {(cycle?.name as string) || `Cycle ${e.cycle_id}`}
                      </span>
                      <StatusBadge
                        variant={e.status === "active" ? "active" : "inactive"}
                      >
                        {e.status}
                      </StatusBadge>
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
      <h2 className="lbl mb-3">
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
  value: string | null | undefined;
  isLink?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-baseline gap-3">
      <span className="w-32 shrink-0 text-sm text-meta">{label}</span>
      {isLink ? (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-sm text-teal-deep transition-colors duration-150 hover:text-ink hover:underline focus-visible:outline-none focus-visible:text-ink"
        >
          {value}
        </a>
      ) : (
        <span className="text-sm text-charcoal">{value}</span>
      )}
    </div>
  );
}
