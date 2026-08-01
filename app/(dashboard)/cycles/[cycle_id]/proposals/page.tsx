import Link from "next/link";
import { windowOpen } from "@/lib/cycles/lab-time";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { resolveUserRoles, isAdmin } from "@/lib/auth/roles";
import { notFound } from "next/navigation";
import {
  ProposalDetails,
  ProposalMapLink,
  proposalMapUrl,
  type ProposalData,
} from "@/app/components/proposal-details";
import { effectiveUser } from "@/lib/auth/simulation";

// Read-only gallery of the cycle's problem situations. Unlike the vote
// ballot, this renders in every phase — the ballot only exists while the
// voting window is open, which left proposals unbrowsable the rest of the
// cycle. Same per-lab scoping as GET /api/problem-statements/[cycle_id],
// same no-author-attribution convention as the ballot.
export default async function ProposalsGalleryPage({
  params,
}: {
  params: Promise<{ cycle_id: string }>;
}) {
  const { cycle_id } = await params;
  const cycleId = parseInt(cycle_id, 10);
  const supabase = await createClient();

  const { data: cycle } = await supabase
    .from("cycles")
    .select("id, name")
    .eq("id", cycleId)
    .single();

  if (!cycle) notFound();

  const serviceClient = createServiceClient();
  const { data: config } = await serviceClient
    .from("cycle_config")
    .select(
      "problem_statement_open, problem_statement_close, voting_open, voting_close"
    )
    .eq("cycle_id", cycleId)
    .maybeSingle();

  const now = new Date();
  const proposeOpen = windowOpen(
    config?.problem_statement_open,
    config?.problem_statement_close,
    now
  );
  const votingOpen = windowOpen(config?.voting_open, config?.voting_close, now);

  const user = await effectiveUser();

  const { data: me } = user
    ? await supabase
        .from("participants")
        .select("id, metro_id")
        .eq("auth_user_id", user.id)
        .maybeSingle()
    : { data: null };

  const userRoles = user
    ? await resolveUserRoles(serviceClient, user.id)
    : null;

  // Per-lab gallery, mirroring the ballot's GET route: members see their own
  // lab's statements (NULL metro = the grandfathered HQ bucket); admins see
  // all labs.
  let query = serviceClient
    .from("problem_statements")
    .select("id, statement_text, proposal_data, created_at")
    .eq("cycle_id", cycleId)
    .order("created_at");
  if (!userRoles || !isAdmin(userRoles)) {
    query = me?.metro_id
      ? query.eq("metro_id", me.metro_id)
      : query.is("metro_id", null);
  }
  const { data: statements } = await query;

  return (
    <div>
      <div className="mb-8">
        <Link
          href={`/cycles/${cycle.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-meta transition-colors duration-150 hover:text-teal-deep"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {cycle.name}
        </Link>
        <h1 className="t-h1 mt-2 text-ink">Problem situation gallery</h1>
        <p className="mt-1 text-sm text-charcoal">
          What your cohort is proposing this cycle. Follow a map link to
          explore the evidence behind a situation.
        </p>
      </div>

      {proposeOpen && (
        <Link
          href={`/cycles/${cycle.id}/propose`}
          className="group mb-4 flex items-center justify-between gap-3 rounded-card border border-teal/30 bg-teal/10 p-4 transition-colors duration-150 ease-out hover:border-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
        >
          <span className="font-semibold tracking-tight text-ink">
            Submissions are open — propose a problem situation
          </span>
          <ArrowRight
            className="h-4 w-4 flex-shrink-0 text-teal-deep transition-transform duration-150 ease-spring group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
      )}

      {votingOpen && (
        <Link
          href={`/cycles/${cycle.id}/vote`}
          className="group mb-4 flex items-center justify-between gap-3 rounded-card border border-teal/30 bg-teal/10 p-4 transition-colors duration-150 ease-out hover:border-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
        >
          <span className="font-semibold tracking-tight text-ink">
            Voting is open — cast your votes
          </span>
          <ArrowRight
            className="h-4 w-4 flex-shrink-0 text-teal-deep transition-transform duration-150 ease-spring group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
      )}

      {!statements || statements.length === 0 ? (
        <div className="mt-4 rounded-card border border-dashed border-meta-soft bg-white p-12">
          <p className="text-sm text-meta">
            No problem situations have been submitted yet.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {statements.map((stmt) => {
            const pd = (stmt.proposal_data ?? null) as ProposalData | null;

            return (
              <div
                key={stmt.id}
                className="rounded-card border border-ink/10 bg-white p-4 shadow-card transition-colors duration-150 hover:border-ink/20"
              >
                {pd?.situation?.title && (
                  <p className="lbl lbl-teal mb-1">{pd.situation.title}</p>
                )}
                <p className="font-semibold tracking-tight text-ink">
                  {stmt.statement_text}
                </p>

                {pd?.statement?.question && (
                  <p className="mt-2 text-sm italic text-slate">
                    {pd.statement.question}
                  </p>
                )}

                <ProposalMapLink href={proposalMapUrl(pd)} />

                {pd?.about?.background && (
                  <p className="mt-2 text-xs text-meta">
                    Submitted by: {pd.about.background}
                  </p>
                )}

                <ProposalDetails data={pd} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
