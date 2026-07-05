import { createServiceClient } from "@/lib/supabase/server";
import { getMilestoneStatus } from "@/lib/moderator/milestone-status";
import type { RosterRow } from "@/lib/moderator/pod-detail";

/* Milestone Logs — the wk-mid/final evaluations, inside the practice (Phase 1).
   Same Learning Log flow with evaluation prompts, prefilled from the member's
   own logs; here the Poderator sees per-member submitted/open status ONLY,
   never a grade (prototype renderEvaluations() + backend §6). A milestone that
   hasn't reached its configured week reads "opens later". */

export default async function PodMilestoneLogs({
  cycleId,
  members,
}: {
  cycleId: number;
  members: RosterRow[];
}) {
  const supabase = createServiceClient();
  const realMembers = members.filter((m) => !m.is_staff_or_test);
  const nameById = new Map(
    realMembers.map((m) => [m.participant_id, m.display_name])
  );
  const initialsById = new Map(
    realMembers.map((m) => [m.participant_id, m.initials])
  );

  const status = await getMilestoneStatus(supabase, cycleId, realMembers);

  return (
    <section className="mb-6 rounded-card border border-ink/10 bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="t-h3 text-ink">Milestone Logs</h2>
        <span className="text-xs text-meta">Evaluations, inside the practice</span>
      </div>
      <p className="mt-1 text-sm text-meta">
        Same Learning Log flow, prefilled from each member&apos;s own logs — an
        evaluation, never a grade. Status only.
      </p>

      {status.total === 0 ? (
        <p className="mt-3 text-sm text-meta">No members to evaluate yet.</p>
      ) : (
        <div className="mt-4 space-y-5">
          {status.rows.map((row) => (
            <div key={row.kind}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="lbl">
                  {row.label} review{" "}
                  <span className="font-normal text-meta-soft">· week {row.week}</span>
                </p>
                {row.opened ? (
                  <span className="text-xs text-meta">
                    {row.submitted_ids.length} / {status.total} submitted
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-sm bg-ink/[0.04] px-2 py-0.5 text-xs font-medium text-meta">
                    Opens later
                  </span>
                )}
              </div>

              {row.opened && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {row.submitted_ids.map((id) => (
                    <span
                      key={id}
                      title={`${nameById.get(id) ?? "Member"} — submitted`}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-deep text-xs font-bold text-white"
                    >
                      {initialsById.get(id) ?? "?"}
                    </span>
                  ))}
                  {row.waiting_ids.map((id) => (
                    <span
                      key={id}
                      title={`${nameById.get(id) ?? "Member"} — open`}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-ink/15 bg-paper text-xs font-bold text-meta"
                    >
                      {initialsById.get(id) ?? "?"}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
