# PRD — Directory: status labels, visibility tiers, follow affordances

| | |
|---|---|
| Status | Draft |
| Author | Drafted by Claude from the July 11 testing session (owner-triaged) |
| Last updated | 2026-07-11 |
| Source feedback | [`testing-feedback-2026-07-11.md`](testing-feedback-2026-07-11.md) — "Rework Active/Forming/Inactive labels" (Fix Soon); "Broader permissions logic isn't following intent" (Fix Soon, the un-shipped remainder); Feature Requests: "Move Follow action to the main directory page"; "Suggested follows based on local lab and pod membership" |
| Related code | `app/(dashboard)/directory/*` (search, result rows), `lib/directory/rank.ts` + `data.ts`, `app/components/ui/status-badge.tsx`, `lib/auth/permissions.ts`, `app/components/follow-button.tsx`, `app/(dashboard)/people-you-may-know.tsx` |
| Intent source | [`PRD-moderator-dashboard.md`](PRD-moderator-dashboard.md) §7.3.1 + §10 — the four-tier profile-visibility model |
| Shipped separately | Pod-page pulse leak removed + Pods-tab snap-back fix — PR #225. Live follower count + follow slot in profile card — PR #229 |

## 1. Problem

1. **Status labels confuse.** Pods/projects badge as Active / Forming /
   Inactive (`status-badge.tsx`, `STATUS_FILTERS`), which testers read as
   judgments ("Inactive" ≈ dead) and conflated with *member* activity —
   especially painful while enrollment status itself is being redefined
   ([`PRD-enrollment-activation.md`](PRD-enrollment-activation.md)).
2. **The documented visibility tiers are unimplemented.** PRD-moderator-
   dashboard §7.3.1 defines four tiers (always-in-row / on-expansion /
   click-through / never-visible-even-to-poderator). Code enforces only
   coarse capability checks; PR #225 removed the worst leak (pulse data on
   the public pod page) but no per-field tiering exists anywhere.
3. **Follow requires a detour.** Following someone means opening their
   profile; the directory list rows (`PersonRow`) have no follow affordance,
   and nothing suggests who to follow.

## 2. Requirements

### 2.1 Status label rework

- **R1.** Copy pass with the program team. Recommendation: pods use
  lifecycle language — *Recruiting* (forming), *Building* (active),
  *Wrapped* (closed/inactive); projects analogous. The words must not
  collide with member enrollment status.
- **R2.** Filter chips and badges change together (`STATUS_FILTERS`,
  `STATUS_VARIANT`, `statusRank` labels); DB values don't change — this is
  presentation only.

### 2.2 Visibility tiers (the "permissions vs intent" remainder)

- **R3.** Implement §7.3.1's tiers as data, not scattered conditionals: a
  single field-tier map (module in `lib/directory/` or `lib/participants/`)
  consumed by the directory row, expanded card, profile click-through, and
  the Poderator roster. Tier 4 fields (phone, free-text notes, consent
  flags) are excluded at the **query allowlist** level, extending the
  existing `DISPLAY_COLUMNS` pattern.
- **R4.** An audit test enumerates the tier map against each surface's
  selected columns so a new field can't silently leak (unit-testable pure
  module + column-list assertions).

### 2.3 Follow on the main page + suggestions

- **R5.** `PersonRow` gains the standard `FollowButton` (with
  `refreshOnChange` or optimistic count) directly in the directory list.
- **R6.** A "Suggested follows" rail: same lab first, then shared pod,
  then shared cycle — reusing the PYMK component's data pattern
  (`people-you-may-know.tsx`) with the lab/pod join added. Dismissible per
  suggestion.

## 3. Acceptance criteria

- No badge in the directory reads "Inactive" for a pod that is merely
  pre-`pod_min`; member vs pod status vocabularies are visibly distinct.
- Grepping a tier-4 column name across `app/` finds it only in owner-mode
  and admin surfaces; the audit test fails if a directory surface selects it.
- A member can follow from the list without opening the profile; counts
  update without hard refresh.
- Suggested follows show lab/pod-mates first and never resurface a
  dismissed suggestion.

## 4. Open questions

1. Tier 2 ("on expansion/hover") — the directory has no expanded person
   card today; build one, or collapse tiers 1–2 for the directory and keep
   tier 2 for the Poderator roster only?
2. Do suggested follows respect the Profile PRD's Hidden state (yes,
   presumably — confirm ordering of the two builds).
