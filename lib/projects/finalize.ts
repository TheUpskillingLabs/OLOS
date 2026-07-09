import { createServiceClient } from "@/lib/supabase/server";
import { checkWindow } from "@/lib/auth/windows";
import { generateName, nameFallback } from "@/lib/llm/names";
import { selectShortlistProposals } from "./shortlist";

// DB orchestration for turning a pod's solution-proposal votes into projects.
// Lifted from app/api/pods/[pod_id]/projects/finalize/route.ts so it can be
// triggered from three places with identical semantics:
//   1. POST /api/pods/[pod_id]/projects/finalize (per-pod admin/moderator button)
//   2. POST /api/cycles/[cycle_id]/advance-phase (auto-finalize every pod when
//      the project_registration phase opens)
//   3. Scripts (e.g. scripts/verify/cycle-e2e.mjs exercises the same flow)
//
// Returns a plain result object (not a NextResponse) so callers can relay or
// aggregate it. `status` carries the HTTP-ish status the route should return.

export interface FinalizedProject {
  id: number;
  name: string;
  solution_proposal_id: number;
  total_votes: number;
}

export interface ProposalTallySummary {
  solution_proposal_id: number;
  total_votes: number;
  rank?: number;
}

export type FinalizeProjectsResult =
  | {
      ok: true;
      status: 200;
      projects: FinalizedProject[];
      eligible_proposals: ProposalTallySummary[];
      ineligible_proposals: ProposalTallySummary[];
    }
  | { ok: false; status: 404 | 409 | 500; error: string };

export async function finalizeProjectsForPod(
  podId: number
): Promise<FinalizeProjectsResult> {
  // Service client throughout: callers are responsible for authorization
  // (admin or the pod's moderator), and the projects_insert RLS policy
  // requires is_admin_or_owner(), which a moderator is not — so a moderator
  // finalize on the user client would silently insert 0 rows (audit fix,
  // same RLS pattern as the naming/activation routes).
  const serviceClient = createServiceClient();

  // Get pod for cycle_id
  const { data: pod } = await serviceClient
    .from("pods")
    .select("cycle_id")
    .eq("id", podId)
    .single();

  if (!pod) {
    return { ok: false, status: 404, error: "Pod not found" };
  }

  // Idempotency guard first: like voting finalize, this appends projects
  // with no unique constraint, so a retry/double-click would duplicate them.
  // If this pod already has projects, treat it as already finalized (audit
  // fix). Checked before the phase gate so an already-finalized pod reports
  // that accurately rather than a misleading "solution voting is still open".
  const { count: existingProjectCount } = await serviceClient
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("pod_id", podId);

  if ((existingProjectCount ?? 0) > 0) {
    return {
      ok: false,
      status: 409,
      error: "Projects have already been finalized for this pod.",
    };
  }

  // Phase gate: finalizing while solution voting is still open would freeze
  // a partial tally into permanent projects (the idempotency guard above
  // then blocks a redo). Blocked while the window is open; cycles that never
  // set a solution_voting window are unaffected.
  const window = await checkWindow(serviceClient, pod.cycle_id, "solution_voting");
  if (window.open) {
    return {
      ok: false,
      status: 409,
      error:
        "Solution voting is still open for this cycle. Close it (or advance the phase) before finalizing projects.",
    };
  }

  // Get config
  const { data: config } = await serviceClient
    .from("cycle_config")
    .select("project_vote_threshold, max_projects, project_min")
    .eq("cycle_id", pod.cycle_id)
    .single();

  if (!config) {
    return { ok: false, status: 500, error: "Cycle config not found" };
  }

  // W2-001 shortlist cap: min(max_projects, floor(active_enrollments / project_min)).
  // Active enrollments is cycle-wide (not just this pod) per the AC.
  const { count: participantCount } = await serviceClient
    .from("cycle_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("cycle_id", pod.cycle_id)
    .eq("status", "active");

  // Tally votes
  const { data: votes } = await serviceClient
    .from("project_votes")
    .select("solution_proposal_id, vote_count")
    .eq("pod_id", podId);

  // Get proposals for text and tiebreaking (see lib/projects/shortlist.ts for
  // the proposal_data extraction precedence — audit fix: blank names).
  const proposalIds = Array.from(
    new Set((votes || []).map((v) => v.solution_proposal_id))
  );
  const { data: proposals } = await serviceClient
    .from("solution_proposals")
    .select("id, proposal_text, proposal_data, created_at")
    .in("id", proposalIds.length > 0 ? proposalIds : [0]);

  const { eligible, ineligible, toCreate } = selectShortlistProposals(
    votes || [],
    proposals || [],
    config,
    participantCount ?? 0
  );

  const names = await Promise.all(
    toCreate.map(async (prop) => {
      try {
        return await generateName("project", prop.text);
      } catch {
        return nameFallback(prop.text);
      }
    })
  );

  const insertRows = toCreate.map((prop, i) => ({
    cycle_id: pod.cycle_id,
    pod_id: podId,
    solution_proposal_id: prop.solution_proposal_id,
    name: names[i],
    status: "forming",
  }));

  const { data: insertedProjects, error: insertError } = insertRows.length
    ? await serviceClient.from("projects").insert(insertRows).select()
    : { data: [], error: null };

  if (insertError) {
    console.error("[projects-finalize] insert failed", insertError);
    return { ok: false, status: 500, error: "Failed to create projects" };
  }

  const projects = (insertedProjects || []).map((project, i) => ({
    id: project.id,
    name: project.name,
    solution_proposal_id: toCreate[i].solution_proposal_id,
    total_votes: toCreate[i].total_votes,
  }));

  return {
    ok: true,
    status: 200,
    projects,
    eligible_proposals: eligible.map((e, i) => ({
      solution_proposal_id: e.solution_proposal_id,
      total_votes: e.total_votes,
      rank: i + 1,
    })),
    ineligible_proposals: ineligible.map((e) => ({
      solution_proposal_id: e.solution_proposal_id,
      total_votes: e.total_votes,
    })),
  };
}
