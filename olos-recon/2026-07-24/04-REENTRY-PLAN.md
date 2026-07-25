# 04 — Re-entry Plan

*Ranked places to plug in, weighted toward co-lead work: unblocking decisions, resolving contradictions, reviewing the unreviewed surface, writing what only leadership can write. Scores 1–5 (5 = strongest case): **U** = unblocks others · **I** = irreversibility if it waits until the cycle starts · **F** = fit for someone freshly back · **T** = time to first useful output (5 = under an hour). Every item is executable by a 2–4 person volunteer team.*

## Ranked list

| Rank | Action | U | I | F | T | Why you, why now |
|---|---|---|---|---|---|---|
| 1 | **Review PR #302** — the only open code PR; contains an explicit data-visibility decision with "shout if you'd rather not"; CODEOWNERS already routes it to you; CI is green so your review is the only missing input [FACT: 08-DELTA] | 5 | 4 | 5 | 5 | The review vacuum is the repo's #1 structural problem and this is its live instance. Reviewing it also walks you through the propose→vote→pods arc and the new survey layer — a guided tour of July, ~500 net lines. |
| 2 | **Prod reconciliation conversation** — with whoever holds Supabase/Vercel: are 00078–00091 applied; was the ledger re-seeded; is CRON_SECRET/LUMA_API_KEY set; did the 00089 backfill run? Then write the answers into `docs/environments.md` | 5 | 5 | 4 | 4 | One conversation resolves every `Prod ?` in the change ledger. Gets *harder* once the next cycle's migrations start stacking. Only leadership can make "what is actually on prod" a first-class fact again. |
| 3 | **File the two missing p1s** — (a) blind-voting authorship leak (from #117's closure, quote ready); (b) erasure FK gap (lab_leads/project_roles, from the runbook). 10 minutes each; both are participant-data issues in live alpha [FACT: comment 4941719186; AUTH_UNIFICATION_RUNBOOK.md:171-178] | 4 | 4 | 5 | 5 | Both were flagged by the team and dropped for lack of an owner. Filing them is pure leadership signal: findings don't evaporate anymore. |
| 4 | **Decide the review/merge policy (Decision-Debt §3.1)** and make it real: branch protection on `main`+`dev`, CODEOWNERS += inferno-gh, the ADR-9 draft as the proposal, promote checklist into CONTRIBUTING | 5 | 3 | 4 | 3 | The team wrote the rule themselves (#257) and couldn't enforce it. An enforcement toggle + a 5-line policy is volunteer-sustainable; a review-everything regime is not — the ADR-9 draft threads that needle. |
| 5 | **Re-adopt your revocation/enrollment machinery (#213 + #212)** — decide cadence + labs semantics, re-enable the cron behind a dry-run flag, re-anchor #212 to real code paths, assign both | 4 | 4 | 5 | 3 | It's your code (#110 phases); nobody else has touched the design. Enrollment enforcement being dark is exactly the kind of thing that bites mid-cycle. |
| 6 | **Run the ratification session** — 90 minutes, team call, agenda = Decision-Debt §3 rows 8–15 + §2 ADRs 1–8 confirm/correct | 4 | 3 | 5 | 3 | Most items are "defaults chosen by build, awaiting explicit ratification" (the team's own words). Only a co-lead can close them; each closure unblocks a volunteer. |
| 7 | **Ship #77 (auto-apply migrations in CI)** or delegate it with a deadline — the fix for the drift-then-reset failure mode, designed by you in May | 4 | 4 | 4 | 2 | A day of work; the single highest-leverage guardrail before the next cycle's migration traffic. |
| 8 | **Salvage the ghost docs** — cherry-pick `docs/prod-migration-plan.md` (ADR-1 evidence) and the EVOLUTION.md/reconciled-tracker *content* (numbers corrected) onto mainline; re-point #212/#213 refs; close PR #248-vs-#199 fork and your two parked branches while in there | 3 | 3 | 4 | 3 | Docs-only cherry-picks; ends the "open p1s cite 404s" embarrassment and lands July's best reconciliation work. |
| 9 | **Clear the review queue** — the 7 pre-existing open PRs (#173, #185, #199, #243, #244, #248, #286) all name you as requested reviewer; each is docs/UX-scale; approve/close each with one line | 3 | 2 | 5 | 4 | Cheap goodwill + tracker hygiene; #286 (VIBE_SCAN) unlocks the referenced-but-invisible findings ledger. |
| 10 | **Harden the cron auth pattern** (fail closed on unset CRON_SECRET; add CRON_SECRET/LUMA_API_KEY to `.env.local.example`) — or delegate with the pattern one-liner | 3 | 3 | 3 | 4 | Small, sharp, and known; pairs naturally with #5 since revocation-check shares the pattern. |
| 11 | **Write the two docs only you can write** — the reconciler/revocation design note (half page) and the prod-apply runbook — then the SCHEMA.md consent-tables section (see `05-DOC-DEBT.md`) | 3 | 2 | 4 | 3 | Bus-factor-0 subsystems become bus-factor-1 the moment these exist. |
| 12 | **Data-surgery triage** — decide fate of `24610cf` (remove-4-participants SQL), the abandoned #230 revert, 00083-on-prod, 00082's wipe | 2 | 4 | 3 | 4 | Pending live-data mutations should not sit ambiguous when a cycle starts. |

*Deliberately excluded:* picking up a good-first-issue (#99, #106) — wrong altitude for week one; unshallowing/re-verifying the 18 stale claude/* branch tips — archaeology with no decision attached; building the survey approve-UI yourself — decide #302's policy first, then it's a clean volunteer delegation.

## Day 1 (first hour → end of day)

1. **First hour:** open PR #302, read `08-DELTA-2026-07-25.md` alongside, leave the review — approve with the visibility question answered, or request the approved-only gate. *This is the named "begin within an hour" action.*
2. Read `00-CATCHUP-BRIEF.md` (done, if you're reading this) + skim `01-CHANGE-LEDGER.md` rows marked H.
3. File the two p1s (#3 above — text is quotable from the lane files).
4. Send the prod-reconciliation questions (#2 above) to the team — async, so answers arrive by Week 1. Include the three questions at the end of this audit.

## Week 1

- Hold the ratification session (#6) with Decision-Debt §3 as the agenda; walk out with §3.1 (review policy) and §3.3 (revocation) decided and assigned.
- Flip branch protection + CODEOWNERS per the decided policy (#4).
- Re-adopt #212/#213 (#5); start the cron in dry-run.
- Clear the 7-PR review queue (#9); merge the ghost-doc cherry-picks (#8).
- Write the reconciler note + prod-apply runbook (#11, first half).

## Before the next cycle opens

- #77 live in CI (#7) — after prod reconciliation lands (#2), so auto-apply starts from a known state.
- Cron auth hardened (#10); revocation cron out of dry-run at the decided cadence.
- Erasure FK migration shipped (from the p1 filed on Day 1) — erasure must actually work before a cohort's data churns.
- SCHEMA.md consent section + environments.md prod-reset update committed (`05-DOC-DEBT.md` items 1–2).
- Data-surgery triage (#12) resolved — nothing ambiguous pointed at live participants when registration opens.
