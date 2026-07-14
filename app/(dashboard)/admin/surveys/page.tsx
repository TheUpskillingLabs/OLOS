import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { StatusBadge } from "@/app/components/ui";
import CreateSurveyForm from "./create-survey-form";

/* Admin field-survey list (SENSEMAKING_FLOW §8) — every survey instrument with
   its status + response count, linking into the question builder. */

export const dynamic = "force-dynamic";

type SurveyRow = {
  id: number;
  title: string;
  share_slug: string;
  status: "draft" | "open" | "closed";
  problem_domain: string | null;
  cycle_id: number | null;
};

const STATUS_VARIANT: Record<
  SurveyRow["status"],
  "active" | "draft" | "inactive"
> = {
  open: "active",
  draft: "draft",
  closed: "inactive",
};

export default async function AdminSurveysPage() {
  const { serviceClient } = await requireAdmin();

  const [{ data }, { data: cycleRows }] = await Promise.all([
    serviceClient
      .from("field_surveys")
      .select("id, title, share_slug, status, problem_domain, cycle_id")
      .order("id", { ascending: false }),
    serviceClient
      .from("cycles")
      .select("id, name, status")
      .order("start_date", { ascending: false }),
  ]);
  const surveys = (data as SurveyRow[] | null) ?? [];
  const cycles = (cycleRows as { id: number; name: string; status: string }[] | null) ?? [];

  // One survey per cycle (00089) — the form disables cycles already taken so
  // the conflict is visible before submit, not just at the 409.
  const takenCycleIds = new Set(
    surveys.map((s) => s.cycle_id).filter((id): id is number => id !== null)
  );
  const cycleOptions = cycles.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    hasSurvey: takenCycleIds.has(c.id),
  }));
  const cycleName = new Map(cycles.map((c) => [c.id, c.name]));

  const counts = await Promise.all(
    surveys.map(async (s) => {
      const { count } = await serviceClient
        .from("survey_responses")
        .select("id", { head: true, count: "exact" })
        .eq("field_survey_id", s.id)
        .neq("moderation_status", "rejected");
      return count ?? 0;
    })
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="t-h2 text-ink">Field surveys</h1>
          <p className="mt-1 text-sm text-meta">
            The instruments that gather field observations for each cycle. Edit
            questions, open or close a survey, and export responses.
          </p>
        </div>
        <CreateSurveyForm cycles={cycleOptions} />
      </div>

      {surveys.length === 0 ? (
        <p className="text-sm text-meta">No surveys yet — create the first one.</p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-ink/10 bg-white shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink/10 text-xs uppercase tracking-wide text-meta">
              <tr>
                <th className="px-4 py-3 font-semibold">Survey</th>
                <th className="px-4 py-3 font-semibold">Cycle</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Responses</th>
                <th className="px-4 py-3 font-semibold">Slug</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {surveys.map((s, i) => (
                <tr key={s.id} className="hover:bg-ink/[0.02]">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/surveys/${s.share_slug}`}
                      className="font-semibold text-teal-deep hover:underline"
                    >
                      {s.title}
                    </Link>
                    {s.problem_domain && (
                      <span className="block text-xs text-meta">
                        {s.problem_domain}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-meta">
                    {s.cycle_id !== null
                      ? cycleName.get(s.cycle_id) ?? `Cycle ${s.cycle_id}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge variant={STATUS_VARIANT[s.status]}>
                      {s.status}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-meta">{counts[i]}</td>
                  <td className="px-4 py-3 font-mono text-xs text-meta">
                    /survey/{s.share_slug}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
