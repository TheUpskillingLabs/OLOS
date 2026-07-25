# 05 — Documentation Debt

*Ranked by churn-to-documentation ratio (from `06-lane-docs.md` §Drift) and blast radius. "Self" = you can write it from repo evidence alone; "Interview" = requires a teammate's context. Time estimates assume one focused volunteer sitting.*

## Ranked backlog

| Rank | Gap | What's missing | Knowledge holder | Time | If it stays missing |
|---|---|---|---|---|---|
| 1 | **Prod state & reset record** (mainline has none) | Merge `docs/prod-migration-plan.md` from the ghost branch; update `docs/environments.md` (last touched 07-09, *before* the 07-11 reset it should describe); record 00078–00091 application status | Interview: cutover operator + Supabase dashboard holder; then Self | ½ day incl. the conversation | Every future migration is applied against an unknown base; next drift incident is unexplainable |
| 2 | **SCHEMA.md consent/erasure/email layer** — zero mentions of `agreement_acceptances`, `email_log`, `participant_erasures` anywhere in docs | ERD + summary rows + retention note (ADR-3/-4 drafts are the skeleton) | Self (migrations 00055/00057/00058 are readable) | 2–3 h | The compliance surface of a live alpha is undocumented; erasure FK gap stays invisible |
| 3 | **Admin console as-built** (30:1 churn ratio, top of drift table) | One page: shell + 4 sections map, route list, who may do what | Interview: brendanwhitaker (PR #202) | 2 h | Highest-churn subsystem legible only to its author |
| 4 | **Poderator dashboard subdoc** — `docs/poderator-dashboard/CLAUDE.md` frozen 06-01, still pointed to by root CLAUDE.md, while health model repointed pulse→learning logs | Rewrite or redirect the subdoc; reconcile with your parked `docs-cleanup` branch (which deletes it) | Interview: inferno-gh (lib/moderator) | 2 h | Root CLAUDE.md actively misleads every agent session touching moderator code |
| 5 | **Learning/Leadership Logs home doc** (subsystem born post-cutoff; ∞ ratio) | One page: instruments, gates (`eligible.ts`/`gate.ts`), crons, v2 schema, what replaced pulse and what pulse fields died (Decision-Debt §3.14) | Interview: amguzzi (#265) + brendanwhitaker (pivot) | 3 h | The measurement spine of the program has no design record |
| 6 | **Release/promote runbook + review policy** | 1-page promote checklist (currently oral tradition + PR #219/#280 bodies); ADR-9 outcome; fix `docs/environments.md:109-128` which still instructs the forbidden local-merge flow | Interview: inferno-gh; policy: you | 2 h | The rule/reality contradiction keeps producing #287-style three-PR cleanups |
| 7 | **Reconciler + revocation design note** | Half page on the #110 state machine — currently exists only in your commit messages | **Self — you are the holder** | 1–2 h | Bus factor stays 0 on enrollment enforcement |
| 8 | **Owner console** (no doc at all) | Reset/delete RPC semantics, the "new tables must be slotted into the RPCs" contract (ADR-6), `OWNER_CONSOLE_ENABLED` flag | Self (00078–00081 headers are good) | 1–2 h | The most destructive surface in the system is undocumented |
| 9 | **supabase/CLAUDE.md repair** | Renumber-history table is 6 events behind (2 of 8 recorded); "we already have 12 files" vs 91; delete the fossil W1-002 section; add the baseline-reset note | Self | 1 h | The migration-discipline doc undermines its own credibility |
| 10 | **Roadmap §6 + docs/audit refresh** | Apply the corrections below; add a staleness banner to docs/audit/ pointing at its 07-04 snapshot date; salvage the ghost tracker's reconciled content | Self (corrections below) | 1–2 h | Three "current state" artifacts, all wrong differently |
| 11 | **API as-built inventory** | The route/auth table from `05-lane-api.md` §1 is 90% of it — commit a trimmed version as `docs/API.md` | Self (lift from lane file) | 1 h | 118 routes legible only by grep |
| 12 | **scripts/ops/CLAUDE.md prod-ref fix** | Line 51 names the **dev** project ref as production — one-line fix, real misfire risk | Self | 5 min | A future ops script guards the wrong database |
| 13 | **Triangulator contract note** (new, from PR #302) | Where `repo_url` links point, what `#r-<id>` anchors promise to `triangles`, what OLOS must not break | Interview: brendanwhitaker | 1 h | A second repo grows dependencies on undocumented OLOS contracts |

Split: **Self-writable now:** 2, 7, 8, 9, 10, 11, 12. **Needs an interview:** 1, 3, 4, 5, 6, 13.

---

## Ready-to-apply corrections — SCHEMA.md (from `04-lane-schema.md` §2)

Line numbers per current SCHEMA.md (last commit 115815e, 07-18).

1. `:3` — header says **"19 tables"** → replace with **59 tables** (58 CREATEs surviving + `cycle_weekly_messages` dropped in 00088).
2. `:55, :67, :76, :88, :550` — five references attribute cycle_phases/cycle_events/start_at/timezone to migration **00085** → change all to **00086** (renumbered 07-13, `7aab1bf`).
3. **Add missing tables** (zero mentions today): `nominations` (00010/00017), `nudge_dismissals` (00023), `moderator_ui_state` (00024), `feedback` + `feedback_attachments` (00029), `agreement_acceptances` (00055), `email_log` (00057), `participant_erasures` (00058). Add Table-Summary rows (currently 45 rows vs 59 tables) for these plus: `participant_permissions`, `sectors`, `lab_leads`, `cycle_agreements`, `participant_roles`, `cycle_phases`, `cycle_events`.
4. `:102-134` cycle_config ERD — add: `phase_2_start`/`phase_3_start` (00006); `pulse_band_warning_min`, `pulse_band_critical_min`, `at_risk_consecutive_misses`, `pulse_agg_default_weeks`, `ai_summary_prompt` (00026); `leadership_log_due_at`, `leadership_log_gate_paused` (00069).
5. `:136-185` participants ERD — add: `auth_user_id` (00001:56 — the RLS join key!), `is_staff`/`is_test` (00041), `years_experience`, `education_level`, `sector_other`, `created_via` (00056), `lab_follow_seeded` (00075), `page_follows_seeded` (00076), `archived_at` (00079).
6. `:334-340` pod_memberships ERD — add `preference_rank` (00028).
7. `:302-308` problem_statements ERD — add `metro_id` (00068).
8. `:61-72` cycles ERD — add `description`/`what_you_build` (00059); document the six-status lifecycle (draft/upcoming/active/closing/archived/closed, 00049).
9. `:680` — cycle_enrollments status CHECK shown as 00037's four values → six values since 00056 (`interested`, `completed` added).
10. `:319-332` pods ERD — status now includes `dissolved` (00063).

## Ready-to-apply corrections — OLOS-roadmap.md §6 (from `06-lane-docs.md` §Roadmap)

Preserve the "Wave-1 historical record" framing; fix the rows that are wrong *as history* and close the loop:

1. Header `:5` — "Last updated: April 30, 2026" + "This is the source of truth" → add one line: *"Superseded 2026-07-08 by docs/audit/ (see §6 staleness note); §6 statuses frozen as history — corrected 2026-07-25."*
2. §1.2 (#40) "in review" → **shipped** (PR #58 merged, `4f3ef32`).
3. §1.3 (#41) "in progress" → **closed** [INFER: high — set-difference; verify state_reason when editing].
4. §1.4 (W1-004) "not started" → **shipped 2026-05-19** (`scripts/migration/migrate.py`, `a4c1667`); approach later retired in favor of self-registration.
5. §1.6 (#44) "in review" → **shipped**.
6. §1.9 (#47) → **closed; entire pulse subsystem since retired** (Learning-Log pivot, 07-04) — `app/(dashboard)/pulse-check/` still in-tree pending removal decision.
7. §1.13 (#51) "pick up after #110 lands" → **contradicted: closed not-planned 07-06**, #110 closed 07-11.
8. §1.14 (#87) "downgraded/depends" → **closed as completed 2026-07-06**.
9. §2.1 → shipped as `cycle_config.pod_limit` (00043). §2.3 → shipped (admin cycle-config editor; patched by #293).
10. §5 D1–D4 "all OPEN" → D1 resolved (preference_rank, 00028); D4 resolved (00011); D3 (mentors) still open → moved to IMPROVEMENT_ROADMAP; D2 note per same file.
11. Optionally graft the ghost branch's fully reconciled §6 (commit `6b204f1:docs/OLOS-roadmap.md`) **after correcting its migration numbers** (its 00038/00039 = dev's 00062/00067 world) — that version resolved every row with accurate history [FACT: git show 6b204f1:docs/OLOS-roadmap.md].

*Also fix while in the tracker neighborhood:* #212's body cites `docs/EVOLUTION.md`, migrations 00038/00039, and `lib/cycles/registration.ts`/`getRegistrationCycle()` — none exist on mainline; re-anchor to the funnel route + LOCAL_LABS.md before anyone works it. #213's body claims vercel.json registers only pulse-check-reminder (deleted 07-04; five other crons exist) [FACT: bodies vs grep/vercel.json].
