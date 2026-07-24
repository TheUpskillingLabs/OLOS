# 00 — ORIENTATION (Phase 0)

Run date: 2026-07-24 · Repo: `/home/user/OLOS` · Slug: `TheUpskillingLabs/OLOS` · Output: `/root/olos-recon/2026-07-24/`
Read-only audit. Working tree = `origin/main` tip `d260022` (contains all of `origin/dev`) [FACT: d260022].

## Fill-in resolution (the block arrived with placeholders)

| Field | Resolved value | Basis |
|---|---|---|
| `LAST_ACTIVE_DATE` | **2026-06-18** | [INFER: high — `adm-2k` (85 commits, active 2026-04-08→2026-06-18) is the only contributor who stopped committing; every other contributor shipped heavily through July. Matches "away co-lead" profile. **Confirm at checkpoint.**] |
| `MY_GITHUB_HANDLE` | `adm-2k` | [INFER: med — same reasoning; email `62628090+adm-2k@users.noreply.github.com`] |
| `TEAM_HANDLES` | `brendanwhitaker`, `amguzzi` (amg@dalmatianops.com), `inferno-gh` (= git "MJ"/"Madhu"/mjalan@gmail.com), `HQ` (hq@theupskillinglabs.org) + `Claude` bot/app commits | [FACT: git shortlog; PR #301 author `inferno-gh`, merged by MJ] |
| `PROD_BRANCH` / `DEV_BRANCH` | `main` / `dev` (default branch = main) | [FACT: `git remote show origin`] |

## Raw counts

- `main..dev` (unshipped on dev): **0 commits** [FACT: `git log origin/main..origin/dev`]
- `dev..main` (not back-merged): **3 commits — all dev→main merge commits** (PRs #296, #299, #301, all 2026-07-22) [FACT: d260022, 05ef52e, e23e62f]
- **⚠ Prompt assumption inverted:** "most of what he missed is sitting unshipped on dev" is FALSE. dev is fully promoted to main as of 2026-07-22. What he missed is already *in production*. The unshipped surface is ~130 remote feature branches, incl. `revert-230-fix/events-ui` and `merge/sync-main-into-dev`.
- Commits since 2026-06-18: **593 across all branches**, **314 on dev** [FACT: git log --since]
- Monthly volume (all branches): Apr 74 · May 95 · Jun 61 · **Jul 592** [FACT]
- Contributor totals since 2026-06-18 (dev): Claude 180 · amguzzi 89 · brendanwhitaker 27 · MJ 13 · HQ 5 [FACT: shortlog]
- Repo born 2026-04-10 (first commit Brendan Whitaker) — the whole codebase is ~3.5 months old [FACT]
- Open issues: **13** · Total PRs: **244** [FACT: GitHub search 2026-07-24]
- Migrations: **91** (`00001`…) in `supabase/migrations/` [FACT: ls]

## §3 domain-context corrections (stale — lanes MUST use these)

1. **No FastAPI. No Python. No `/api` top-level dir.** OLOS is a Next.js App Router monolith: API = route handlers under `app/api/**/route.ts`, server logic in `lib/`, plus `scripts/` (Node .mjs). "FastAPI-issued JWT" claim is dead; auth is Supabase (`@supabase/ssr`) [FACT: package.json, tree].
2. **Integrations (from package.json deps):** `@anthropic-ai/sdk`, `resend`, `@supabase/*` only. **No** `slack_sdk`, google-api-python-client, PyGithub, or Hugging Face SDK. Slack + Luma integrations exist in some form (branches `claude/slack-integration-setup-*`, `fix/slack-*`; migration `00035_luma_sync.sql`) — Lane E determines the mechanism (likely raw fetch/webhooks) and status of each.
3. **Paths:** `SCHEMA.md`, `TUL_MVP_Spec.md`, `DESIGN_SYSTEM.md` are at repo **root**, not `docs/`. Issue templates are `.github/ISSUE_TEMPLATE/bug_report.md` + `feature_or_task.md` (+ `config.yml`), NOT `docs/OLOS-issue-template.md` (never existed in history). Env example is `.env.local.example`. `.github/CODEOWNERS` exists. CI = single `.github/workflows/ci.yml`.
4. **Docs ghost:** open issue #213 references `docs/EVOLUTION.md` and `docs/archive/…` — neither exists on dev/main tips, but commits creating them exist in history (37a1f2f "docs: evolution narrative, archive, and consolidated living docs (part 1)" … 6b204f1 part 5) — an unmerged docs-consolidation effort is sitting on a branch [FACT: git log --all -- docs/EVOLUTION.md; ls-tree origin/dev].
5. Core domain objects grew beyond §3 list: migrations add `learning_logs`, `spotlights`, `org_cycles_and_workstreams`, `sector_model`, `luma_sync`, `feedback`, `testers`, `cycle_agreements`, `saved_items`, `single_active_cycle`, `email_log_and_consent`, `admin_roles_and_erasure`, etc. [FACT: migration filenames]. Lane D verifies invariants against actual DDL.
6. CLAUDE.md files: root, `lib/auth/`, `supabase/`, `docs/poderator-dashboard/`, `scripts/migration/`, `scripts/ops/` [FACT: glob].
7. Test runner: vitest (`npm test`); `scripts/check-migration-numbers.mjs` exists (migration-number collisions were a real problem — see branches `fix/00030-tightened-idempotency-predicate`, `claude/fix-cycle-info-migration-number`).

## Phase-1 addendum — corrections the lanes made to this document

- **The local clone is shallow** (9 boundaries in `.git/shallow`). All pre-July local ahead/behind counts were inflated artifacts; GitHub API confirms no force-pushes/history rewrites, and `schema-development` is merged, not 57-ahead [FACT: Lane A]. Repo truly born **2026-04-07** (`3e2da13`, amguzzi) — 2026-04-10 was a shallow boundary.
- "~130 remote branches, many unmerged" overstated: 124 topic branches, ~100 squash-landed residue/superseded; genuinely unshipped ≈ **11 branches + 7 open PRs** [FACT: Lane A].
- BASELINE formula `git rev-list -1 --before=2026-06-18 origin/dev` returns `1d3615f`, a docs side-branch commit; the true mainline snapshot at the cutoff is **`a164dff`** (dev==main tip 2026-06-04→06-18, migration chain at 00030) [FACT: Lane D].
- PR #301 (final dev→main promote) merged 2026-07-23T01:51Z, not 07-22 [FACT: Lane B].
- `/api/cron/pulse-check-reminder` no longer exists — deleted 2026-07-04 in the Learning-Log pivot (`306ded1`); `learning-log-reminder` replaced it [FACT: Lane G].
- `proxy.ts` is `middleware.ts` renamed for Next.js 16 (`e36d494`) — not unusual [FACT: Lane G].
- Issue templates only exist since 2026-07-08 (`a5942ea`) — template compliance could not have "stopped"; it barely started [FACT: Lane B].

## Directives to all lanes

- Baseline ref for "since he left": commits/date `--since=2026-06-18`; baseline snapshot = `git rev-list -1 --before=2026-06-18 origin/dev` (compute it; tag as BASELINE).
- Read files from working tree (= main tip) or `origin/dev` — they are equivalent today.
- GitHub via MCP tools (read-only: list_*/search_*/get_*/pull_request_read/issue_read/actions_*get/list). No `gh` CLI in this environment.
- Reflog is empty (fresh clone) — force-push archaeology limited to what GitHub API events show; else mark [UNVERIFIED].
- Everything read-only; write ONLY your lane file into `/root/olos-recon/2026-07-24/`.
