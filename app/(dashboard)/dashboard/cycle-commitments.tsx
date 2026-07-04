import { ANCHOR_EVENTS, fmtEvt, icsHref } from "@/lib/cycles/anchor-events";

/* "Your commitments" — the six anchor events with real dates, always
   findable after signing (prototype renderDashCycle "Your commitments" +
   the facilitator user story: committed dates never presented once and
   lost). Real dates, not week numbers, plus an anytime .ics download. A
   plain server component — the .ics is a data: URL from lib/cycles. */

export default function CycleCommitments() {
  return (
    <section className="mb-8 rounded-card border border-ink/10 bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="t-h3 text-ink">Your commitments</h2>
        <a
          href={icsHref()}
          download="upskilling-labs-cycle.ics"
          className="text-sm font-semibold text-teal-deep hover:underline"
        >
          Add to calendar (.ics)
        </a>
      </div>
      <p className="mt-1 text-xs text-meta">
        The dated events you agreed to when you registered. Kickoff plus the
        five core events.
      </p>
      <ul className="mt-4 divide-y divide-ink/10">
        {ANCHOR_EVENTS.map((e) => (
          <li
            key={e.api_id}
            className="flex items-baseline justify-between gap-3 py-2.5"
          >
            <span className="text-sm text-charcoal">
              {e.name}
              {e.kickoff && (
                <span className="ml-2 rounded-sm bg-teal/10 px-2 py-0.5 text-xs font-medium text-teal-deep">
                  Kickoff
                </span>
              )}
            </span>
            <span className="flex-shrink-0 text-sm font-semibold text-ink tabular-nums">
              {fmtEvt(e)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
