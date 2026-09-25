# Changelog

All notable changes to OLOS are recorded here, per [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Sections are keyed to **`dev → main` promotions** and named with [CalVer](https://calver.org/)
`YYYY.MM.DD` (the promotion date); `main` is tagged `vYYYY.MM.DD` at each promotion.
Groups: **Added · Changed · Fixed · Removed · Ops · Docs**. One line per PR, ending in `(#PR)`.

**How to use it** (the contract is [`docs/roadmap/documentation-framework.md`](docs/roadmap/documentation-framework.md) §6):

- Every PR that touches `app/`, `lib/`, `supabase/`, `proxy.ts`, or `vercel.json` adds one
  line under **Unreleased** (`docs-check` enforces it; opt out with the `skip-changelog` label
  and a reason).
- On promotion, the maintainer renames **Unreleased** to the dated section, lists the
  **migrations to apply to prod** under **Ops**, and tags `main`.

> **Provenance of the history below.** Sections from **2026-07-12** onward were generated
> from the merge log on 2026-09-15 (`git log --merges`; titles are the merged branch's last
> commit or the squash subject, so a few read as branch names or repeat across a promotion
> and its back-merge). Everything **before 2026-07-12** is reconstructed from the docs' PR and
> migration references — the repository's git history begins 2026-07-08. Corrections welcome
> in small PRs.

## [Unreleased]

### Ops

- Documentation contract: `docs-check` workflow (changelog line, `SCHEMA.md` with migrations,
  doc map, relative links, vault frontmatter, PR title), `docs-steward` weekly Claude workflow
  (inert until `ANTHROPIC_API_KEY` is set), `npm run check:docs`, PR template **Docs &
  decisions** section, *Decision needed* issue template, `persona/` labels proposed.
  (planning PR — number assigned on open)

### Ops

- Knowledge-repo bridge: `.github/workflows/publish-artifacts.yml` (publish on merge to
  `dev`, dated snapshots on release tags, monthly sweep PR), `scripts/publish-artifacts.mjs`,
  `docs/publish.manifest.json`; inert until `KNOWLEDGE_REPO_TOKEN` is set; destination `TheUpskillingLabs/Docs-repository`;
  the publisher writes a README in every generated folder (manifest `folders`). `docs-check`
  exempts `docs/sessions/` from the doc-map rule. (planning PR, 2026-09-25)

### Docs

- `docs/roadmap/documentation-topology.md` (two repositories, one contract);
  `docs/sessions/` convention + reports for the Sep 15 and Sep 25 sessions; sprint dates
  re-baselined; audit addendum (F15, `docs-archive`). (planning PR, 2026-09-25)
- `docs/roadmap/`: September 2026 audit, next-sprint plan (Sprint 0/1/2), pre-registration
  persona, personas & journeys, documentation framework, data strategy, curriculum-session
  brief. `docs/README.md` doc map; `docs/archive/` for session artifacts (10 files moved);
  historical banners on `OLOS-roadmap.md`, `audit/PROGRESS.md`, `personas.md`,
  `PRD-login-and-cycle-onboarding.md`; stale lines fixed in `ARCHITECTURE.md`,
  `environments.md` (ledger-drift warning), `lib/auth/CLAUDE.md`,
  `poderator-dashboard/CLAUDE.md`. This changelog seeded. (planning PR)


## [2026.09.10] — 2026-09-10

_Promoted to `main` via #387, #389._

### Added

- feat(owner): ban a person from the app, not just from a cycle (#385)

### Fixed

- fix(owner): surface the Danger zone in the People & Access drawer (#386)
- fix(admin): show a Projects count on the pods table (#388)

## [2026.08.30] — 2026-08-30

_Promoted to `main` via #376, #380, #382._

### Added

- feat(moderator): project rosters section with CSV + copy-for-Slack export (#375)
- feat(moderator): Learning Log AI-assisted summary (BYO-LLM bundle) (#379)
- feat(moderator): unified Insights page (log summary hero; pulse history data-driven) (#381)

## [2026.08.28] — 2026-08-28

_Promoted to `main` via #374._

### Added

- feat(cycle): self-serve pod join, withdraw-anytime, and poderator outreach (#373)

## [2026.08.26] — 2026-08-26

_Promoted to `main` via #370, #372._

### Added

- feat(projects): open all pitches to direct registration (skip solution voting) (#369)
- feat(projects): show the pitch on registration cards and the project page (#371)

## [2026.08.22] — 2026-08-22

_Promoted to `main` via #365, #367._

### Added

- feat(learning-logs): soft-nudge Learning Log compliance layer (#363)
- feat(projects): four-question project pitch submission (#364)
- feat(projects): pre-voting project gallery + poderator submissions/outreach (#366)

## [2026.08.03] — 2026-08-03

_Promoted to `main` via #352, workshops nav + all-pods cycle/range filters, #356, #360._

### Added

- feat(entity-explorer): pod-scoped poderator surface + CSV export (#350)
- Feat/workshops nav page (#353)
- Feat/all pods cycle range filter (#354)
- feat(poderator): always link Overview's workshops panel to the Workshops page (#355)

### Fixed

- fix(poderator): org runs get a quiet Overview badge (#351)
- fix(admin): remove the unscoped Moderator preset from the permissions page (#358)
- fix(poderators): move the assign picker into a Sheet so the row stays flat (#359)

## [2026.08.01] — 2026-08-01

_Promoted to `main` via #347, #349._

### Fixed

- fix: render Luma image markdown so sponsor logos show on event pages (#346)
- fix: PGRST201 cron no-op, fresh audit rows on re-revocation (00100), sweep confirm copy (#348)

## [2026.07.31] — 2026-07-31

_Promoted to `main` via #327, #332, #334, #341, #343, #345._

### Added

- Feat/luma driven event pages (#335)
- feat: view-as-member simulation (#312, rebased on dev) (#344)

### Changed

- cycleICS writes DTEND (#322)
- Admin editor for events' editorial layer; sync backfills empty ledes (#323)
- Members-only events: private Luma events reach /learning, not /events (#324)
- Promote dev to main: anchor facts, event editor, members-only events (#325)
- events.about: the full Luma About text, synced and rendered as prose (#326)
- Sync fetches full event details: the listing has no descriptions (#329)
- Sync observability: count detail fetches; accept description_md (#331)
- About markdown rendering + hackathon copy + detail page polish (#333)
- Consolidated member task system (#311, rebased) (#342)

### Fixed

- fix: four fixes from reading the real hackathon page (#338)
- fix: move Location to the end, beside Host and Bring (#339)
- fix: the rail's Where is a venue label, not the whole address (#340)

### Ops

- Merge main into dev: rejoin histories after squash promotions (#328)
- Merge main into dev: rejoin histories after squash promotions (#328) (#330)

## [2026.07.30] — 2026-07-30

_Promoted to `main` via #320._

### Changed

- Add pod lightning talks (#17), fix cull and last-call sequencing (#306)
- Add Learning Library resource CMS to admin (#308)
- Add Learning Library resource CMS to admin (#309)
- Add Learning Library resource CMS to admin (#310)
- Surface the full problem situation submission on pod cards (#314)
- Surface the full problem situation submission on pod cards (#315)
- Show the map link and full proposal on the pod page (#316)
- Show the map link and full proposal on the pod page (#317)
- Rework the events page around three featured anchor events (#318)
- Anchor facts follow the live Luma events (#319)

### Removed

- Remove field survey prompts from dashboard and cycle page (#307)

## [2026.07.25] — 2026-07-25

_Promoted to `main` via #305._

### Changed

- Close the propose→vote→pods arc gaps + scrub contact info from the participant surface (#302)
- Propose wizard: problem situations, in the Triangulator's own fields, map link first (#303)
- Lean submission: the map link plus the basics, one page (#304)

## [2026.07.22] — 2026-07-22

_Promoted to `main` via #296, #299, #301._

### Changed

- Weekly Learning Log v2: nine-item instrument for open-cycle logs (#265)
- Mobile-first dashboard: feed-first layout, strip chips, and feed pagination (#284)
- Add Slack invite link to registration email and dashboard (#287)
- Enforce 5-digit ZIP format client-side in the sign-up funnel (#289)
- Claude/slack join todo k3508k (#290)
- Add Slack invite link to registration email and dashboard (#287) (#291)
- Show Join-the-Slack row to new signups only; exclude it from checklist collapse (#295)
- Show Join-the-Slack row to new signups only; exclude it from checklist collapse (#295) (#297)
- Mark advisory checklist rows done on click (#298)
- Profile save fixes + pod activity feed (deterministic instrument) (#300)

### Fixed

- Fix/cycle tabs key warning (#292)
- Fix/vibe scan tier1 (#293)
- Fix silently-dropped project_min in cycle config save (vibe-scan C1) (#294)

### Ops

- Renumber civics backfill migration 00089 -> 00090 (#283)

## [2026.07.16] — 2026-07-16

_Promoted to `main` via #285._

### Changed

- Add cycle contact CSV download to admin panel (#281)
- Add global admin contact CSV exports (all people, authority roles) (#282)

## [2026.07.15] — 2026-07-15

_Promoted to `main` via #278._

### Changed

- Require baseline free-texts; make weekly what's-next messages global (#264)
- Replace the /team page with a board-only page at /board (#266)
- Add board headshots to the /board page (#267)
- Make dashboard profile card a single link; consolidate profile actions (#268)
- Surface the insights survey: share todo + cycle-overview explainer (#270)
- Require a cycle when creating a survey; one survey per cycle (00089) (#271)
- Let admins link existing surveys to a cycle from the settings panel (#272)
- Make org announcements expandable in the dashboard rail (#273)
- Log feedback #12: closing a cycle should deactivate its pods (#274)
- Collapse the field-survey card to a strip once the member contributes (#275)
- Reconcile the feedback running list against verified code state (#276)
- Log feedback #12: closing a cycle should deactivate its pods (#277)
- PR template: require manual-testing instructions for key flows (#280)

### Removed

- Remove stray root-level headshot uploads superseded by board-headshots/ (#269)

### Docs

- docs: feedback list — add #13 (view/edit problem statements) and contribution instructions (#279)

## [2026.07.13] — 2026-07-13

_Promoted to `main` via #251, #253, #255, #260._

### Added

- content(home): tweak durable-skills copy (#249)
- content(home): remove 'Flagship' tag from the DC lab card (#254)
- feat(cycle page): show theme/description copy below the header (#256)
- feat(cycles): Stage 1 calendar — re-land #247 onto dev (#259)
- content: cohort→cycle copy + learning-log check-in wording (#262)
- content(register): agreement check-in title names the learning log (#263)

### Changed

- style(home): separate spotlight pull-quote from the name/role block (#252)

### Fixed

- fix(labs): hide archived metros from getMetros/getMetro (#258)
- fix(migrations): renumber cycle_phases_events 00085 -> 00086 (00085 taken by service_role_admin_paths on main+dev) (#261)

### Docs

- docs(supabase): log the 00068->00085 renumber in the history table (#250)
- docs: never commit/push to dev or main directly (branch + PR by default) (#257)

## [2026.07.12] — 2026-07-12

_Promoted to `main` via Cycle 3 launch — July-11 fix train, June requirements re-baseline, corrected anchor-event dates, unlist Build Cycles / Library / Spotlights / Local Labs from public chrome, login doors: join explainer vs straight sign-in, account chooser, no-account notice, login doors: join explainer vs straight sign-in, account chooser, no-account notice._

### Fixed

- fix(profile+directory): metro label dedup, saved banner, back link, live follow count, availability prefill, handle de-suffix (#229)
- fix(login): skip the explainer popup — go straight to Google sign-in (#242)

### Removed

- Remove "What this cycle is working on" section from build-cycles page (#236)

### Docs

- docs(requirements): D-10 — cycle registration tracks the pod windows (#240)
- docs(feedback): #11 what to collect for out-of-city lab waitlist (#241)

---

## Before 2026-07-12 — reconstructed from documentation

_The git history was rewritten/squashed before 2026-07-08; the record below is assembled from
`docs/OLOS-roadmap.md` §6, `docs/audit/PROGRESS.md`, `lib/auth/CLAUDE.md`, `supabase/CLAUDE.md`,
the migration headers, and `docs/archive/launch-plan-2026-05-31.md`. PR numbers are as cited there._

### 2026-07-04 → 2026-07-11 — the July build-out (migrations `00037`–`00086`)

- **Added** sectors + cycle lifecycle (`00048`/`00049`), saved items (`00050`), spotlights /
  `/stories` (`00051`/`00052`), field-survey intake `/survey/[slug]` (`00053`, `00061` question
  builder), unified `participant_roles` + owner rooting (`00054`, `00058`, `00064`–`00066`),
  cycle agreements acceptance (`00055`), onboarding intake + `interested` state (`00056`),
  `email_log` + consent consolidation (`00057`), org cycles & workstreams (`00060`), Local Labs
  (`00062`), HQ sub-cohorts + local pods (`00067`/`00068`), Leadership Log cascade (`00069`),
  announcements (`00070`/`00071`), profile updates / likes / comments (`00072`/`00073`), follows
  (`00074`/`00075`), page-authored updates (`00076`), owner console: actions audit, lifecycle,
  reset RPCs, metro archive (`00078`–`00081`), cycle theme description (`00084`), Stage 1
  calendar `cycle_phases`/`cycle_events` (`00086`, re-landed as PR #259).
- **Added** the LinkedIn-style directory redesign (PR #205); lab-lead workspace Phase 0+
  (PRD ratified 2026-07-11); `/admin/org`; view-as-member simulation (`00098`, later).
- **Changed** availability option list to the registration buckets (`00082`); handle
  de-suffixing (`00083`); service-role admin paths (`00085`, renumbered from `00068`).
- **Fixed** the July-11 fix train (#224–#230): vote budgets/stacking/undo, checklist gating,
  ceremony dates and copy, funnel prefill, pulse-leak on the pod page; corrected anchor-event
  dates (#233).
- **Ops** Phase 0 hygiene + CI (PR #145: Vitest, `ci.yml`, RSVP rate limit, reconciler
  bypass fixes); schema hardening `00037`–`00039`; testers pathway `00042`; `pod_limit`
  (`00043`); directory columns (`00044`); milestone weeks (`00047`); dev/prod migration-ledger
  repairs (`scripts/ops/*-migration-repair-2026-07-06.sql`).
- **Docs** prototype→OLOS audit (`docs/audit/*`, 2026-07-04/05); `SECTOR_MODEL`, `LOCAL_LABS`,
  `ORG_CYCLES`, `SENSEMAKING_FLOW`, Ortelius docs; requirements re-baseline (2026-07-12);
  `ARCHITECTURE.md`; `CONTRIBUTING.md`.

### 2026-06 — reconciler and requirements

- **Added** `reconcileEnrollmentActivation` + RLS `WITH CHECK` retrofits (Phase A, PR #111);
  admin/moderator self-service UI, profile edit Mode A/B, stuck-inactive filter (Phase B,
  PR #116); revocation warnings + idempotency (`00030`, Phase C); Poderator dashboard
  (`00023`–`00027`: nudge dismissals, UI state, `ai_experience_level`, cycle-config
  thresholds); feedback widget (`00029`); funnel registration fields + cycle agreements
  (`00031`/`00032`); public content tables, seed, Luma sync, placeholder retirement
  (`00033`–`00036`).
- **Ops** migration `00015_pod_memberships_preference_rank` renumbered to `00028`
  (2026-06-02); Pod Squad memo received (2026-06-22).
- **Docs** six requirements drafts (PR #231, 2026-06-17): cycle timeline, pod registration,
  local labs, permissions redesign, per-lab configuration, implementation plan.

### 2026-05 — Wave 1 launch

- **Added** Google OAuth sign-in, role resolution, custom-token invitations via Resend HTTP
  (PR #60, 2026-05-07; ratified #63/#64 on 2026-05-08); sender domain alignment (#68);
  bulk-invite script (#70); `option_lists` seeds (`00012`, PR #58); legacy participant fields
  (`00011`); invitation notes + email tracking (`00013`/`00014`); grants (`00015`); short-form
  registration (`00016`); nominations (`00017`); rich solution proposals (`00018`);
  react-hook-form primitives + `/profile` (PR #104).
- **Fixed** the 2026-05-31 launch cascade: RLS shared-pod visibility (`00020`), reactivation,
  revocation cron disabled (PR #108 → prod via #109); consolidated remediation issue #110.
- **Docs** login/onboarding PRD (2026-05-19), Poderator dashboard PRD + design (2026-05-20/22),
  personas (2026-05-20), launch plan (2026-05-31), onboarding state-machine architecture review.

### 2026-04 — foundation

- **Added** initial schema and RLS (`00001`/`00002`), profile image, pulse check v1/v2
  (`00004`, `00010` PR #53), owner roles (`00005`), cycle phases (`00006`), proposal data
  (`00007`), developer role (`00008`), permissions model (`00009`).
- **Docs** `TUL_MVP_Spec.md` (the original spec), `OLOS-roadmap.md` (Waves 1–3, 2026-04-30),
  legacy spreadsheet column mapping (`scripts/migration/`).
