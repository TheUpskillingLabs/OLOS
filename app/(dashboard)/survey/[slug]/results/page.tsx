import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { resolveUserRoles, isAdmin } from "@/lib/auth/roles";
import { isModeratorForCycle } from "@/lib/auth/moderator";
import { StatCard } from "@/app/components/ui";
import {
  getFieldSurveyBySlug,
  getFieldSurveyQuestions,
  RESPONSE_GOAL,
} from "@/lib/content/surveys";
import {
  getSurveyExportData,
  getSurveyAggregate,
} from "@/lib/content/survey-results";

/* Role-adaptive field-survey results (SENSEMAKING_FLOW §3). One URL, three
   audiences: admins + the survey's assigned poderators get the full response
   table + CSV export (for the Triangulator); registered cycle participants get
   an anonymized aggregate (no contact info). This surface is under /survey/*
   which the proxy treats as public, so it self-guards. */

export const dynamic = "force-dynamic";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** A hand-rolled distribution bar (no chart lib — house rule). */
function Bar({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-48 flex-shrink-0 truncate text-sm text-charcoal">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink/10">
        <div className="h-full rounded-full bg-teal" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 flex-shrink-0 text-right text-sm tabular-nums text-meta">
        {count}
      </span>
    </div>
  );
}

export default async function SurveyResultsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) redirect(`/login`);

  const survey = await getFieldSurveyBySlug(slug);
  if (!survey) notFound();

  const serviceClient = createServiceClient();
  const roles = await resolveUserRoles(serviceClient, user.id);

  const fullAccess =
    isAdmin(roles) ||
    (survey.cycle_id != null &&
      (await isModeratorForCycle(roles, survey.cycle_id)));
  // Registered cycle participants (any active enrollment) get the aggregate.
  const aggregateAccess =
    fullAccess || roles.cycleEnrollments.some((e) => e.status === "active");
  if (!aggregateAccess) notFound();

  const admin = isAdmin(roles);
  const questions = await getFieldSurveyQuestions(survey.id, {
    includeInactive: true,
  });
  const standpointLabels = new Map<string, string>(
    (
      questions.find((q) => q.response_column === "standpoint")?.config
        .options ?? []
    ).map((o) => [o.v, o.label])
  );

  const header = (
    <div className="mb-8">
      <div className="lbl lbl-teal mb-1.5">Field survey · Results</div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="t-h2 text-ink">{survey.title}</h1>
        {fullAccess && (
          <div className="flex flex-wrap gap-3">
            <a
              href={`/api/surveys/${survey.share_slug}/export`}
              download
              className="inline-flex items-center gap-1.5 rounded-card bg-teal-deep px-4 py-2 text-sm font-semibold tracking-tight text-white transition-colors duration-150 hover:bg-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
            >
              Download CSV
            </a>
            {admin && (
              <Link
                href={`/admin/surveys/${survey.share_slug}`}
                className="inline-flex items-center gap-1.5 rounded-card border border-ink/15 px-4 py-2 text-sm font-semibold tracking-tight text-charcoal transition-colors duration-150 hover:bg-ink/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
              >
                Manage survey
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // ── Full table (admins + poderators) ──────────────────────────────────────
  if (fullAccess) {
    const data = await getSurveyExportData(survey.id);
    const total = data.responses.length;
    const pending = data.responses.filter(
      (r) => r.moderation_status === "pending"
    ).length;
    const approved = data.responses.filter(
      (r) => r.moderation_status === "approved"
    ).length;
    const rows = [...data.responses].reverse().slice(0, 200);

    return (
      <div>
        {header}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <StatCard label="Responses" value={total} />
          <StatCard label="Pending review" value={pending} />
          <StatCard label="Approved" value={approved} />
        </div>

        {total === 0 ? (
          <p className="text-sm text-meta">No responses yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-card border border-ink/10 bg-white shadow-card">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-ink/10 text-xs uppercase tracking-wide text-meta">
                <tr>
                  <th className="px-4 py-3 font-semibold">Submitted</th>
                  <th className="px-4 py-3 font-semibold">Observation</th>
                  <th className="px-4 py-3 font-semibold">Standpoint</th>
                  <th className="px-4 py-3 font-semibold">Salience</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/5">
                {rows.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-meta">
                      {fmtDate(r.created_at)}
                    </td>
                    <td className="max-w-md px-4 py-3 text-charcoal">
                      {r.observation ?? <span className="text-meta">—</span>}
                    </td>
                    <td className="px-4 py-3 text-meta">
                      {(r.standpoint ?? [])
                        .map((s) => standpointLabels.get(s) ?? s)
                        .join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-meta">
                      {r.salience ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-meta">
                      {r.submitter_email ?? (r.contactable ? "—" : "anon")}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-meta">{r.moderation_status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {total > rows.length && (
              <p className="border-t border-ink/10 px-4 py-3 text-xs text-meta">
                Showing the latest {rows.length} of {total}. Download the CSV for
                the full set.
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Aggregate (registered participants) ───────────────────────────────────
  const agg = await getSurveyAggregate(survey.id, questions);
  const salienceMax = Math.max(1, ...agg.salience);
  const standpointMax = Math.max(1, ...agg.standpointCounts.map((c) => c.count));

  return (
    <div>
      {header}
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Observations gathered"
          value={agg.total.toLocaleString()}
          sublabel={`toward ${RESPONSE_GOAL.toLocaleString()}`}
        />
        <StatCard
          label="Shared for the commons"
          value={agg.observations.length.toLocaleString()}
          sublabel="approved & visible below"
        />
      </div>

      <section className="mb-8 rounded-card border border-ink/10 bg-white p-6 shadow-card">
        <h2 className="t-h4 mb-3 text-ink">How much this matters (salience)</h2>
        {agg.salience.every((n) => n === 0) ? (
          <p className="text-sm text-meta">No salience ratings yet.</p>
        ) : (
          [1, 2, 3, 4, 5].map((n) => (
            <Bar
              key={n}
              label={`${n} — ${n === 1 ? "in passing" : n === 5 ? "think about it a lot" : ""}`.trim()}
              count={agg.salience[n - 1]}
              max={salienceMax}
            />
          ))
        )}
      </section>

      {agg.standpointCounts.length > 0 && (
        <section className="mb-8 rounded-card border border-ink/10 bg-white p-6 shadow-card">
          <h2 className="t-h4 mb-3 text-ink">Who&apos;s speaking (standpoint)</h2>
          {agg.standpointCounts.map((c) => (
            <Bar key={c.key} label={c.label} count={c.count} max={standpointMax} />
          ))}
        </section>
      )}

      <section>
        <div className="mb-4">
          <div className="lbl lbl-teal mb-1.5">From the field</div>
          <h2 className="t-h3 text-ink">Recent observations</h2>
        </div>
        {agg.observations.length === 0 ? (
          <p className="text-sm text-meta">
            No observations have been published yet — check back as the cohort
            reviews what&apos;s come in.
          </p>
        ) : (
          <div className="grid gap-4">
            {agg.observations.map((o, i) => (
              <div
                key={i}
                className="rounded-card border border-ink/10 bg-white p-5 shadow-card"
              >
                <p className="text-sm text-charcoal">{o.observation}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-meta">
                  {o.standpoint
                    .map((s) => standpointLabels.get(s) ?? s)
                    .map((label) => (
                      <span
                        key={label}
                        className="rounded-full bg-teal/10 px-2 py-0.5 text-teal-deep"
                      >
                        {label}
                      </span>
                    ))}
                  <span className="ml-auto">{fmtDate(o.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
