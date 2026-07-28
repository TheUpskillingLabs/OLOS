import { ExternalLink } from "lucide-react";

/**
 * Shape of problem_statements.proposal_data. Every field is optional: rows
 * span two generations of the propose form, and both the gallery and the pod
 * cards render whatever a given row happens to carry.
 */
export interface ProposalData {
  about?: { background?: string };
  // Triangulator-aligned shape (current submissions)…
  situation?: {
    title?: string;
    description?: string;
    openness?: string;
    paradox?: string;
    beneficiaries?: string;
    problematization?: string;
  };
  // …and the legacy who/need/barrier/success block (pre-alignment rows).
  problem?: { who?: string; need?: string; barrier?: string; success?: string };
  statement?: { question?: string; repo_url?: string };
  voter_context?: {
    tried?: string;
    scale?: string;
    pod_work?: string;
    skills_needed?: string;
  };
}

/** True when there is anything to put behind the "Read full proposal" toggle. */
export function hasProposalDetails(pd: ProposalData | null | undefined) {
  return !!(pd?.situation || pd?.problem || pd?.voter_context);
}

/**
 * repo_url as a safe href, or null. Rows written before the schema restricted
 * repo_url to http(s) are untrusted, so the scheme is checked every time.
 */
export function proposalMapUrl(pd: ProposalData | null | undefined) {
  const raw = pd?.statement?.repo_url;
  return raw && /^https?:\/\//i.test(raw) ? raw : null;
}

/**
 * The "Read full proposal" expander — every detail block the submitter filled
 * in, in submission order. Presentational only (no hooks, no client state), so
 * the server-rendered gallery and the client-side pod cards share one copy.
 */
export function ProposalDetails({ data }: { data: ProposalData | null }) {
  if (!hasProposalDetails(data)) return null;

  return (
    <details className="group mt-2">
      <summary className="inline-flex cursor-pointer list-none items-center text-xs font-semibold tracking-tight text-teal-deep transition-colors duration-150 hover:underline focus-visible:underline [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">Read full proposal</span>
        <span className="hidden group-open:inline">Show less</span>
      </summary>
      <div className="mt-4 space-y-3 border-t border-ink/10 pt-4">
        {data?.situation?.description && (
          <DetailBlock
            label="The situation"
            text={data.situation.description}
          />
        )}
        {data?.situation?.openness && (
          <DetailBlock
            label="What makes it open"
            text={data.situation.openness}
          />
        )}
        {data?.situation?.paradox && (
          <DetailBlock label="The paradox" text={data.situation.paradox} />
        )}
        {data?.situation?.beneficiaries && (
          <DetailBlock
            label="Who benefits from its persistence"
            text={data.situation.beneficiaries}
          />
        )}
        {data?.situation?.problematization && (
          <DetailBlock
            label="Pressure-test"
            text={data.situation.problematization}
          />
        )}
        {data?.problem?.who && (
          <DetailBlock label="Who is struggling" text={data.problem.who} />
        )}
        {data?.problem?.need && (
          <DetailBlock label="What they need to do" text={data.problem.need} />
        )}
        {data?.problem?.barrier && (
          <DetailBlock
            label="Why they can't do it now"
            text={data.problem.barrier}
          />
        )}
        {data?.problem?.success && (
          <DetailBlock
            label="What success looks like"
            text={data.problem.success}
          />
        )}
        {data?.voter_context?.tried && (
          <DetailBlock
            label="What has been tried"
            text={data.voter_context.tried}
          />
        )}
        {data?.voter_context?.scale && (
          <DetailBlock
            label="Why it matters beyond the individual"
            text={data.voter_context.scale}
          />
        )}
        {data?.voter_context?.pod_work && (
          <DetailBlock
            label="What the Research Pod would do"
            text={data.voter_context.pod_work}
          />
        )}
        {data?.voter_context?.skills_needed && (
          <DetailBlock
            label="Skills & people needed"
            text={data.voter_context.skills_needed}
          />
        )}
      </div>
    </details>
  );
}

/**
 * The map link that sits above the expander on both surfaces. Takes the
 * nullable result of proposalMapUrl directly and renders nothing for a
 * missing or non-http(s) URL.
 */
export function ProposalMapLink({ href }: { href: string | null }) {
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold tracking-tight text-teal-deep transition-colors duration-150 hover:underline focus-visible:underline"
    >
      View the map
      <ExternalLink className="h-3 w-3" aria-hidden />
    </a>
  );
}

function DetailBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="lbl">{label}</p>
      <p className="mt-0.5 text-sm text-charcoal">{text}</p>
    </div>
  );
}
