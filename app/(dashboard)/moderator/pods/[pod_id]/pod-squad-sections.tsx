import { createServiceClient } from "@/lib/supabase/server";
import { getLogHealth } from "@/lib/moderator/log-health";
import type { RosterRow } from "@/lib/moderator/pod-detail";

/* The Pod Squad sections (memo-driven, roadmap "Pod Squad batch" +
   Phase 1's Poderator repoint), stacked between insights and the roster:
     1. Learning Log health — sentiment averages + blocked-first list with
        the member's own words + the logged/waiting compliance strip.
     2. Workshop sign-ups — who's registered for upcoming events
        (event_rsvps.participant_id, migration 00039 + the Luma mirror).
     3. Pod feedback inbox — what this pod flagged through the feedback
        widget. Read-only; the shepherd observes, never grades. */

export default async function PodSquadSections({
  cycleId,
  members,
}: {
  cycleId: number;
  members: RosterRow[];
}) {
  const supabase = createServiceClient();
  const realMembers = members.filter((m) => !m.is_staff_or_test);
  const memberIds = realMembers.map((m) => m.participant_id);
  const nameById = new Map(
    realMembers.map((m) => [m.participant_id, m.display_name])
  );
  const initialsById = new Map(
    realMembers.map((m) => [m.participant_id, m.initials])
  );

  const [health, rsvps, feedback] = await Promise.all([
    getLogHealth(supabase, cycleId, realMembers),
    memberIds.length
      ? supabase
          .from("event_rsvps")
          .select(
            "participant_id, events!inner(id, name, start_at, status)"
          )
          .in("participant_id", memberIds)
          .eq("events.status", "published")
          .gte("events.start_at", new Date().toISOString().slice(0, 10))
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
    memberIds.length
      ? supabase
          .from("feedback")
          .select("id, participant_id, category, description, status, created_at")
          .in("participant_id", memberIds)
          .order("created_at", { ascending: false })
          .limit(8)
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
  ]);

  // Group sign-ups by event, soonest first.
  type EventGroup = { name: string; start_at: string; attendees: string[] };
  const byEvent = new Map<number, EventGroup>();
  for (const row of rsvps) {
    const event = Array.isArray(row.events) ? row.events[0] : row.events;
    if (!event) continue;
    const entry: EventGroup = byEvent.get(event.id) ?? {
      name: event.name,
      start_at: event.start_at,
      attendees: [],
    };
    entry.attendees.push(nameById.get(row.participant_id) ?? "Member");
    byEvent.set(event.id, entry);
  }
  const upcoming = [...byEvent.values()].sort((a, b) =>
    a.start_at.localeCompare(b.start_at)
  );

  return (
    <>
      {/* ── Learning Log health ── */}
      <section className="mb-6 rounded-card border border-ink/10 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="t-h3 text-ink">Learning Log health</h2>
          <span className="text-xs text-meta">
            {health.window_due_at
              ? `Window opened ${new Date(health.window_due_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
              : "No window armed — trailing 7 days"}
          </span>
        </div>

        {health.sample_size === 0 ? (
          <p className="mt-3 text-sm text-meta">
            No logs yet. Once the pod starts logging, clarity and alignment
            show up here.
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-6">
            <div>
              <p className="lbl">Clarity</p>
              <p className="t-h3 text-ink">
                {health.avg_clarity ?? "–"}
                <span className="text-sm text-meta"> / 5</span>
              </p>
            </div>
            <div>
              <p className="lbl">Pod alignment</p>
              <p className="t-h3 text-ink">
                {health.avg_alignment ?? "–"}
                <span className="text-sm text-meta"> / 5</span>
              </p>
            </div>
            <div>
              <p className="lbl">Logged this window</p>
              <p className="t-h3 text-ink">
                {health.logged_ids.length}
                <span className="text-sm text-meta">
                  {" "}
                  / {health.logged_ids.length + health.waiting_ids.length}
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Blocked first — their own words, one tap to reach out. */}
        {health.blocked.length > 0 && (
          <div className="mt-5 space-y-3">
            <p className="lbl text-red">Blocked — reach out first</p>
            {health.blocked.map((b) => (
              <div
                key={b.participant_id}
                className="rounded-card border border-red/30 bg-red/5 px-4 py-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-ink">
                    {b.display_name}
                  </span>
                  {b.email && (
                    <a
                      className="text-sm text-teal-deep hover:underline"
                      href={`mailto:${b.email}`}
                    >
                      Email →
                    </a>
                  )}
                </div>
                {b.blocker_context && (
                  <p className="mt-1 text-sm text-charcoal">
                    “{b.blocker_context}”
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Compliance strip: logged vs waiting avatars. */}
        {(health.logged_ids.length > 0 || health.waiting_ids.length > 0) && (
          <div className="mt-5 flex flex-wrap items-center gap-1.5">
            {health.logged_ids.map((id) => (
              <span
                key={id}
                title={`${nameById.get(id) ?? "Member"} — logged`}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-deep text-xs font-bold text-white"
              >
                {initialsById.get(id) ?? "?"}
              </span>
            ))}
            {health.waiting_ids.map((id) => (
              <span
                key={id}
                title={`${nameById.get(id) ?? "Member"} — waiting`}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-ink/15 bg-paper text-xs font-bold text-meta"
              >
                {initialsById.get(id) ?? "?"}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* ── Workshop sign-ups ── */}
      <section className="mb-6 rounded-card border border-ink/10 bg-white p-5 shadow-card">
        <h2 className="t-h3 text-ink">Workshop sign-ups</h2>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-sm text-meta">
            No upcoming event sign-ups from this pod yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {upcoming.map((e) => (
              <li key={e.name} className="text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-ink">{e.name}</span>
                  <span className="text-meta">
                    {new Date(e.start_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <p className="mt-0.5 text-charcoal">
                  {e.attendees.join(", ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Pod feedback inbox (read-only) ── */}
      <section className="mb-6 rounded-card border border-ink/10 bg-white p-5 shadow-card">
        <h2 className="t-h3 text-ink">Pod feedback</h2>
        <p className="mt-1 text-xs text-meta">
          What your pod flagged through the feedback widget. Read-only — the
          product team triages status.
        </p>
        {feedback.length === 0 ? (
          <p className="mt-3 text-sm text-meta">Nothing flagged yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {feedback.map((f) => (
              <li key={f.id} className="text-sm">
                <div className="flex flex-wrap items-baseline gap-2">
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
                <p className="mt-1 line-clamp-2 text-charcoal">
                  {f.description}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
