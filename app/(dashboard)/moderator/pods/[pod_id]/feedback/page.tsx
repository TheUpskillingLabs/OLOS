// Pod Feedback — the feedback-widget inbox on its own page (design doc §3):
// unread (status "new") first, category tags, read-only framing preserved.
// The range filter scopes created_at.

import { getPodContext } from "@/lib/moderator/pod-context";
import { parseRange, rangeSince } from "@/lib/moderator/range";
import { RangeToggle } from "../_nav/range-toggle";

export const dynamic = "force-dynamic";

export default async function PodFeedbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ pod_id: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { pod_id } = await params;
  const ctx = await getPodContext(pod_id);
  const range = parseRange((await searchParams).range);
  const since = rangeSince(range);

  const memberIds = ctx.realMembers.map((m) => m.participant_id);
  const nameById = new Map(
    ctx.realMembers.map((m) => [m.participant_id, m.display_name])
  );

  let query = ctx.serviceClient
    .from("feedback")
    .select("id, participant_id, category, description, status, created_at")
    .in("participant_id", memberIds.length ? memberIds : [-1])
    .order("created_at", { ascending: false })
    .limit(50);
  if (since) query = query.gte("created_at", since);
  const { data } = await query;
  const rows = data ?? [];
  // Unread first, then newest.
  rows.sort((a, b) => {
    const aNew = a.status === "new" ? 0 : 1;
    const bNew = b.status === "new" ? 0 : 1;
    return aNew - bNew || String(b.created_at).localeCompare(String(a.created_at));
  });

  return (
    <div>
      <h1 className="t-h1 text-ink">Pod Feedback</h1>
      <p className="mt-1 text-sm text-slate">
        What your pod flagged through the feedback widget. Read-only. The
        product team triages status.
      </p>
      <div className="mb-6 mt-3">
        <RangeToggle current={range} />
      </div>

      <section className="rounded-card border border-ink/10 bg-white p-5 shadow-card">
        {rows.length === 0 ? (
          <p className="text-sm text-meta">Nothing flagged in this range.</p>
        ) : (
          <ul className="divide-y divide-ink/10">
            {rows.map((f) => (
              <li key={f.id} className="py-3 text-sm first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline gap-2">
                  {f.status === "new" && (
                    <span className="rounded-full bg-red px-2 py-0.5 text-[10px] font-bold text-white">
                      NEW
                    </span>
                  )}
                  <span className="rounded-card border border-ink/15 px-2 py-0.5 text-xs font-semibold text-charcoal">
                    {f.category}
                  </span>
                  <span className="text-meta">
                    {nameById.get(f.participant_id ?? -1) ?? "A member"} ·{" "}
                    {new Date(f.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <p className="mt-1 text-charcoal">{f.description}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
