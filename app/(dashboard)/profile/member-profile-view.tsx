import Link from "next/link";
import { StatusBadge } from "@/app/components/ui";

/**
 * Shared member profile card — the single render for both `/profile` (owner)
 * and `/u/[handle]` (visitor). The prototype's `PROFILE_PANEL_HTML` mounted in
 * two modes; this mirrors that (owner decision: one markup source, two lenses).
 *
 * Security note: visitor mode NEVER receives PII. The `/u/[handle]` page fetches
 * only the display-column allowlist via the service client, so the owner-only
 * fields below simply arrive `undefined`/`null` and their sections don't render.
 * Owner mode fetches the full row. The gating here is presentational — the real
 * boundary is which columns each page selects.
 */

export const ROLE_INTENT_LABELS: Record<string, string> = {
  cycle: "Builder",
  mentor: "Mentor",
  volunteer: "Volunteer",
  events: "Community",
};

export interface MemberProfileMember {
  id: number;
  handle: string | null;
  displayName: string;
  firstInitial: string;
  lastInitial: string;
  avatarUrl: string | null;
  headline: string | null;
  bio: string | null;
  currentTitle: string | null;
  primaryExpertise: string | null;
  metroName: string | null;
  roleIntents: string[];
  createdAt: string;
  // Owner-only fields — visitor mode leaves these undefined and their sections
  // never render (the page also never selects them from the DB).
  email?: string | null;
  state?: string | null;
  neighborhood?: string | null;
  dcplCard?: string | null;
  workSituation?: string | null;
  mainFocus?: string | null;
  sector?: string | null;
  linkedin?: string | null;
  aiToolFamiliarity?: number | null;
}

export interface MemberProfileEnrollment {
  cycle_id: number;
  status: string;
  cycle_name: string | null;
}

export interface MemberProfileViewProps {
  mode: "owner" | "visitor";
  member: MemberProfileMember;
  /** Owner-only multiselect answers (ai_tools, labs_goals, …). */
  options?: Record<string, string[]>;
  enrollments?: MemberProfileEnrollment[];
  /** Rendered below the card — the member's shared Learning-Log updates. */
  updatesSlot?: React.ReactNode;
  /** Visitor-mode Nominate control (client island). */
  nominateSlot?: React.ReactNode;
}

export default function MemberProfileView({
  mode,
  member,
  options,
  enrollments,
  updatesSlot,
  nominateSlot,
}: MemberProfileViewProps) {
  const isOwner = mode === "owner";
  const grouped = options ?? {};

  return (
    <div className="mx-auto max-w-3xl">
      {/* Visitor context bar — who you're looking at + the way back. */}
      {!isOwner && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/directory"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-deep transition-colors duration-150 hover:text-ink focus-visible:outline-none focus-visible:text-ink"
          >
            <span aria-hidden>←</span> Back to the Directory
          </Link>
          {nominateSlot}
        </div>
      )}

      <div className="rounded-card border border-ink/10 bg-white p-6 shadow-card sm:p-8">
        {/* Header with avatar */}
        <div className="flex items-center gap-6 border-b border-ink/10 pb-6">
          {member.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={member.avatarUrl}
              alt={member.displayName}
              className="h-20 w-20 rounded-full object-cover ring-1 ring-ink/10"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-teal-deep text-2xl font-bold text-white">
              {member.firstInitial}
              {member.lastInitial}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="t-h1 text-ink">{member.displayName}</h1>
            {member.headline ? (
              <p className="mt-0.5 text-sm font-medium text-teal-deep">
                {member.headline}
              </p>
            ) : member.currentTitle ? (
              <p className="mt-0.5 text-sm text-charcoal">
                {member.currentTitle}
              </p>
            ) : null}
            {isOwner && member.email && (
              <p className="mt-1 text-sm text-charcoal">{member.email}</p>
            )}
            {member.metroName && (
              <p className="mt-1 text-sm text-meta">{member.metroName}</p>
            )}
            <p className="mt-1 text-xs text-meta tabular-nums">
              Upskiller since{" "}
              {new Date(member.createdAt).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </p>
            {member.roleIntents.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {member.roleIntents.map((r) => (
                  <span
                    key={r}
                    className="inline-flex items-center rounded-sm bg-teal/10 px-2.5 py-0.5 text-xs font-medium text-teal-deep"
                  >
                    {ROLE_INTENT_LABELS[r] ?? r}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Profile sections */}
        <div className="mt-6 space-y-6">
          {member.bio && (
            <Section title="About">
              <p className="whitespace-pre-line text-sm leading-relaxed text-charcoal">
                {member.bio}
              </p>
            </Section>
          )}

          {/* Public professional signal (both modes). */}
          {member.primaryExpertise && (
            <Section title="Expertise">
              <Field label="Primary" value={member.primaryExpertise} />
            </Section>
          )}

          {/* ── Owner-only PII + intake detail below ── */}
          {isOwner && (
            <>
              <Section title="Location">
                <Field label="State" value={member.state} />
                <Field label="Neighborhood" value={member.neighborhood} />
                <Field label="DCPL Card" value={member.dcplCard} />
              </Section>

              <Section title="Professional context">
                <Field label="Work Situation" value={member.workSituation} />
                <Field label="Main Focus" value={member.mainFocus} />
                <Field label="Sector" value={member.sector} />
                <Field label="LinkedIn" value={member.linkedin} isLink />
              </Section>

              <Section title="AI background">
                {member.aiToolFamiliarity != null && (
                  <Field
                    label="Tool Familiarity"
                    value={`${member.aiToolFamiliarity} / 5`}
                  />
                )}
                {grouped.ai_tools && (
                  <Field label="Tools Used" value={grouped.ai_tools.join(", ")} />
                )}
              </Section>

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
                  <Field label="Work Style" value={grouped.work_style.join(", ")} />
                )}
                {grouped.group_strengths && (
                  <Field
                    label="Strengths"
                    value={grouped.group_strengths.join(", ")}
                  />
                )}
              </Section>
            </>
          )}

          {/* Cycle enrollments — cycle membership is visible within the
              members-only directory (not PII). */}
          {enrollments && enrollments.length > 0 && (
            <Section title="Cycle enrollments">
              <div className="space-y-2">
                {enrollments.map((e) => (
                  <div
                    key={e.cycle_id}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="text-sm text-charcoal">
                      {e.cycle_name || `Cycle ${e.cycle_id}`}
                    </span>
                    <StatusBadge
                      variant={e.status === "active" ? "active" : "inactive"}
                    >
                      {e.status}
                    </StatusBadge>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>

      {updatesSlot && <div className="mt-6">{updatesSlot}</div>}
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
      <h2 className="lbl mb-3">{title}</h2>
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
