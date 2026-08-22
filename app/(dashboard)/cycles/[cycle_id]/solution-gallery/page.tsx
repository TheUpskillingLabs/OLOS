import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { effectiveUser } from "@/lib/auth/simulation";
import { parseWindow } from "@/lib/cycles/lab-time";
import { resolveGalleryView } from "@/lib/projects/gallery-visibility";
import {
  SolutionProposalDetails,
  hasSolutionDetails,
} from "@/app/components/solution-proposal-details";

// Member-facing project gallery. Anonymized by construction: it reads only
// member-safe columns (no participant_id, no created_at), so no submitter
// identity or timestamp can reach a pod member. The four qualitative answers
// unlock per lib/projects/gallery-visibility.ts — after you submit your own
// pitch, or once voting opens. Poderators get the full, attributed view at
// /moderator/cycles/[cycle_id]/submissions.

// Member-safe shape — deliberately excludes participant_id and created_at.
type GalleryProposal = {
  id: number;
  name: string | null;
  summary: string | null;
  proposal_data: Record<string, string> | null;
};

export default async function SolutionGalleryPage({
  params,
}: {
  params: Promise<{ cycle_id: string }>;
}) {
  const { cycle_id } = await params;
  const cycleId = parseInt(cycle_id, 10);
  if (Number.isNaN(cycleId)) notFound();

  const serviceClient = createServiceClient();

  const { data: cycle } = await serviceClient
    .from("cycles")
    .select("id, name")
    .eq("id", cycleId)
    .single();
  if (!cycle) notFound();

  const { data: config } = await serviceClient
    .from("cycle_config")
    .select(
      "solution_proposal_open, solution_voting_open, solution_voting_close"
    )
    .eq("cycle_id", cycleId)
    .maybeSingle();

  // Naive window columns are UTC instants (lib/cycles/lab-time.ts).
  const now = new Date();
  const openAt = parseWindow(config?.solution_proposal_open);
  const votingOpenAt = parseWindow(config?.solution_voting_open);
  const votingCloseAt = parseWindow(config?.solution_voting_close);

  // The gallery lives from submissions opening through the close of voting.
  const galleryOpen =
    openAt !== null && votingCloseAt !== null && now >= openAt && now <= votingCloseAt;
  const votingOpen =
    votingOpenAt !== null &&
    votingCloseAt !== null &&
    now >= votingOpenAt &&
    now <= votingCloseAt;

  // Resolve the viewer's pod(s) in this cycle + whether they've submitted.
  const user = await effectiveUser();
  let myPodIds: number[] = [];
  let hasSubmittedOwn = false;

  if (user) {
    const { data: participant } = await serviceClient
      .from("participants")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (participant) {
      const [{ data: memberships }, { data: ownProposal }] = await Promise.all([
        serviceClient
          .from("pod_memberships")
          .select("pod_id, pods!inner(cycle_id)")
          .eq("participant_id", participant.id)
          .eq("pods.cycle_id", cycleId)
          .is("inactive_at", null),
        serviceClient
          .from("solution_proposals")
          .select("id")
          .eq("cycle_id", cycleId)
          .eq("participant_id", participant.id)
          .maybeSingle(),
      ]);
      myPodIds = (memberships ?? []).map((m) => m.pod_id as number);
      hasSubmittedOwn = !!ownProposal;
    }
  }

  const view = resolveGalleryView({ galleryOpen, hasSubmittedOwn, votingOpen });

  const header = (
    <div className="mb-8">
      <Link
        href={`/cycles/${cycle.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-meta transition-colors duration-150 hover:text-teal-deep"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        {cycle.name}
      </Link>
      <h1 className="t-h1 mt-2 text-ink">Project gallery</h1>
      <p className="mt-1 text-sm text-charcoal">
        The projects your pod pitched this cycle. Vote on ideas, not people —
        submissions are shown without names.
      </p>
    </div>
  );

  if (view === "hidden") {
    return (
      <div className="max-w-3xl">
        {header}
        <div className="rounded-card border border-ink/10 bg-white p-6 shadow-card">
          <p className="text-charcoal">The project gallery isn&apos;t open yet.</p>
          {openAt && now < openAt && (
            <p className="mt-2 text-sm text-meta">
              It opens when project submissions begin.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Member-safe read: scoped to the viewer's pod(s), no identity/timestamp.
  let proposals: GalleryProposal[] = [];
  if (myPodIds.length > 0) {
    const { data } = await serviceClient
      .from("solution_proposals")
      .select("id, name, summary, proposal_data")
      .in("pod_id", myPodIds)
      .order("id");
    proposals = (data as GalleryProposal[] | null) ?? [];
  }

  return (
    <div className="max-w-3xl">
      {header}

      {view === "abbreviated" && (
        <div className="mb-6 rounded-card border border-teal/20 bg-teal/[0.05] px-4 py-3 text-sm text-charcoal">
          Submit your own project pitch to read everyone&apos;s full proposals —
          this keeps others&apos; answers from shaping yours. The full proposals
          also open to everyone once voting begins.
        </div>
      )}

      {myPodIds.length === 0 ? (
        <div className="rounded-card border border-ink/10 bg-white p-6 shadow-card">
          <p className="text-charcoal">
            You&apos;re not a member of a pod in this cycle yet, so there are no
            projects to show here.
          </p>
        </div>
      ) : proposals.length === 0 ? (
        <div className="rounded-card border border-dashed border-meta-soft bg-white p-12 text-center">
          <p className="text-sm text-meta">No projects have been submitted yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {proposals.map((p) => (
            <div
              key={p.id}
              className="rounded-card border border-ink/10 bg-white p-4 shadow-card"
            >
              <h2 className="font-semibold tracking-tight text-ink">
                {p.name || "Untitled project"}
              </h2>
              {p.summary && (
                <p className="mt-1 text-sm text-charcoal">{p.summary}</p>
              )}
              {view === "expanded" ? (
                <SolutionProposalDetails data={p.proposal_data} />
              ) : (
                hasSolutionDetails(p.proposal_data) && (
                  <p className="mt-2 text-xs italic text-meta">
                    Full proposal hidden until you submit yours (or voting opens).
                  </p>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
