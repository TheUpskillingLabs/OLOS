# 03 — Decision Debt

*The highest-value document. §1: decided and written down — confirm and move on. §2: decided but never recorded — each has a draft ADR you can confirm, edit, and commit. §3: deferred and still open — your actual first-week agenda, ordered by what they block.*

---

## §1 — Decisions made AND recorded (short, as predicted)

| Decision | Where recorded | Evidence |
|---|---|---|
| Email via Resend HTTP API, not Supabase SMTP | ratified #64; lib/auth/CLAUDE.md | [FACT: 05-lane-api §4] |
| Sector model + cycle lifecycle (five states, `mode`) | docs/SECTOR_MODEL.md ("owner-ratified" status lines) | [FACT: 06-lane-docs] |
| Org cycles / workstreams model | docs/ORG_CYCLES.md | [FACT] |
| Local labs: labs do **not** run their own open cycles; sub-cohorts via `pods.lab_id` | docs/LOCAL_LABS.md + 00067 | [FACT] |
| Lab-lead UX model ("owner Decision 9, ratified 2026-07-11") — superseded #117/#123 | docs/PRD-lab-lead-ux.md:251 + closure comments | [FACT: comments 4944151647/4944151893] |
| Weekly "What's next" messages are program-global (owner decision, PR #264 review) | SCHEMA.md:668 + 00088 | [FACT] |
| PR-only branch discipline | CLAUDE.md + docs (#257) — *written, not enforced* | [FACT: 5640b08] |
| Roadmap retired in favor of docs/audit/ canon | IMPROVEMENT_ROADMAP.md:4-6 preamble | [FACT] |
| Pulse → Learning Logs pivot rationale | docs/audit/IMPROVEMENT_ROADMAP Phase 1 + PROGRESS.md | [FACT] |

---

## §2 — Decisions made and NEVER recorded (draft ADRs to confirm & commit)

Each was reconstructed from commits/PRs/threads. The one-paragraph ADRs below are drafted for you to confirm with the team, then commit (suggested home: `docs/decisions/ADR-NNN-*.md`, or fold into the docs your team prefers). Full reconstruction: `06-lane-docs.md` §Undocumented decisions and `04-lane-schema.md`.

**ADR-1 — Prod was reset and rebuilt from a baseline dump (2026-07-11).** The single most consequential unrecorded decision. Chain replay failed at 00054 in rehearsal → `DROP SCHEMA public CASCADE` + generated `baseline.sql` at chain position 00077; archive + JSON backup taken; 54 participants restored; owners re-rooted. Record exists only on unmerged branch `claude/dev-prod-migration-plan-5pumez` [FACT: 8a967dd].
*Draft:* On 2026-07-11 OLOS-prod was reset and re-provisioned from a `supabase db dump` baseline reflecting migrations 00001–00077, because the accumulated chain no longer replayed cleanly on a fresh database. Consequences: prod's migration history no longer mirrors the repo chain file-for-file; future promotions apply only post-baseline migrations (00078+), and each application must be recorded; the two prod-only hand fixes made during cutover (participant_erasures RLS, participants_insert tightening) must be codified as chain migrations so dev/local/fresh rebuilds match prod. The plan/execution record shall be merged to mainline and `docs/environments.md` updated.

**ADR-2 — Documentation canon: in-place banners + docs/audit/, not archive/+EVOLUTION.md.** Two conventions were built in parallel; the banner convention landed, the archive/EVOLUTION convention died on the ghost branch — but the live issue tracker cites the dead convention's paths [FACT: #212/#213 vs grep].
*Draft:* OLOS marks superseded docs with in-place historical banners plus a small living set (README → ARCHITECTURE → SCHEMA → docs/audit/). The unmerged EVOLUTION.md/docs-archive restructure is rejected as a layout, but its content (era narrative, fully reconciled tracker) shall be salvaged into the winning layout, and issues #212/#213 re-pointed at mainline paths with corrected migration numbers.

**ADR-3 — Consent, agreement, and email-audit ledger (00032/00055/00057).** Shipped, live, and appearing in zero documentation — the one undocumented subsystem is the compliance surface [FACT: greps = 0 across SCHEMA.md and docs/].
*Draft:* Consent state lives in the database, versioned: `participants.agreement_version/_accepted_at` (funnel consent), `cycle_agreements` (per-cycle typed-signature ceremony), `agreement_acceptances` (append-only ledger), `email_log` (outbound email audit — note: currently written by no code path; either wire it up or drop it). These tables are the compliance surface for a live alpha holding real participant data and must be documented in SCHEMA.md with a retention note reviewed against the privacy policy.

**ADR-4 — Erasure via `delete_participant()` RPC, with a known FK gap.** Right-to-erasure is an owner-only SQL function logging to `participant_erasures`; the function omits `lab_leads`/`project_roles`, so erasing anyone holding those roles fails on FK — consciously deferred ("Fix … before relying on erasure in prod"), and **no issue tracks it** [FACT: AUTH_UNIFICATION_RUNBOOK.md:171-178; Lane B's open-issue list].
*Draft:* Erasure is a database RPC (works even when the app is distrusted); every erasure writes a tombstone row. Known limitation: lab_leads/project_roles FKs block erasure of role-holders; a small migration adding those deletes is required before erasure is exercised on prod. Tracking issue to be filed immediately.

**ADR-5 — Role authority unified into `participant_roles`; runbook superseded by the cutover.** 00054/00064/00065/00066 rebuilt authorization; legacy tables live behind sync triggers; ownership re-rooted under a hardcoded email; the runbook still says "Do NOT run any of this against prod" although the 07-11 baseline included it [FACT: 04-lane-schema §3f; INFER: med on execution path].
*Draft:* `participant_roles` is the single authority for authorization; `user_roles`/`participant_permissions`/`moderator_assignments`/`lab_leads` are transitional shims with forward-sync triggers, scheduled for a retirement pass. The runbook's prod-promotion procedure was superseded by the 2026-07-11 cutover; mark it executed/obsolete and schedule its listed follow-ups (legacy retirement, flags→roles, the ADR-4 FK fix).

**ADR-6 — Soft-delete absolutism ended: owner-gated hard-delete lifecycle RPCs.** `reset_cycle/pod/project`, `reset_participant`, `delete_participant`, tester self-reset hard-DELETE across ~20 tables (including pod/project memberships you knew as soft-delete-only), gated + audited via `owner_actions`. Each RPC carries a standing obligation: new participant-/cycle-referencing tables must be manually slotted into the deletes [FACT: 00079/00080 headers].
*Draft:* "Nothing is hard-deleted" is amended to: participant-facing flows never hard-delete; owner lifecycle operations may, through audited RPCs only. Every schema change adding a table that references participants or cycles MUST update the reset/delete RPCs in the same migration — this is a review-checklist item.

**ADR-7 — Participant handles may be rewritten while the network is small (00083).** De-suffixing changes live `/u/` URLs with no redirect; flagged "⚠️ Prod decision" and never decided [FACT: feedback-running-list.md:189].
*Draft:* Handles are identity-adjacent and rewritable for quality until OLOS promises handle stability (public profiles, printed materials); after that, renames require a redirect table. Whether 00083 applies to prod is decided explicitly (see §3.9).

**ADR-8 — One pod / one project per participant per cycle; weeks 0–12 rail.** `pod_limit` default 1 in cycle_config (deliberately not a DB constraint); roadmap-era "hardcoded 2-pod cap" language is dead [FACT: 00043; PROGRESS.md].
*Draft:* A participant commits to one pod and one project per cycle; the cap lives in `cycle_config.pod_limit` so future cycles can relax it without code. The cycle is a 13-slot week rail (0 Kickoff → 12 Showcase).

**ADR-9 — The de-facto release/quality model (nobody chose it; it happened).** Self-merge + CI-as-only-gate + after-the-fact audit sweeps, with `docs/environments.md` still instructing the local-merge flow that CLAUDE.md forbids [FACT: 02-lane-issues §4; 07-lane-ops §5]. This one is *yours to decide, not just record* — see §3.1.
*Draft (if ratifying a lightweight version):* For a 2–4 person volunteer team: CI must be green to merge (branch protection enforces); self-merge stays permitted for docs/copy/content; code PRs touching auth, migrations, money-path or participant data require one human review; the promote checklist is a doc, not oral tradition; CODEOWNERS reflects who actually reviews.

---

## §3 — Decisions deferred and still OPEN (your first-week agenda)

Ordered by blast radius. "Context" = who demonstrably holds it (from authorship/threads).

| # | Open decision | Blocks | Context | Co-lead tie-break needed? |
|---|---|---|---|---|
| 1 | **Review/merge policy going forward** (ADR-9): keep zero-review velocity, or gate the sensitive surface? Includes: branch protection on/off, CODEOWNERS membership, promote checklist | Every other governance fix; PR #302 sitting unreviewed now | whole team; you own the call | **Yes — this is the co-lead-shaped hole** |
| 2 | **Prod reconciliation**: are 00078–00091 applied? codify the two prod-only fixes; re-seed the ledger; merge ADR-1 record | Safe application of every future migration; erasure readiness | whoever ran the 07-11 cutover [UNVERIFIED — likely HQ/brendanwhitaker session]; Supabase dashboard holder | Yes (owner-level data risk) |
| 3 | **#213 — revocation cron**: re-enable? cadence? labs-model interaction (warn/revoke counts pod_memberships lab-agnostically)? Was 8 weeks of non-enforcement policy or drift? | Enrollment integrity for the next cycle; your #110 machinery staying dead | **you** (author) + brendanwhitaker (filed #213) | Yes |
| 4 | **PR #302's visibility default** (decided this morning, reversible): participants see pending/unmoderated survey observations marked "awaiting review," because no approve UI exists. Accept, or keep approved-only gate and build the approve UI first? Also ratify the growing Triangulator cross-repo contract (`repo_url`, `#r-<id>` anchors ↔ triangles#72) | Merging #302; survey-results trust; consent posture for the 17 pending submitters [UNVERIFIED consent implication] | brendanwhitaker | Yes — he explicitly asked for the shout |
| 5 | **#212 — metro-blind registration** (p1): show HQ-open only, or HQ-open + local with labels? Issue must first be re-anchored — it cites ghost-branch code that doesn't exist | Correct routing for next cohort; labs launch narrative | brendanwhitaker; labs model in LOCAL_LABS.md | Yes (product call) |
| 6 | **#77 — auto-apply migrations in CI**: ratify and schedule. The manual ritual is what produced the July drift → reset | Removes risk #2's recurrence | you (filed it); amguzzi/inferno-gh (current migration hands) | Decision is easy; needs an owner |
| 7 | **Unfiled p1 — blind-voting authorship leak** (`solution-proposals` GET returns `participant_id`): file and fix, or accept? | Voting integrity; was flagged 07-11 and dropped | brendanwhitaker (flagged it in #117 closure) | File it — a 10-minute act only leadership will do |
| 8 | **#125 (A/B/C revocation-row cleanup) + #115 (audit columns)**: pick the option; both are your old designs; #115's migration number is stale | access_revocations hygiene; #125 blocks on #115 for option B | you | Yes (you wrote the options) |
| 9 | **00083 on prod?** (handle rewrite, no redirect) + 00082 (availability wipe — verify no real selections) + 00089 manual backfill execution | Prod application of the pending migration block (ties to #2) | amguzzi | Yes |
| 10 | **#179 — do admins/staff file Learning Logs / appear in health aggregations?** (carried from closed #122, never ratified) | Learning-log analytics correctness | brendanwhitaker + inferno-gh (moderator surface) | Yes |
| 11 | **#119 — email the .ics on registration, or rely on Luma?** | Registration comms polish | amguzzi | Low — delegate |
| 12 | **#96 — native-restyled vs fully custom dropdown** (accessibility-vs-UX call, waiting on the author) | Forms polish; #106 a11y work | amguzzi | Low — delegate |
| 13 | **#182 — where do ~15 marketing articles live; Squarespace cutover timing** | Marketing-site migration | brendanwhitaker | Low |
| 14 | **Owner-decision queue** (IMPROVEMENT_ROADMAP §queue, 14 items): esp. #1 pulse fields with no Learning-Log home (keep/drop energy_level, highlight, tailwinds…); items 2/3/7 were "resolved-by-build, worth explicit ratification" | Closing the pivot cleanly | brendanwhitaker (wrote the queue) | Yes — it was written *for* this ratification loop |
| 15 | **Your own parked branches**: merge `docs/comms-preview`? Execute or delete `docs-cleanup` (fixing the CLAUDE.md pointer first)? And the abandoned #230 revert + the 4-participant removal SQL (24610cf) — intent unknown | Branch hygiene; possible pending data surgery | you; brendanwhitaker (#230); [UNVERIFIED for 24610cf] | Yes for the data surgery |

**Suggested sequencing:** #1 and #2 are Day-1/Week-1 (see `04-REENTRY-PLAN.md`). #3–#5 before the next cycle opens registration. #6–#9 are the "stop the bleeding" cluster — each is under a day once decided. #10–#15 are the ratification loop you can run as a single 90-minute team session with this table as the agenda.
