import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ProposalForm, { type InitialProposal } from "./proposal-form";

// W2-001: submission tab visibility extends T-1 day before
// solution_proposal_open through T+1 day after solution_proposal_close.
// Server-side enforcement on POST is strict (open..close only); this buffer
// only controls UI presence so participants see the upcoming window land
// and have a day after close to read the "submission closed" state.
const DAY_MS = 24 * 60 * 60 * 1000;

export default async function SolutionsPage({
  params,
}: {
  params: Promise<{ cycle_id: string }>;
}) {
  const { cycle_id } = await params;
  const cycleId = parseInt(cycle_id, 10);
  const supabase = await createClient();

  const serviceClient = createServiceClient();

  const [{ data: cycle }, { data: config }, { data: { user } }] = await Promise.all([
    supabase.from("cycles").select("id, name, status").eq("id", cycleId).single(),
    serviceClient.from("cycle_config").select("solution_proposal_open, solution_proposal_close").eq("cycle_id", cycleId).single(),
    supabase.auth.getUser(),
  ]);

  if (!cycle) notFound();

  const now = new Date();
  const openAt = config?.solution_proposal_open ? new Date(config.solution_proposal_open) : null;
  const closeAt = config?.solution_proposal_close ? new Date(config.solution_proposal_close) : null;

  const tabVisibleFrom = openAt ? new Date(openAt.getTime() - DAY_MS) : null;
  const tabVisibleUntil = closeAt ? new Date(closeAt.getTime() + DAY_MS) : null;

  const tabVisible =
    tabVisibleFrom !== null &&
    tabVisibleUntil !== null &&
    now >= tabVisibleFrom &&
    now <= tabVisibleUntil;

  const submissionOpen =
    openAt !== null && closeAt !== null && now >= openAt && now <= closeAt;

  // T-2 days through close: warn participants who haven't submitted yet.
  const warnBannerFrom = closeAt ? new Date(closeAt.getTime() - 2 * DAY_MS) : null;
  const inWarningWindow =
    warnBannerFrom !== null && closeAt !== null && now >= warnBannerFrom && now <= closeAt;

  let myPods: { id: number; name: string | null }[] = [];
  let initialProposal: InitialProposal | null = null;

  if (user) {
    const { data: participant } = await supabase
      .from("participants")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (participant) {
      const [{ data: memberships }, { data: existing }] = await Promise.all([
        supabase.from("pod_memberships").select("pod_id, pods!inner(id, name, cycle_id)").eq("participant_id", participant.id).eq("pods.cycle_id", cycleId).is("inactive_at", null),
        supabase.from("solution_proposals").select("id, pod_id, name, summary, proposal_data, proposal_text").eq("cycle_id", cycleId).eq("participant_id", participant.id).maybeSingle(),
      ]);

      myPods = (memberships || []).map((m) => {
        const pod = m.pods as unknown as { id: number; name: string | null };
        return { id: pod.id, name: pod.name };
      });

      if (existing) {
        initialProposal = {
          id: existing.id,
          pod_id: existing.pod_id,
          name: existing.name,
          summary: existing.summary,
          proposal_data: (existing.proposal_data as Record<string, string> | null) ?? null,
          proposal_text: existing.proposal_text,
        };
      }
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <Link
          href={`/cycles/${cycle.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-meta transition-colors duration-150 hover:text-teal-deep focus-visible:outline-none focus-visible:text-teal-deep"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {cycle.name}
        </Link>
        <h1 className="t-h1 mt-2 text-ink">
          Submit a project
        </h1>
        <p className="mt-1 text-sm text-charcoal">
          Propose a project for your pod to vote on. One submission per cycle —
          you can edit until the window closes.
        </p>
      </div>

      {!tabVisible ? (
        <div className="rounded-card border border-ink/10 bg-white p-6 shadow-card">
          <p className="text-charcoal">
            Project submission is not currently open.
          </p>
          {openAt && now < openAt && (
            <p className="mt-2 text-sm text-meta tabular-nums">
              Opens{" "}
              {openAt.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
      ) : myPods.length === 0 ? (
        <div className="rounded-card border border-ink/10 bg-white p-6 shadow-card">
          <p className="text-charcoal">
            You are not a member of any pods in this cycle.
          </p>
          <Link
            href={`/cycles/${cycle.id}`}
            className="mt-2 inline-block text-sm font-semibold tracking-tight text-teal-deep transition-colors duration-150 hover:underline focus-visible:outline-none focus-visible:underline"
          >
            View cycle &rarr;
          </Link>
        </div>
      ) : (
        <>
          {inWarningWindow && !initialProposal && closeAt && (
            <div
              role="alert"
              className="mb-6 rounded-card border border-red/20 bg-red/10 px-4 py-3 text-sm text-red"
            >
              <strong className="font-semibold">Heads up:</strong>{" "}if you don&apos;t
              submit a project by{" "}
              <span className="tabular-nums">
                {closeAt.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
              , you won&apos;t be eligible to vote in the next phase.
            </div>
          )}
          <ProposalForm
            pods={myPods}
            initialProposal={initialProposal}
            submissionOpen={submissionOpen}
            closeAt={closeAt?.toISOString() ?? null}
          />
        </>
      )}
    </div>
  );
}
