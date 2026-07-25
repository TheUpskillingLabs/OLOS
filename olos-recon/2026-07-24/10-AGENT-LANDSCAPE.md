# 10 — Agent Landscape: where the agents come from and what they're used for

Audit date: 2026-07-25 · Repo: TheUpskillingLabs/OLOS, local checkout on `claude/olos-reentry-audit-8bglhk` (working tree ≈ dev as of 2026-07-24). Two layers: **(A)** how the team builds OLOS with Claude, **(B)** what the shipped product uses AI for. They are deliberately opposite in posture: development is agent-saturated; the product is almost AI-free by explicit governance rule.

---

## 1. The operating model in one paragraph

OLOS is built by two humans (amguzzi, brendanwhitaker; plus adm-2k/Madhu/MJ earlier) steering Claude Code sessions; the agent is the primary author of code. Evidence: 386 unique commits authored "Claude" across all refs [FACT: `git log --all --author=Claude`], 190 on `dev` all-time (first one 2026-04-10, sha d941e49), 180 of them since 2026-06-18 — against 27 (Brendan) + 13 (MJ) + 5 (HQ) human-authored commits in the same window (amguzzi's 89 are mostly merge commits) [FACT: `git shortlog origin/dev --since=2026-06-18`]. 66 of 129 remote branches (51%) are `claude/*` session branches [FACT: `git branch -r`]. Work is *supposed* to land branch→PR→`dev` (CLAUDE.md branch discipline), and 59 "Merge pull request" commits since 6/18 show that lane working — but the prior audit found only 90 of the 180 Claude commits attributable to a human via PR authorship (amguzzi 60, brendanwhitaker 28); the other 90 were direct agent pushes traceable only to a `Claude-Session:` URL [FACT: prior-audit]. Every layer of the repo is instrumented for agents: a CLAUDE.md/AGENTS.md context network, five checked-in teammate role definitions under `.claude/agents/`, pre-approved permissions + a migration-collision hook in `.claude/settings.json`, and even design docs addressed "for the agent team". Agents also review and audit other agents' work (PR #233 re-baselining PR #231; the unmerged QA-audit branch).

Model split in `Co-Authored-By` trailers, all-time: Claude Opus 4.8 ×201, Claude Fable 5 ×119, Claude Sonnet 5 ×2 [FACT: git trailers]. Since 6/18 on dev: Opus 92, Fable 75; 167 of the 180 carry `Claude-Session:` URLs.

---

## 2. Inventory: defined agents / roles

`.claude/` contains `agents/` (5 files), `hooks/session-start.sh`, and `settings.json`. **No** `skills/` or `commands/` directories exist [FACT: `ls -la .claude/`]. All five roles are `model: sonnet` teammates for the experimental agent-teams feature; docs/agent-teams.md is their operating manual.

| Role | Purpose | Tools | Owns (per frontmatter + agent-teams.md map) | Evidence |
|---|---|---|---|---|
| `backend` | API routes + `lib/` server logic; must delegate SQL to `migrations` | Read, Edit, Write, Grep, Glob, Bash | `app/api/**`, `lib/**`; **single-owner zone**: enrollment/moderator/admin surface (`lib/enrollment/`, `lib/moderator/`, `app/api/admin/pods/`, `app/api/moderator/pods/`) — never parallelized | `.claude/agents/backend.md` |
| `frontend` | React components, dashboard/public/auth pages, design-system styling ("The Labs", never "TUL"; tokens, no hex) | same | `app/components/`, pages under `app/(dashboard)/(public)/(auth)`, `globals.css`; shared-file caution on `app/components/ui/form.tsx` | `.claude/agents/frontend.md` |
| `migrations` | SQL migrations + SCHEMA.md sync; **claim the migration number first**; runs `npm run check:migrations` | same | `supabase/migrations/`, `SCHEMA.md`; must read `supabase/CLAUDE.md` first | `.claude/agents/migrations.md` |
| `docs` | Markdown under `docs/` + top-level `*.md`; told to grep source rather than trust stale prose | same | `docs/**`, README/CONTRIBUTING/SCHEMA/DESIGN_SYSTEM | `.claude/agents/docs.md` |
| `reviewer` | Read-only review through ONE lens (correctness / security / performance / tests); reports `file:line` + severity, no edits | Read, Grep, Glob, Bash | nothing (read-only); OLOS-specific security checklist (RLS + service-role in `lib/supabase/`, `proxy.ts` allowlist, `lib/auth/`) | `.claude/agents/reviewer.md` |

Wiring around them (`.claude/settings.json`) [FACT: path]:
- **Pre-approved permissions**: lint/test/build/`check:migrations`/tsc/eslint/vitest + read-only git (`status/diff/log/show/branch`). Mutating git (commit/push) deliberately left prompting "so the lead controls it" (agent-teams.md).
- **`TaskCompleted` hook**: runs `node scripts/check-migration-numbers.mjs || exit 2` — a teammate cannot mark a task done if it introduced a duplicate migration number.
- **`SessionStart` hook**: `npm install` on Claude-Code-on-the-web sessions only (`CLAUDE_CODE_REMOTE=true`) so lint/test work in fresh containers.
- Agent teams itself is **off by default**; enabled per-owner via gitignored `.claude/settings.local.json` (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) [FACT: docs/agent-teams.md:8-20].

This tooling landed via a three-PR train on 2026-07-06 by Brendan Whitaker: #178 contributor onboarding, #180 migration-number guard + parallel-workflow docs, #181 "Set up the repo for Claude Code agent teams" [FACT: commit ee5a14c and neighbors, visible on many `claude/*` branches]. Oddity: ee5a14c is **not** an ancestor of current `dev` — the `.claude/agents/` files first appear in dev's history inside a0c0061 (2026-07-09), which is itself a *direct Claude push* bundling 24 files [FACT: `git merge-base --is-ancestor`; `git log origin/dev -- .claude/agents/backend.md`]. [INFER: medium — dev history was rewritten or the PR content re-landed via a squashed direct push.]

**Context network agents read** (the other half of "agent definitions"): root `CLAUDE.md` (branch discipline + subdoc index), `AGENTS.md` ("This is NOT the Next.js you know" — forces agents to read `node_modules/next/dist/docs/` instead of training data), `supabase/CLAUDE.md` (migration conventions, "translate Alembic→raw SQL", consolidation policy), `lib/auth/CLAUDE.md`, `docs/poderator-dashboard/CLAUDE.md`, `scripts/migration/CLAUDE.md` (referenced). These are agent-onboarding documents as much as human ones.

**docs/superpowers/** — a single spec, `specs/2026-05-22-poderator-dashboard-design.md` (the moderator-dashboard implementation design; "Phase: Single phase — no internal LLM"), committed 2026-06-01 by Madhu with `Co-Authored-By: Claude Opus 4.8` [FACT: git log on the path]. The directory name matches the spec-output convention of the "superpowers" Claude Code plugin (brainstorm→spec→plan workflow) [INFER: medium — no in-repo reference to the plugin; only one artifact ever produced, so the convention didn't take root].

---

## 3. The four lanes agent work arrives through

1. **Claude GitHub App (issues + PRs filed as humans).** Both brendanwhitaker and amguzzi file issues/PRs via the app — the PR shows a human `user`, but the body carries a `claude.ai/code/session_…` link and often the "🤖 Generated with Claude Code" footer (PR #233, PR #302) [FACT: PR API; prior-audit for the app attribution]. Practical effect: **PR authorship ≈ who supervised, not who wrote.**
2. **Claude Code sessions → `claude/*` branch → PR → merge to dev.** The sanctioned lane. 66 `claude/*` remote branches; 59 `Merge pull request` commits on dev since 6/18 [FACT: git]. Dev uses true merges (not squash), so Claude authorship survives onto dev and the merge commit carries the human.
3. **Direct agent pushes to dev.** 90 of the 180 Claude commits on dev since 6/18 have **no** PR trail — only `Claude-Session:` URLs [FACT: prior-audit]. Concrete example: a0c0061 (2026-07-09, "make the cycle process flow end-to-end", 24 files including `.claude/` itself). This directly violates the checked-in CLAUDE.md rule "Never commit or push to `dev` or `main` directly"; CONTRIBUTING.md's branch-protection section is written as *intended* rules ("should be protected"), i.e. not enforced [FACT: CONTRIBUTING.md:97-105].
4. **Agent teams (lead + teammates).** Experimental, opt-in, wired but lightly used. The clearest run artifact is `claude/experimental-agent-teams-qlovep` (unmerged): four commits on 2026-07-06, all from one session (`session_01VWcpBiwKmnRqR2Qwug6CU7`, Opus 4.8), fixing high/medium/low findings from a "static QA audit" — real bugs (admin writes silently no-op'ing on the RLS-bound client, missing idempotency on finalize, ILIKE `_`/`%` escaping in registration dedup, invitation revoke not actually reversing granted access) [FACT: branch commit messages]. **Whether these fixes were re-landed on dev another way is UNVERIFIED — as of this checkout the branch is not merged**, which is itself a finding (see §6). The Sensemaker brief also plans work explicitly "for the agent team" (WS-A/B/C workstreams) [FACT: `origin/claude/sensemaker-brief:docs/SENSEMAKER_INTEGRATION.md` §7].

**Agent-on-agent evaluation** (a fifth, meta-pattern): PR #233 (head `claude/pr-231-evaluation-8in8co`, opened by amguzzi via the app, merged 2026-07-12) had an agent audit the requirement docs another agent wrote in PR #231 (2026-06-17) against what prod actually shipped. Verdict recorded in `docs/requirements/pr231-evaluation.md`: multi-tenancy had shipped **inverted** relative to the June docs; the auth redesign was ~70% shipped under different names; two June claims were "already false at merge time"; and the shipped `lib/cycles/anchor-events.ts` carried stale prototype dates that would have sent members to the Problem Sprint on the wrong day — corrected in the same PR [FACT: docs/requirements/pr231-evaluation.md; PR #233 body]. Merged by amguzzi — its own author [FACT: PR API].

Also merged-and-done: `claude/lab-lead-phase0` (Claude-authored lab-lead feature, 2026-07-11) is fully contained in dev [FACT: `git log origin/dev..` empty].

---

## 4. Conventions & guardrails — and where they broke

| Convention | Mechanism | Where it broke |
|---|---|---|
| Branch discipline: never push dev/main directly | CLAUDE.md instruction only | 90 direct agent pushes to dev since 6/18 [FACT: prior-audit]; branch protection documented as *intended*, not applied |
| `claude/<topic>-<6char>` branch naming | Claude Code session default | Works as provenance; but 60+ stale branches accumulate with no cleanup convention |
| `Co-Authored-By` + `Claude-Session:` trailers | Claude Code commit template | 167/180 recent dev commits carry session URLs — but a session URL is not an accountable human; 13 lack even that |
| Migration-number claiming | CONTRIBUTING.md "claim it on the issue"; `scripts/check-migration-numbers.mjs` in CI **and** as the `TaskCompleted` hook | Repeated collisions forced renumbers: 00015→00028 (Jun 2), 00078→00082 (Jul 12), 00068→00085 and 00085→00086 (Jul 13), 00089→00090 (Jul 16) [FACT: dev log]. The guard exists *because* parallel agents kept grabbing the same number; it catches, it doesn't prevent |
| PR template Verify/Manual-testing sections | `.github/pull_request_template.md` (lint/test/build checkboxes, step-by-step manual tests, Database checkbox); manual-testing section added 2026-07 (dfbee7b) | Agents fill it honestly but partially — PR #233: "`npm run build` — please confirm in CI (not run in this workspace)"; agent-teams-branch commits: "not yet exercised at runtime (live-drive blocked by env network policy)" [FACT: PR/commit bodies]. Static verification is the norm; runtime verification often deferred to CI or nobody |
| Ownership map / single-owner zones | docs/agent-teams.md table + agent frontmatter | Designed *from* pain: the enrollment/moderator/admin zone is single-owner because six issues collide there; `form.tsx` flagged shared |
| Agent-evaluates-agent | PR #233 pattern | Works well as a drift auditor — but review and merge were the same human, so it's a 1-human + 2-agent loop |

---

## 5. In-product AI inventory (layer B)

The product's posture is a rule, stated in three places: **"OLOS runs no in-app LLM"** (SENSEMAKING_FLOW.md §4), "OLOS does not run any LLM internally" (PRD-moderator-dashboard.md:268), and the Ortelius **governance gate #11** — nothing AI-trained/AI-assisted ships until consent + governance are in place (ORTELIUS_NORTHSTAR.md) [FACT: those files]. Against that rule, one small exception ships.

**Shipped and live (the one real LLM call):**
- `lib/llm/names.ts` — `generateName("pod"|"project", description)` calls `claude-haiku-4-5-20251001` via `@anthropic-ai/sdk` (^0.98.0, package.json:17) to produce ≤40-char pod/project names; `nameFallback()` truncates on failure (lazy client so a missing `ANTHROPIC_API_KEY` degrades instead of 500ing). Callers: `app/api/voting/finalize/[cycle_id]/route.ts:147` (pod creation at vote finalize) and `lib/projects/finalize.ts:138` (project creation). This is the **only** Anthropic-SDK usage in `app/`+`lib/` [FACT: grep].

**Shipped, but copy-out (BYO-LLM, no API call):**
- `cycle_config.ai_summary_prompt` (migration `00026`, seeded with a poderator pulse-summary prompt) **is read**: `app/(dashboard)/moderator/page.tsx:131` selects it and both moderator pages feed it to `AISummaryBlock` (`app/(dashboard)/moderator/ai-summary-block.tsx`), which bundles the prompt + pulse comments (initials only) into a **copy-to-clipboard** block the poderator pastes into "ChatGPT, Claude, or your AI tool of choice" [FACT: files]. So: wired and used, but OLOS never sends it to a model.
- The planned Sensemaker "extraction" step is the same pattern scaled up: app builds a deterministic prompt over survey responses; the member runs it in *their own* LLM and uploads the result — explicitly designed to "sidestep the governance gate (#11)" [FACT: SENSEMAKING_FLOW.md §4].

**Planned, not built:**
- Theme/sentiment/summary pipelines: explicitly descoped ("No `pulse_themes` table. No LLM theme-extraction pipeline… No server-side LLM calls of any kind", docs/poderator-dashboard/CLAUDE.md:192; superpowers spec). **Hugging Face appears nowhere as an integration** — its only occurrences are as a survey *answer option* in the `ai_tools` option list (`supabase/seed.sql:62`, `supabase/migrations/00010_pulse_check_v2.sql:130`) [FACT: grep].
- Ortelius AI-assist read surfaces, community-aligned metrics, agentic frame proposal — all `[N-gated]`/gate-#11 paper designs (ORTELIUS_NORTHSTAR.md).

**In flight (the Triangulator/Sensemaker arc):**
- `claude/triangulator-sensemaker` — working branch for the public field-survey intake `/survey/[slug]`; landed on dev via PRs #183/#184 + migration `00053` [FACT: branch log + brief].
- `claude/sensemaker-brief` — **unmerged**; adds `docs/SENSEMAKER_INTEGRATION.md` (291 lines, commit f7c9c1d, 2026-07-06, session-linked): the plan to port `github.com/TheUpskillingLabs/triangles` (the "Triangulator", a single-file Frame-Creation canvas sharing OLOS's typeface and exact teal) into OLOS as the **Data Sensemaker** (roadmap Phase 6), gate-free floor, with §7 "Build order & workstreams (for the agent team)" [FACT: `git show origin/claude/sensemaker-brief:docs/SENSEMAKER_INTEGRATION.md`].
- **PR #302** (merged **today**, 2026-07-25 14:29Z, by brendanwhitaker; head `claude/triangulator-workflow-gaps-yv0dzb`): proposal gallery; submitters link their "Triangulator working folders (GitHub repos)" via a new `repo_url` field; survey results page gives every observation a stable `#r-<id>` anchor "that the Triangulator's pre-loaded extract cards cite (see TheUpskillingLabs/triangles#72)" [FACT: PR #302 body]. The triangles repo is outside this session's access — **the extract-card side is UNVERIFIED**; only the OLOS-side anchors/links are evidenced. Note this merged after the local checkout was taken, so `#r-` isn't in the working tree.

---

## 6. What the co-lead must know to operate here

1. **Attribution: don't read `git blame`.** "Claude" authored ~half of everything; the accountable human is (a) the PR opener/merger when there is one, (b) otherwise only a `Claude-Session:` URL — which you cannot open unless you own the session. For the 90 direct pushes, assume amguzzi-or-brendan and ask. When you write: keep the trailers, always go through a PR, and treat the session URL as your audit trail.
2. **Spawning work, the house way:** feature work = Claude Code session on a `claude/*` branch off `dev`, PR into `dev` with the template's Verify + Manual-testing sections honestly filled. Agent teams: opt in via `settings.local.json`, use the roles by name ("using the `backend` agent type"), give teammates task detail in the spawn prompt (they don't see your conversation), respect the single-owner zone, and have `migrations` claim its number *on the issue* first. Best starter use per the docs: parallel `reviewer` lenses on a PR.
3. **What not to trust:** (a) unattributed dev commits — verify them against runtime, since "not exercised at runtime" is a recurring agent disclaimer; (b) older design docs — they drift fast enough that the team built an agent (PR #233) to audit them, and supabase/CLAUDE.md's first rule is "the roadmap is the plan; migrations/ is the truth"; (c) branch protection — it isn't on, so nothing structurally stops the next direct push; (d) the `claude/*` fleet — most branches are dead, but at least one (`experimental-agent-teams-qlovep`) carries real, security-relevant bug fixes (RLS no-op admin writes, revoke-not-revoking) that appear unmerged. **Triage that branch first.**
4. **Product AI is a governance question, not a tech one.** Before adding any server-side model call beyond `lib/llm/names.ts`, you're crossing gate #11 (consent lattice, attorney review pending per SENSEMAKING_FLOW.md §3). The house pattern for "AI features" is copy-prompt/BYO-LLM — extend that, don't casually add API calls.
5. **Adopt the review pattern.** PR #233 (agent audits agent output against shipped reality) is the strongest quality mechanism observed — but make the evaluator's supervisor different from the author's supervisor; today both roles were the same person.

---

## Gaps

- **TheUpskillingLabs/triangles repo inaccessible** — PR #302's extract-cards-citing-`#r-` claim and triangles#72 are UNVERIFIED beyond the OLOS PR body.
- **GitHub App attribution** ("performed_via_github_app", 60/28 PR-authorship split) taken from the prior audit; not independently re-derived here.
- **Direct-push mechanics unknown**: whether the 90 direct pushes came from Claude Code web sessions with push credentials or a local CLI is not determinable from git alone; the a0c0061 example suggests sessions can push dev directly.
- **`experimental-agent-teams-qlovep` disposition**: whether its audit fixes were re-landed on dev via other PRs is unverified (a fix-train #224–#230 existed in the same window); needs a diff-level check before assuming the bugs are fixed or unfixed.
- **dev history rewrite**: PR #181's commit not being an ancestor of dev (while its content is) is unexplained; if dev was force-pushed at some point, other provenance may be similarly obscured.
- **Whether agent-teams runs happen regularly** is unknowable from the repo — only one branch and the docs evidence the feature; actual usage lives in owners' local sessions.
- Prior-audit figure "381 all-time Claude commits" now measures 386 (refs advanced); "90/90" split not re-derivable without per-PR API sweep.
