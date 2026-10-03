<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Orientation — read this before you start (humans use README.md; this is the agent copy)

OLOS is The Upskilling Labs' build-cycle platform (Next.js 16 App Router, React 19,
Supabase). Work is planned in sprints and tracked as GitHub epics with sub-issues. Before
you write code or docs, read in this order; it takes about ten minutes:

1. `docs/roadmap/next-sprint.md` — the current sprint, its dates, the owner decisions, and
   the issue map (§10). Every piece of planned work has an issue number and a parent epic.
2. The issue you were given, and its parent epic. Each sub-issue carries context, scope,
   acceptance, dependencies, size, and the branch name to use.
3. `docs/roadmap/handoff-2026-09-28-onboarding-journeys.md` when your issue is one of its
   lanes (public pages, the between-cycles dashboard, the learning shelf, weekly messages,
   the Poderator weekly goal, Cycle v2): §1–§3 and §6–§8 are binding; §7 is your lane.
4. `docs/README.md` — the map of every document and whether to trust it (canonical, plan of
   record, proposal, historical). Do not take a historical document as the plan.
5. The `CLAUDE.md` next to the area you touch (`lib/auth/`, `supabase/`, `scripts/`,
   `docs/poderator-dashboard/`).

Rules that apply to every change:

- Branch off `origin/dev` with the name the issue gives; one issue, one branch, one PR into
  `dev`; never push to `dev` or `main`. See `CONTRIBUTING.md`.
- Definition of done is `docs/roadmap/documentation-framework.md` §5 (CI green, a
  `CHANGELOG.md` line for code, `SCHEMA.md` with a migration, a vault note when a choice was
  made, a wireframe before a new page or mode). `docs-check` enforces the mechanical half.
- Copy: "The Labs" (never "TUL"), "Upskiller", "Poderator"; never course/class/student/
  lesson/module in UI; no names of real participants in anything committed (the repo is public).
- Constitution: no in-app LLM, no activity telemetry, nothing that shames a member who is
  behind, consent-gated messaging. The brief's §4 and §8 spell these out.
- Cycle facts are data, read through one helper and written through an admin API: never hard-code
  a cycle's name, season, dates, length ("12 weeks", a literal 13) or audience. Test cycle-time
  math against a 91-day and a 56-day cycle. The next cycle (Cycle 4) is 8 weeks and internal:
  `docs/requirements/cycle-4-readiness.md`, epic #477.
- End every substantive session with a report in `docs/sessions/` (template in its README).
  It is the artifact of what was completed and travels to the team knowledge repo on merge.

This block is refreshed at every sprint boundary (the rule is in
`docs/roadmap/documentation-framework.md` §9); if the sprint file it names is stale, say so
in your session report rather than guessing.
