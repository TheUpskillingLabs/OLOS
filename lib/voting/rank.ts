/* Problem-statement ranking + pod selection — the pure core of voting
   finalize (app/api/voting/finalize/[cycle_id]/route.ts). Extracted so the
   per-lab formation ("pods are local only", docs/LOCAL_LABS.md) can run this
   once per lab partition, and so the tiebreak/threshold/cap logic is unit
   testable without a database. No DB access, no side effects. */

export interface RankItem {
  problem_statement_id: number;
  total_votes: number;
  /** ISO timestamp; earliest submission wins ties. */
  created_at: string;
}

export interface RankResult {
  /** All items, sorted by votes desc then created_at asc. */
  ranked: RankItem[];
  /** Ranked items with total_votes >= voteThreshold. */
  eligible: RankItem[];
  /** Ranked items below the threshold. */
  ineligible: RankItem[];
  /** Top `maxPods` of `eligible` — the statements that become pods. */
  selected: RankItem[];
}

/**
 * Rank a set of problem statements and pick the pod-forming winners.
 *
 * Ordering matches the historical finalize: votes descending, then earliest
 * `created_at` first as the deterministic tiebreak. `eligible` keeps only
 * statements at or above `voteThreshold`; `selected` is the top `maxPods` of
 * those. Callers running per lab pass just that lab's statements and get that
 * lab's cap applied independently.
 */
export function rankAndSelect(
  items: RankItem[],
  opts: { voteThreshold: number; maxPods: number }
): RankResult {
  const ranked = [...items].sort((a, b) => {
    if (b.total_votes !== a.total_votes) return b.total_votes - a.total_votes;
    return a.created_at.localeCompare(b.created_at);
  });

  const eligible = ranked.filter((r) => r.total_votes >= opts.voteThreshold);
  const ineligible = ranked.filter((r) => r.total_votes < opts.voteThreshold);
  const selected = eligible.slice(0, Math.max(0, opts.maxPods));

  return { ranked, eligible, ineligible, selected };
}
