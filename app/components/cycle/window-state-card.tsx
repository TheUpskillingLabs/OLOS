import { phaseStateFor, CYCLE_PHASES, type WindowField } from "@/lib/cycle/phases";

/**
 * The single card an action page shows when its window isn't open — replacing
 * the six copy-pasted "not currently open" blocks. It distinguishes the states
 * a member genuinely needs to tell apart: "not open yet" (Opens {date}),
 * "already closed" (Closed {date}), and "not scheduled yet". The page keeps its
 * own header + back-link above this.
 */

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
}

export default function WindowStateCard({
  field,
  openAt,
  closeAt,
  now,
}: {
  field: WindowField;
  openAt: string | null;
  closeAt: string | null;
  now?: Date;
}) {
  const label = CYCLE_PHASES.find((p) => p.field === field)?.label ?? "This step";
  const state = phaseStateFor(openAt, closeAt, now);

  let headline: string;
  let sub: string | null;
  switch (state) {
    case "upcoming":
      headline = `${label} isn't open yet.`;
      sub = openAt ? `Opens ${fmt(openAt)}. We'll surface it on your dashboard when it's time.` : null;
      break;
    case "done":
      headline = `${label} has closed.`;
      sub = closeAt
        ? `Closed ${fmt(closeAt)}. Head back to your cycle for what's happening now.`
        : "Head back to your cycle for what's happening now.";
      break;
    case "open":
      // The page renders the action itself when open; this is a safety fallback.
      headline = `${label} is open.`;
      sub = null;
      break;
    default: // "unscheduled"
      headline = `${label} isn't scheduled yet.`;
      sub = "We'll open it here when it's time.";
  }

  return (
    <div className="rounded-card border border-ink/10 bg-white p-6 shadow-card">
      <p className="font-semibold tracking-tight text-ink">{headline}</p>
      {sub && <p className="mt-1 text-sm text-meta">{sub}</p>}
    </div>
  );
}
