/* Practice deck — the pure round-ordering logic. No storage, no DOM.
   The first round is the core situations; "More situations" deals the rest.
   Within a round, cards marked "not" come back first (stable otherwise). */

export type SelfCheck = "had" | "not";
export type SelfChecks = Record<string, SelfCheck>;

export interface DeckCard {
  id: string;
  core: boolean;
}

/** The cards for one round, "not yet" cards first, original order otherwise. */
export function dealRound<T extends DeckCard>(cards: readonly T[], checks: SelfChecks, core: boolean): T[] {
  return cards
    .filter((c) => c.core === core)
    .map((c, i) => ({ c, i, not: checks[c.id] === "not" ? 1 : 0 }))
    .sort((a, b) => b.not - a.not || a.i - b.i)
    .map((x) => x.c);
}

/** Cards shown stacked behind the top one (top + two behind). */
export const STACK_DEPTH = 3;

/** The visible slice of a round from position `at`; empty once the round is done. */
export function visibleStack<T>(round: readonly T[], at: number): T[] {
  return round.slice(at, at + STACK_DEPTH);
}

export function isRoundDone(round: readonly unknown[], at: number): boolean {
  return at >= round.length;
}

/** Whether a "More situations" round exists after the core one. */
export function hasMore(cards: readonly DeckCard[]): boolean {
  return cards.some((c) => !c.core);
}

/** Whether a swipe of `dx` px commits a rating, and which one. */
export const SWIPE_THRESHOLD = 110;
export function swipeRating(dx: number): SelfCheck | null {
  if (Math.abs(dx) <= SWIPE_THRESHOLD) return null;
  return dx > 0 ? "had" : "not";
}
