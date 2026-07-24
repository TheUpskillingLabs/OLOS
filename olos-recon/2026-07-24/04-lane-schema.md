# Lane D — Data model & migration drift (OLOS re-entry audit)

**Audit cutoff (LAST_ACTIVE_DATE): 2026-06-18** — adm-2k's last commit [FACT: d8d4741, 2026-06-18, on unmerged branch `origin/docs-cleanup`].
**Baseline correction:** the prescribed formula (`git rev-list -1 --before=… origin/dev`) returns **1d3615f**, but that is a long-lived *docs side-branch* commit whose tree ends at migration 00018 + a duplicate 00015 — unrepresentative. The true tip of both `dev` and `main` at the cutoff is **a164dff** (2026-06-04, merge PR #131; nothing landed on either mainline between 06-04 and 06-18) [FACT: `git log --first-parent origin/dev|origin/main`]. Its migration chain is **00001–00030**, exactly matching the tree of the co-lead's last commit [FACT: `git ls-tree a164dff/d8d4741 -- supabase/migrations/`]. **The co-lead's known schema world = migrations 00001–00030.**
**Orientation note:** the tasked `00-ORIENTATION.md` path resolved to "undefined" and the file does not exist anywhere on disk (searched /tmp, /home/user); proceeded on independently verified facts.

**Bottom line: 61 new migrations (00031–00091) landed in the co-lead's absence — two-thirds of today's 91-file chain — and prod was not migrated to them: it was reset and rebuilt from a schema *baseline dump* on 2026-07-11 because a rehearsal proved the chain does not replay cleanly.**

---

## 1. New migrations since cutoff (00031–00091, all read in full)

Every one of the 61 files was read as text. "dev" = first-add commit date on origin/dev; "main" = date the file reached origin/main via first-parent (promote) merge [FACT: per-file `git log --diff-filter=A`; main promotes: 19a52db 07-03, 1a6ef3b 07-11 cutover, d8b2efc 07-12, 9f729d0/018e03e 07-13, 22e8c28 07-14, 9eebfc1 07-15, fb1ec0b 07-16, e23e62f #296 07-22].

Author counts for the 61: Claude-agent commits ≈ 50, amguzzi 9, MJ 1 (+ HQ on renames). The giant 00033–00069 block (37 files) landed in one wave with **no tracking issue**, retroactively recorded by issue #214 [FACT: commit a5942ea 2026-07-08; #214 per Lane B's verified read — INFER: high].

| # | Purpose (one line) | Added by | dev | main |
|---|---|---|---|---|
| 00031 | participants funnel cols: zip, metro_slug, role_intents[], referred_by, agreement_version/_accepted_at | 13def18 Claude | 07-03 | 07-03 |
| 00032 | `cycle_agreements` table (typed-signature cycle registration; UNIQUE participant+cycle) | 80cf522 Claude | 07-03 | 07-03 |
| 00033–00069 | **one 37-file wave** (a5942ea, Claude, "July wave" / #214): public-content CMS (events/resources/metros/waitlist/rsvps 00033-34), Luma sync (00035), `DELETE FROM resources` (00036), schema hardening (00037: status CHECKs, set_updated_at(), can_write_cycles(), indexes), metros zip mapping (00038), rsvp ip_hash (00039), learning_logs+profile_updates (00040), staff/test flags (00041), testers (00042), cycle_config.pod_limit (00043), directory handle/bio/metro_id (00044), profile_image_url dev-drift repair (00045), avatars bucket (00046), milestone weeks (00047), one_active_cycle (00048), sector model (00049), saved_items (00050), spotlights (00051-52), field surveys (00053), participant_roles (00054), agreement_acceptances (00055), intake+`interested` status (00056), email_log (00057), is_admin/is_owner + delete_participant erasure RPC + participant_erasures (00058), cycle info copy (00059), org cycles/workstreams/project_roles (00060), survey question builder (00061), local labs/lab_leads (00062), pod `dissolved` (00063), roles unification (00064), roles backfill+sync triggers (00065), owner re-root (00066), HQ open-cycle sub-cohorts (00067), local-pod membership fence trigger (00068), leadership_logs (00069) | a5942ea Claude | 07-08 | 07-08 (cutover 07-11 for prod tree) |
| 00070–00077 | LinkedIn-style social layer: announcements (70), lab-lead writes + is_lab_lead() (71), freeform posts (72), likes/comments (73), follows graph (74), lab-follow seed (75), page-authored posts + page_admins (76), project-follow backfill into follows (77) | d6705a0…aebcb70 Claude | 07-09 | 07-11 |
| 00078–00081 | owner console: owner_actions audit (78), participants.archived_at + hardened delete_participant + reset_participant (79), reset_cycle/pod/project RPCs (80), metros.archived_at (81) | 4bb0933/7e37ac8/e360b14 Claude | 07-11 | 07-12 |
| 00082 | availability option-list rebuild + backfill from agreements (authored as 00078, renumbered) | 16c8975 amguzzi | 07-12 | 07-12 |
| 00083 | data-only: de-suffix participant handles (changes live /u/ URLs) | 5460f11 amguzzi | 07-12 | 07-12 |
| 00084 | cycle_config.theme_description | c3cdd32 amguzzi | 07-12 | 07-12 |
| 00085 | service-role admin paths — guard_email_change/change_participant_email/delete_participant accept service_role (authored as 00068, renumbered) | fa1180d amguzzi | 07-13 | 07-13 |
| 00086 | cycle_phases + cycle_events tables, cycles.start_at, metros.timezone, seeds Cycle-3 anchor events (authored as 00085, renumbered; PR #261) | 7aab1bf MJ | 07-13 | 07-13 |
| 00087 | baseline_responses + cycle_weekly_messages; learning_logs.kind += 'baseline' | 0090627 Claude | 07-14 | 07-14 |
| 00088 | **DROP TABLE cycle_weekly_messages** → global weekly_messages (owner decision in PR #264 review) | fa5745e Claude | 07-14 | 07-14 |
| 00089 | partial unique: one field_survey per cycle | 0032003 amguzzi | 07-14 | 07-15 |
| 00090 | data backfill: 31 Google-Form civics responses inserted verbatim (authored as 00089, renumbered) | 566540e Claude | 07-16 | 07-22 (#296) |
| 00091 | Learning Log weekly v2: 10 new columns; clarity/alignment DROP NOT NULL (authored as 00087, renumbered twice 00087→00090→00091) | 115815e amguzzi (PR #265) | 07-18 | 07-22 (#296) |

---

## 2. Schema reconstruction vs SCHEMA.md

**Current schema (reconstructed from the full chain):** **59 public tables** (58 CREATEs surviving + none dropped except `cycle_weekly_messages`, created 00087 and dropped 00088) [FACT: grep CREATE TABLE across supabase/migrations/, minus 00088's DROP]. Core spine unchanged (cycles→pods→projects); major new subsystems since 00030: public-content CMS, Learning/Leadership Logs + baseline instrument, sectors/workstreams/org-cycles, local labs, unified `participant_roles` authority, field-survey sensemaker, social layer (follows/posts/likes/comments/page_admins), owner lifecycle console (owner_actions + destructive RPCs), cycle_phases/cycle_events calendar. Independently corroborated: the cutover record counted **55 tables** on prod at chain-position 00077 [FACT: origin/claude/dev-prod-migration-plan-5pumez:docs/prod-migration-plan.md "EXECUTION RECORD"]; +4 since (cycle_phases, cycle_events, baseline_responses, weekly_messages) = 59.

**SCHEMA.md** (903 lines, root) was last updated **2026-07-18** by the same PR that shipped 00091 [FACT: 115815e]. It is *far* better than typical drift — the prose notes track migrations through 00091 — but discrepancies remain:

1. **Header table count stale**: "19 tables" [FACT: SCHEMA.md:3] vs 59 actual.
2. **Wrong migration number for the whole calendar feature**: cycle_phases/cycle_events/start_at/timezone are attributed to `00085` at SCHEMA.md:55, :67, :76, :88, :550 — the file is **00086** (renumbered from 00085 on 2026-07-13, after these doc paragraphs were written) [FACT: 7aab1bf rename; SCHEMA.md lines cited].
3. **Ten tables absent from SCHEMA.md entirely** (0 mentions): `nominations` (00010/00017), `nudge_dismissals` (00023), `moderator_ui_state` (00024), `feedback` + `feedback_attachments` (00029), `participant_erasures` (00058), `agreement_acceptances` (00055), `email_log` (00057) [FACT: grep counts vs SCHEMA.md]. `participant_permissions` (00009) gets one passing mention (SCHEMA.md:851); `sectors`, `lab_leads`, `cycle_agreements`, `participant_roles`, `cycle_phases`, `cycle_events` appear in ERDs/notes but are **missing from the Table Summary** (SCHEMA.md:855-903, 45 rows vs 59 tables).
4. **cycle_config ERD** (SCHEMA.md:102-134) missing: `phase_2_start`/`phase_3_start` (00006), `pulse_band_warning_min`/`pulse_band_critical_min`/`at_risk_consecutive_misses`/`pulse_agg_default_weeks`/`ai_summary_prompt` (00026), `leadership_log_due_at`/`leadership_log_gate_paused` (00069).
5. **participants ERD** (SCHEMA.md:136-185) missing: `auth_user_id` (00001:56 — the actual RLS join key), `is_staff`/`is_test` (00041), `years_experience`/`education_level`/`sector_other`/`created_via` (00056), `lab_follow_seeded` (00075), `page_follows_seeded` (00076), `archived_at` (00079 — Table Summary row 861 has it, ERD doesn't).
6. **pod_memberships ERD** (SCHEMA.md:334-340) missing `preference_rank` (00028 — a co-lead-era column).
7. **problem_statements ERD** (SCHEMA.md:302-308) missing `metro_id` (00068).
8. **cycles ERD** (SCHEMA.md:61-72) missing `description`/`what_you_build` (00059); status list not shown (now draft/upcoming/active/closing/archived/closed per 00049).
9. **Hardening note stale**: SCHEMA.md:680 gives the cycle_enrollments status CHECK as 00037's four values; 00056 widened it to six (`interested`,`completed` added).
10. `pods` status now includes `dissolved` (00063) — not stated in the pods ERD (SCHEMA.md:319-332).

**supabase/CLAUDE.md** — the alleged quote is real, in the "Before writing a migration" section: *"The roadmap is the plan; [migrations/](migrations/) is the truth. They drift."* [FACT: supabase/CLAUDE.md:31]. Same file: forward-only policy with commented `-- DOWN:` blocks (:22), a **Renumber history** table listing only 2 of the 8 renumber events (:74-81), and the note that *"nothing in CI/deploy runs `supabase db push`"* (:79). Its bottom half is a stale per-issue working doc for W1-002/#40 (00012 seeding, May-era) (:85-158).

---

## 3. Invariant checks (vs actual DDL)

**(a) One project membership per participant per cycle — UPHELD.** `one_active_project_per_cycle` partial unique index on `project_memberships (participant_id, cycle_id) WHERE left_at IS NULL` [FACT: 00001_initial_schema.sql:253-255]. No later migration drops or modifies it (grep across chain: only 00001). Caveat: org-mode projects add a *parallel* ladder (`project_roles`, one **active role per person per project**, no cycle scope — 00060:one_active_project_role) that does not route through project_memberships, and the owner reset RPCs (00080) hard-DELETE membership rows.

**(b) Soft-delete on every table — CHANGED (never was `deleted_at`; convention is now three-way).** No `deleted_at` column has ever existed in the chain [FACT: grep]. The co-lead-era convention was per-table temporal columns: `inactive_at` (pod_memberships), `left_at` (project_memberships), `removed_at` (moderator_assignments), `revoked_at` (user_roles/participant_permissions) [FACT: 00001]. Since then: (i) that pattern continues on new role tables — `participant_roles.revoked_at` (00054), `lab_leads.removed_at` (00062), `project_roles.removed_at` (00060), `page_admins.removed_at` (00076); (ii) content tables use `status='archived'` (announcements 00070, spotlights 00051) or `archived_at` (participants 00079, metros 00081) or `active` flag (survey_questions 00061); (iii) **a growing set of tables is hard-delete by design**: follows, profile_update_likes/comments (self-DELETE RLS policies, 00073/00074), saved_items (toggle, 00050), profile_updates (owner-retract DELETE policy, 00040), testers, cycle_phases/cycle_events (admin `FOR ALL`, 00086), weekly_messages (00088). Biggest model change: the owner RPCs `delete_participant`/`reset_participant`/`reset_cycle`/`reset_pod`/`reset_project` (00058/00079/00080) **hard-DELETE rows from ~20 tables including pod_memberships/project_memberships** — tables the co-lead knew as soft-delete-only — plus 00042's tester self-reset. All are gated (owner-only / tester-self) and audit-logged to `owner_actions` (00078), but "nothing is ever hard-deleted" no longer holds.

**(c) Phase windows in cycle_config — CHANGED: still the write model, no longer the sole read model.** The twelve `{phase}_open/_close` TIMESTAMP columns from 00001 (00001:37-48) are intact; 00006 added `phase_2_start`/`phase_3_start`; **00026** (co-lead era) added poderator-dashboard tunables (pulse bands, at-risk misses, agg weeks, ai_summary_prompt) [FACT: 00026 full text]. Post-cutoff additions to cycle_config: log_due_at/log_gate_paused (00040), pod_limit (00043), milestone weeks (00047), leadership_log_* (00069), theme_description (00084). **00086** created `cycle_phases` (TIMESTAMPTZ `[starts_at,ends_at)` rows, seeded from the naive columns AT TIME ZONE 'UTC') as the tz-aware **read model**; per SCHEMA.md:55 the admin PATCH still writes cycle_config and mirrors into phases via `syncPhasesFromConfig()`; "Stage 2 flips write authority and retires the columns" — pending. Gating reads phases first, falls back to legacy columns [FACT: SCHEMA.md:55; 00086 header].

**(d) Pods many-per-cycle — UPHELD**, with additions: no uniqueness on pods per cycle was ever added; org runs add `one_run_per_workstream_per_cycle` (00060) and pods gained `lab_id` (00067) + a lab-membership fence trigger `enforce_local_pod_membership` on pod_memberships (00068). Note the *membership* cap changed: hardcoded 2-pods-per-member (app-level, co-lead era) → `cycle_config.pod_limit` default **1** (00043), enforced in routes, deliberately not a DB constraint.

**(e) 00048_single_active_cycle — a post-departure invariant the co-lead never had, then rescoped three times.** 00048 (July wave): data-fix demoting extra `active` cycles to `draft` + partial unique `one_active_cycle` ("two cycles drifted to active on dev — which 406s every `.maybeSingle()` read") [FACT: 00048 full text]. Evolution: 00049 adds ≤1-`upcoming` sibling + `mode` + five-state lifecycle; 00060 rescopes per mode (open/org; closed unconstrained); 00062 per (mode, lab); **00067 reverses for open mode** — one *global* HQ open cycle (`one_active_open_cycle`), labs as sub-cohorts via `pods.lab_id`, plus CHECK `cycles_open_is_hq_when_live`; org stays per-lab. Net vs the co-lead's model: cycles now carry `mode`/`sector_id`/`lab_id`/`start_at`, six statuses, and a lattice of five partial unique indexes; two cycles can legitimately be active at once (open + org) but never two open ones.

**(f) Role stacking — the model was rebuilt in three layers.** Correction to the task premise: **there is no `admin_roles` table**; 00058 is `admin_roles_and_erasure.sql` but creates *functions* (`is_admin()`, `is_owner()`, `guard_email_change`, `change_participant_email`, `delete_participant`) + `participant_erasures` [FACT: 00058 full text]. Timeline: `user_roles` (00001) → `participant_permissions` + invitations presets (00009) → **`participant_roles` (00054, ported from an external "onboarding redesign" repo — header: "Copy into OLOS's supabase/migrations/ — see handoff-to-olos/README.md")**: temporal rows, member roles (upskiller/volunteer/mentor/events) + operational (poderator/admin/owner/observer/developer), scoped by cycle/pod. Then the July unification: 00064 adds lab_id/project_id scopes, widens vocabulary (+lab_lead, co_lead, member, dri, contributor, staff, tester), rebuilds `uq_proles_active` over all four scopes, adds `guard_owner_grant` trigger, aligns `is_admin()` to owner/admin/developer; 00065 backfills from user_roles/participant_permissions(cycles:write)/moderator_assignments/lab_leads **and installs four forward-sync triggers** (legacy writers still live); 00066 re-roots ownership under `hello@brendanwhitaker.com` (granted_by NULL apex; hardcoded email; fresh-DB skip path). The 00064 header documents the incident motivating it: post-00054 grants were invisible to RLS ("pids 76 & 91 were app-admins that RLS did not recognize"). `user_roles`, `participant_permissions`, `moderator_assignments`, `lab_leads` all still exist and are still written (sync-shimmed) [FACT: 00064-00066 full text].

---

## 4. Destructive ops since cutoff (live alpha risk)

Run **at migration apply time** (vs defined-but-not-executed RPCs):

| File:line | Op | Blast assessment |
|---|---|---|
| 00036:6 | `DELETE FROM resources;` | Deliberate (library launches empty); destroys any editorially-added rows on re-apply environments. Ran post-00034 seed. Low (content only). |
| 00048:34 | `UPDATE cycles SET status='draft'` (demote extra actives) | Data-fix inside DDL migration; on any env with >1 active cycle it silently demotes cohorts by a "best represents now" heuristic. Medium. |
| 00056:18 | `UPDATE participants SET created_via='import'` | Blanket rewrite of a just-added default; safe once, wrong if re-run after real signups predate it (guarded by value check). Low. |
| 00062:104, 00038:22-24 | metros UPDATEs (is_default, zip_prefixes) | Seed-ish. Low. |
| 00065 (whole) | Role backfill INSERTs + 4 sync triggers | Rewrites the authority table from 4 legacy stores; hardcodes owner email lookup. High-consequence but idempotent (ON CONFLICT). |
| 00066 (whole) | Owner graph rewrite: re-root, demote maya fixture, mirror into user_roles | **Rewrites live authority provenance; not reversible** (header says restore from snapshot). High. |
| 00067:40-60 | `UPDATE pods SET lab_id`, `UPDATE cycles SET status='draft'` (fold per-lab cycles), `UPDATE cycles SET lab_id=NULL` | Restructures the cycles model in-place; "verified empty on dev" for the demoted case. Medium. |
| 00068:467-471 | Backfill problem_statements.metro_id | Low. |
| 00077:22 | Backfill project_subscriptions → follows | Low, guarded. |
| 00082:20-45 | **DELETE participant_options + DELETE option_lists ('availability') then re-seed + backfill** | Destroys prior availability selections by design ("current data is all test/team accounts"); wrong if run where real selections exist. Medium. In a BEGIN/COMMIT. |
| 00083:30-45 | UPDATE participants handles (de-suffix) | **Changes live /u/[handle] URLs; no redirect; header itself flags "Weigh that before applying to prod"**. Medium. |
| 00086:141-143, 203-259 | Backfill cycles.start_at; seed phases from naive columns; seed 6 hardcoded Cycle-3 anchor events | Assumes naive-columns-are-UTC convention; events hardcode ET dates. Low-medium. |
| 00088:395 | **`DROP TABLE cycle_weekly_messages;`** — the only hard DROP TABLE in the chain | Safe as shipped ("unreleased, no real data"); destructive if an env had authored messages between 00087 and 00088 (4 days apart on dev). Low. |
| 00090 (whole) | INSERT 31 external survey responses **with names/emails/phones inline in the SQL** | Data lands as designed; see security note §7. |
| 00091:601-603 | `ALTER COLUMN clarity/alignment DROP NOT NULL` | Constraint relaxation, not destructive; per-kind requiredness moved to app code. Low. |

Defined-but-not-executed destructive surface (runs later, at owner/tester action): `delete_participant` (00058, redefined 00079, 00085 — also deletes `auth.users` row), `reset_participant` (00079), `reset_cycle`/`reset_pod`/`reset_project` (00080 — cascade hard-deletes across the full cycle subtree incl. votes, statements, agreements), tester self-reset (00042). All owner-gated + audit-logged; each carries a header contract that **new participant-/cycle-referencing tables must be manually slotted in** — a standing schema-change obligation [FACT: 00079/00080 headers].

`ALTER TYPE`: none. `SET NOT NULL` without default: none (the 00025-era? none post-cutoff). `RENAME`: none in SQL (renames happened at file level, §5).

---

## 5. Numbering: gaps, collisions, ordering

- **No gaps, no live collisions**: 00001–00091 all present exactly once [FACT: ls]. Number order ≈ dev-merge order throughout (renumber-on-merge keeps it monotonic).
- **Eight renumber events total** (git -M rename detection) [FACT: `git log --all --diff-filter=R -M -- supabase/migrations/`]:
  | When | Rename | By |
  |---|---|---|
  | 2026-05-21 | 00016→00018 solution_proposals_rich_fields | adm-2k (pre-cutoff) |
  | 2026-06-02 | 00015→00028 preference_rank | Madhu — documented in supabase/CLAUDE.md:78 |
  | 2026-07-06/07 | 00054→00059 cycle_info_content — done **twice in parallel** (80b2120 PR #195 and ca35b90 on `claude/fix-cycle-info-migration-number`) | Brendan / Claude |
  | 2026-07-12 | 00078→00082 availability_reg_hours | amguzzi |
  | 2026-07-13 | 00068→00085 service_role_admin_paths | amguzzi — documented in supabase/CLAUDE.md:79 |
  | 2026-07-13 | 00085→00086 cycle_phases_events (#261) | MJ |
  | 2026-07-16 | 00089→00090 backfill_civics | Claude |
  | 2026-07-17 | 00087→00090→**00091** learning_log_weekly_v2 (renumbered twice in one day) | HQ |
  Only 2 of 8 are in supabase/CLAUDE.md's "Renumber history" table — the table is 5 events behind [FACT: supabase/CLAUDE.md:74-81].
- **The guard**: `scripts/check-migration-numbers.mjs` — zero-dep duplicate-prefix checker (normalizes 0048 vs 00048), added **2026-07-06 by PR #180 "Guard migration-number collisions + document parallel workflow"** — i.e., in direct response to the 00054 cycle-info collision that same day [FACT: bd87972]. Wired as `check:migrations` in package.json:12 and ci.yml:22. It catches collisions at PR time *within one tree* — the five later renumbers show it working as designed (collisions forced renames at merge instead of landing silently).
- **The `fix/00030-tightened-idempotency-predicate` branch is already merged** — its content (exclude `reason='reactivated'` from the access_revocations idempotency index, adm-2k, 2026-06-04) is on dev; the branch is just undeleted [FACT: `git merge-base --is-ancestor 45f209d origin/dev` = yes]. Relates to open issue #125.
- **Unmerged branches that would collide today** (would fail check:migrations on merge) [FACT: `git ls-tree` per branch vs dev]:
  - `claude/olos-dev-pod-project-creation-uz3wez` — 7 files 00033–00039 (cycle_registration_and_info, restore_proposal_data, votes policies, pod_limit, labs_lead_and_cycle_metro, hq_lab_cycle_model) — **all seven numbers taken by different files on dev**; this is the #214 "July wave" branch whose schema was superseded/reworked (its lab/HQ model landed instead as 00062/00067).
  - `claude/pod-project-pages-follow-adqggc` — 00060_showcase_columns, 00061_social_graph (both numbers taken).
  - `claude/slack-integration-setup-7nsvpw` — 00054_slack_integration (taken by participant_roles; matches issue #189's stale claim).
  - `claude/dev-prod-migration-plan-5pumez` — 00033/00034 variants (taken).
  - `feat/cycle-schedule-stage1` — pre-renumber 00085_cycle_phases_events + 00068_service_role (superseded by 00086/00085 on dev).
  - `claude/dev-cycle-info-page`, `claude/theupskillinglabs-content-capture-fo4qat` — pre-renumber 00054_cycle_info_content.
  - `origin/schema-development` is **stale, not colliding**: last commit 2026-04-08, chain ends at 00007 [FACT: c376051].

---

## 6. Prod application state (inference — no DB access)

- **How migrations reach environments**: manual only. docs/environments.md ("Applying to prod": paste into prod Studio SQL editor or CLI `db push` after merging to main; "Migrations are **not** applied to prod automatically") [FACT: docs/environments.md]; supabase/CLAUDE.md:79 "nothing in CI/deploy runs `supabase db push`". Open issue #77 (auto-apply on merge) is the standing fix, untouched since May [FACT: per Lane B]. **Local and dev share one Supabase project** (`cethihabtddiujzayaxe`); prod is `cdbgkgkjnomjnpicaxqe` [FACT: docs/environments.md table].
- **2026-07-06 state**: prod schema was at exactly **00032**, with ledger chaos (17 timestamp-versioned rows for 00016–00032; a 2026-06-02 repair script was written but never run) [FACT: scripts/ops/prod-migration-repair-2026-07-06.sql header — a precise diagnosis snapshot]. Companion dev repair script exists (scripts/ops/dev-migration-repair-2026-07-06.sql).
- **2026-07-11 cutover — prod was NOT migrated; it was reset and rebuilt.** The plan + execution record live on **unmerged branch** `claude/dev-prod-migration-plan-5pumez:docs/prod-migration-plan.md`: a rehearsal proved **the migration chain does not replay cleanly** — replay failed at 00054 because `participants.role_intents` was absent in the replayed history; "the migration *files* have drifted from the migration *history* that actually built dev". So prod got `DROP SCHEMA public CASCADE` + a generated **baseline.sql** (dev schema mirror; 55 tables/112 FKs/20 fns), archive schema + JSON backup taken, 54 participants restored, owners re-seeded (`hq@theupskillinglabs.org` rooted) [FACT: EXECUTION RECORD section, commit 8a967dd 2026-07-11]. **This record exists only on the unmerged branch** — main/dev carry no copy [INFER: high — grep of docs/ on dev finds no prod-migration-plan.md].
- **Since cutover**: migrations **00078–00091 (14 files)** post-date the baseline. All are on main as of 07-22 (#296). Whether each was hand-applied to prod is **not recorded in-repo**; promote PR bodies reportedly often say "No migrations" [UNVERIFIED — needs prod `supabase_migrations`/live-schema check, which this audit must not run]. Confidence prod is at ≥00077: high; at 00091: unknown.
- **Deploy-ordering requirements for anything pending on prod**: 00082 before profile-availability UI relies on the rebuilt option list (and destroys prior selections — verify none are real); 00083 changes member profile URLs (its own header says weigh before prod); 00086 seeds phases from cycle_config — must run after the live cycle's windows are entered, and its anchor events are hardcoded Cycle-3 ET dates; **00089 requires a documented manual per-environment backfill UPDATE that is deliberately NOT in the migration** (00089 header: match civics survey to its cycle by name); 00090 inserts 31 PII rows into the curation queue; 00091 relies on route code stamping schema_version='v2' (deploy code and migration together or logs violate app expectations in neither direction — additive, low risk).
- **Out-of-band prod-only fixes never codified as migrations** (execution record item 6): `participant_erasures` RLS enabled + admin policy; `participants_insert` tightened to `auth_user_id = auth.uid()` (chain version is `WITH CHECK (true)`, 00002:55). **Dev/local and any fresh rebuild regress to the unfixed state** — see §7.

---

## 7. Security-adjacent findings (paths only, no secrets found)

1. **`participant_erasures` has RLS never enabled anywhere in the chain** (created at supabase/migrations/00058_admin_roles_and_erasure.sql:74 with no ENABLE ROW LEVEL SECURITY; grep confirms no later migration adds it), while 00015_grant_role_privileges.sql sets ALTER DEFAULT PRIVILEGES granting SELECT to `anon` and full CRUD to `authenticated` on all future tables — so on chain-built DBs (dev/local) the erasure tombstone table is readable/writable to any authenticated client and readable to anon. Prod was hand-fixed at cutover; the fix is not in the repo. Low PII exposure (erased_by id + reason), but it is an RLS-off table plus a drift-by-design between prod and the chain.
2. **PII committed to the repo**: supabase/migrations/00090_backfill_civics_survey_responses.sql embeds 31 survey respondents' names, personal emails, and phone numbers as literal SQL values (consented for research use per the form's consent text, but now permanently in git history). Flagged for owner awareness; no values reproduced here beyond what the file itself shows.
3. **Stale prod-ref in a safety doc**: scripts/ops/CLAUDE.md:51 names `cethihabtddiujzayaxe` as "the production project ref" — that has been the **dev** ref since the 2026-05-16 project split; actual scripts carry the correct `PROD_PROJECT_REF = "cdbgkgkjnomjnpicaxqe"` [FACT: scripts/ops/send-bulk-invites.ts:34-38, scripts/ops/seed-test-cycle.mjs:33-34]. A new script following the doc verbatim would guard the wrong project.
4. `.env.local.example` and docs/environments.md contain project refs and env-var *names* only — no secret values found in tracked files I read.

---

## Gaps

- **Prod's actual applied-migration ledger and live schema**: cannot be read (no DB access by hard constraint). Whether 00078–00091 are applied to prod, and whether prod's `supabase_migrations` was re-seeded after the baseline rebuild, is unknown.
- **Whether the 00089 manual backfill (civics→cycle link) was executed** on dev or prod — data repair documented in the file header, execution unrecorded.
- **Promote-PR bodies** ("No migrations" claims on #296/#299/#301 etc.) were not independently read via the GitHub API in this lane (deferred to Lane B/E); prod-application inference leans on in-repo docs instead.
- **Author attribution inside the 00033–00069 wave**: all commits are authored "Claude"; per-PR human sponsorship could not be attributed file-by-file because much of the wave was direct work without PRs (issue #214's subject). Not pursued via GitHub API.
- **Whether `db push` was ever run against prod after cutover** (the environments.md CLI path) vs Studio paste — no evidence either way.
- The orientation file (00-ORIENTATION.md) referenced by the task never existed on disk; corrections that Phase 0 may have verified elsewhere could not be incorporated.

## Corrections to the task's premises

- LAST_ACTIVE_DATE resolves to **2026-06-18** (adm-2k's last commit d8d4741); the prescribed BASELINE formula yields a misleading commit (1d3615f, docs side-branch) — use **a164dff** (chain 00001–00030).
- "admin_roles 00058": no such table; 00058 ships role *functions* + `participant_erasures`.
- "user_roles, participant_roles 00054" — correct; but the roles model's center of gravity is the 00064–00066 unification, not 00054 alone.
- `supabase/CLAUDE.md` quote confirmed verbatim at line 31 (wording: "The roadmap is the plan; migrations/ is the truth. They drift.").
- The branch `fix/00030-tightened-idempotency-predicate` is already merged into dev (not a pending collision).
