import { getPodContext } from "@/lib/moderator/pod-context";
import { getPodWorkshops } from "@/lib/moderator/workshops";

export const dynamic = "force-dynamic";

/**
 * Workshops — the full list behind the Overview digest's "Next workshops"
 * preview (poderator redesign follow-up). Forward-looking only, same as the
 * panel it extends from: no range filter, current-state.
 */
export default async function PodWorkshopsPage({
  params,
}: {
  params: Promise<{ pod_id: string }>;
}) {
  const { pod_id } = await params;
  const ctx = await getPodContext(pod_id);
  const { realMembers } = ctx;

  const memberIds = realMembers.map((m) => m.participant_id);
  const workshops = await getPodWorkshops(ctx.serviceClient, memberIds);

  return (
    <div>
      <div className="mb-5">
        <h1 className="t-h1 text-ink">Workshops</h1>
        <p className="mt-1 text-sm text-meta">
          {workshops.length} upcoming with sign-ups this cycle. Low sign-ups
          are a nudge opportunity, not a metric.
        </p>
      </div>

      {workshops.length === 0 ? (
        <p className="rounded-card border border-ink/10 bg-white p-5 text-sm text-meta shadow-card">
          No upcoming sign-ups yet.
        </p>
      ) : (
        <ul className="divide-y divide-ink/10 rounded-card border border-ink/10 bg-white shadow-card">
          {workshops.map((e) => (
            <li
              key={e.id}
              className="flex items-baseline justify-between gap-3 px-5 py-3 text-sm"
            >
              <span className="text-charcoal">
                {e.name}
                <span className="ml-1.5 text-xs text-meta">
                  {new Date(e.start_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </span>
              <span className="whitespace-nowrap text-xs tabular-nums text-meta">
                {e.count} of {realMembers.length}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
