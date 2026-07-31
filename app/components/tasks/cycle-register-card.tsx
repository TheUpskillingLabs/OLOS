import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { fmtDateOnly, fmtLabDateTime } from "@/lib/cycles/lab-time";

/* Registration state card — consolidates the dashboard's joinCycleCard /
   preRegisteredCard / registrationClosedCard trio. These are state and
   confirmation cards, not tasks (in two of three states there is nothing
   to do), so they render below the Up-next queue.

     open           → the join/pre-register CTA card
     pre_registered → "you're set" confirmation, links to the cycle
     closed         → D-10 closed note, naming the reopen instant during
                      the pod-forming dead zone

   Server-safe. Dates via lab-time (no viewer-local toLocaleDateString). */

export interface RegisterCardCycle {
  id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
}

export default function CycleRegisterCard({
  cycle,
  state,
  upcoming,
  reopensAt,
}: {
  cycle: RegisterCardCycle;
  state: "open" | "pre_registered" | "closed";
  /** The cohort is the upcoming one (pre-registration framing). */
  upcoming: boolean;
  /** When state === "closed" in the dead zone: the reopen instant (ISO). */
  reopensAt?: string | null;
}) {
  if (state === "pre_registered") {
    return (
      <Link
        href={`/cycles/${cycle.id}`}
        className="group flex items-center justify-between rounded-card border border-teal/30 bg-teal/[0.06] p-8 shadow-card transition-colors duration-150 ease-out hover:border-teal hover:bg-teal/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
      >
        <div>
          <div className="lbl lbl-teal mb-2">You&apos;re pre-registered</div>
          <h2 className="t-h3 text-ink">{cycle.name}</h2>
          <p className="mt-2 text-sm text-meta">
            You&apos;re all set for the next cycle
            {cycle.start_date
              ? ` — it kicks off ${fmtDateOnly(cycle.start_date)}`
              : ""}
            . We&apos;ll open your next steps here when it starts.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-base font-semibold tracking-tight text-teal-deep">
          View cycle
          <ArrowRight
            className="h-5 w-5 transition-transform duration-150 ease-spring group-hover:translate-x-0.5"
            aria-hidden
          />
        </span>
      </Link>
    );
  }

  if (state === "closed") {
    return (
      <div className="rounded-card border border-ink/10 bg-white p-8 shadow-card">
        <div className="lbl mb-2">Registration closed</div>
        <h2 className="t-h3 text-ink">{cycle.name}</h2>
        <p className="mt-2 text-sm text-meta">
          {reopensAt
            ? `Pods are forming right now, so registration is paused. It reopens ${fmtLabDateTime(
                reopensAt
              )}, when pods open to new members.`
            : "Registration for this cycle has closed. The next Build Cycle will show up right here."}
        </p>
      </div>
    );
  }

  return (
    <Link
      href={`/cycles/${cycle.id}/join`}
      className="group flex items-center justify-between rounded-card border border-teal/30 bg-white p-8 shadow-card transition-colors duration-150 ease-out hover:border-teal hover:bg-teal/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
    >
      <div>
        <h2 className="t-h3 text-ink">{cycle.name}</h2>
        {cycle.start_date && cycle.end_date && (
          <p className="mt-1 text-sm text-meta">
            {fmtDateOnly(cycle.start_date)} &ndash; {fmtDateOnly(cycle.end_date)}
          </p>
        )}
        <p className="mt-3 text-sm text-meta">
          {upcoming
            ? "Pre-register now to claim your spot for the next cycle."
            : "Complete this form to join the cycle."}
        </p>
      </div>
      <span className="inline-flex items-center gap-1.5 text-base font-semibold tracking-tight text-teal-deep">
        {upcoming ? "Pre-register" : `Join ${cycle.name}`}
        <ArrowRight
          className="h-5 w-5 transition-transform duration-150 ease-spring group-hover:translate-x-0.5"
          aria-hidden
        />
      </span>
    </Link>
  );
}
