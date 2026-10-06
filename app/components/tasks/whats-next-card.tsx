import Link from "next/link";
import type { WhatsNextMessage } from "@/lib/cycles/whats-next";
import WaitlistButton from "./waitlist-button";

/* "What's next" — the first card between cycles when no next cycle is
   announced (S0; docs/requirements/between-cycles-dashboard.md,
   cycle-4-readiness.md §1). The same message as the public site
   (lib/cycles/whats-next.ts): the internal cycle as an invitation to people
   who have taken part before (Slack), what keeps running, and the next
   public kickoff with the one-tap waitlist. Anchor #whats-next — the
   homepage's signed-in "Join the waitlist" lands here. Never dismissible:
   it is the state of things, not a suggestion. */

export default function WhatsNextCard({
  message,
  internalUrl,
  participantId,
  intents,
}: {
  message: WhatsNextMessage;
  internalUrl: string;
  participantId: number;
  intents: string[];
}) {
  return (
    <section
      id="whats-next"
      className="mb-8 scroll-mt-24 rounded-card border border-teal/30 bg-white p-5 shadow-card"
      aria-labelledby="whats-next-heading"
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-teal-deep">
        {message.chip}
      </span>
      <h2 id="whats-next-heading" className="t-h3 mt-1 text-ink">
        {message.heading}
      </h2>

      {message.internal && (
        <p className="mt-3 text-sm text-charcoal">
          {message.internal}{" "}
          <a
            href={internalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-teal-deep underline-offset-2 hover:underline"
          >
            Join it on Slack →
          </a>
        </p>
      )}
      <p className="mt-2 text-sm text-charcoal">
        {message.notChanging}{" "}
        <Link
          href="/events"
          className="font-semibold text-teal-deep underline-offset-2 hover:underline"
        >
          {message.eventsCta} →
        </Link>
      </p>

      <div className="mt-4 border-t border-ink/10 pt-4">
        <p className="mb-3 text-sm font-semibold text-ink">{message.nextPublic}</p>
        <WaitlistButton
          participantId={participantId}
          intents={intents}
          joinLabel={message.waitlistCta}
          onLabel={message.onWaitlist}
          promise={message.waitlistPromise}
        />
      </div>
    </section>
  );
}
