// Pure solution-proposal vote tallying + project shortlist logic.
//
// Extracted verbatim from app/api/pods/[pod_id]/projects/finalize/route.ts so
// the shortlist cap math (min(max_projects, floor(active_enrollments /
// project_min))), the proposal-text extraction precedence, and the ranking
// rules are unit-testable without a database. finalizeProjectsForPod in
// lib/projects/finalize.ts orchestrates these against the DB.

export interface ProjectVoteRow {
  solution_proposal_id: number;
  vote_count: number;
}

export interface ProposalRow {
  id: number;
  proposal_text: string | null;
  proposal_data: unknown;
  created_at: string;
}

export interface RankedProposal {
  solution_proposal_id: number;
  total_votes: number;
  created_at: string;
  text: string;
}

export interface ShortlistSelection {
  ranked: RankedProposal[];
  eligible: RankedProposal[];
  ineligible: RankedProposal[];
  toCreate: RankedProposal[];
  shortlistCap: number;
}

/**
 * W2-001 shortlist cap: min(max_projects, floor(active_enrollments /
 * project_min)). project_min is clamped to >= 1 so a 0/negative config value
 * can't divide by zero.
 */
export function computeShortlistCap(
  config: { max_projects: number; project_min: number },
  activeEnrollments: number
): number {
  const projectMin = Math.max(1, config.project_min);
  return Math.min(
    config.max_projects,
    Math.floor(activeEnrollments / projectMin)
  );
}

/**
 * Submissions store their pitch in proposal_data (proposal_text is legacy and
 * typically null for UI-submitted proposals), so seed from
 * proposal_data.description first and fall back through other fields.
 */
export function extractProposalText(
  proposal_text: string | null,
  proposal_data: unknown
): string {
  const pd = (proposal_data ?? null) as
    | { description?: string; summary?: string; title?: string; name?: string }
    | null;
  return (
    pd?.description || pd?.summary || pd?.title || pd?.name || proposal_text || ""
  );
}

/** Sum vote_count per solution_proposal_id. */
export function tallyProjectVotes(
  votes: ProjectVoteRow[]
): Record<number, number> {
  const tallyMap: Record<number, number> = {};
  for (const v of votes) {
    tallyMap[v.solution_proposal_id] =
      (tallyMap[v.solution_proposal_id] || 0) + v.vote_count;
  }
  return tallyMap;
}

/**
 * Rank tallied proposals: votes desc, then created_at asc (earlier submission
 * wins ties). Proposals missing from `proposals` rank with empty
 * created_at/text, matching the original route behavior.
 */
export function rankProposals(
  tally: Record<number, number>,
  proposals: ProposalRow[]
): RankedProposal[] {
  const propMap: Record<number, { text: string; createdAt: string }> = {};
  for (const p of proposals) {
    propMap[p.id] = {
      text: extractProposalText(p.proposal_text, p.proposal_data),
      createdAt: p.created_at,
    };
  }

  return Object.entries(tally)
    .map(([id, total]) => ({
      solution_proposal_id: parseInt(id, 10),
      total_votes: total,
      created_at: propMap[parseInt(id, 10)]?.createdAt || "",
      text: propMap[parseInt(id, 10)]?.text || "",
    }))
    .sort((a, b) => {
      if (b.total_votes !== a.total_votes) return b.total_votes - a.total_votes;
      return a.created_at.localeCompare(b.created_at);
    });
}

/**
 * End-to-end shortlist selection: tally → rank → split on
 * project_vote_threshold (>= is eligible) → cap toCreate at the shortlist cap.
 */
export function selectShortlistProposals(
  votes: ProjectVoteRow[],
  proposals: ProposalRow[],
  config: {
    project_vote_threshold: number;
    max_projects: number;
    project_min: number;
  },
  activeEnrollments: number
): ShortlistSelection {
  const ranked = rankProposals(tallyProjectVotes(votes), proposals);
  const eligible = ranked.filter(
    (r) => r.total_votes >= config.project_vote_threshold
  );
  const ineligible = ranked.filter(
    (r) => r.total_votes < config.project_vote_threshold
  );
  const shortlistCap = computeShortlistCap(config, activeEnrollments);
  const toCreate = eligible.slice(0, shortlistCap);
  return { ranked, eligible, ineligible, toCreate, shortlistCap };
}
