# Documentation topology — two repositories, one contract

| | |
|---|---|
| **Status** | Plan of record for the destination (the owner created `TheUpskillingLabs/Docs-repository` on 2026-09-25); the bridge is built and the first publish was pushed by hand the same day; the automated workflow is inert until the token exists (D12 remainder) |
| **Owner** | Owner (repository access) + docs owner (manifest and sweeps) |
| **Last verified** | 2026-09-25 against `main@226445a`; `TheUpskillingLabs/Docs-repository` @ `174479e` (initial commit, 2026-09-25); `docs-archive` @ `8b33677` (2026-06-18) |
| **Companion** | [`documentation-framework.md`](documentation-framework.md) (the contract this extends), [`../sessions/README.md`](../sessions/README.md), `docs/publish.manifest.json`, `.github/workflows/publish-artifacts.yml`, `scripts/publish-artifacts.mjs` |

**The ask.** Keep OLOS lean — the code and the documents engineers need day to day,
plus the plan that keeps everyone pointed at the same goals and dates — and put
everything else somewhere the whole team can read: audits, session reports, archived
plans, schema snapshots, meeting minutes. Create artifacts of what gets completed
without crowding the working tree.

**The destination.** `TheUpskillingLabs/Docs-repository` (private, created 2026-09-25:
"a storage container for offloading past sprints, context documents, and other
development management materials"). The first publish was pushed by hand from this
branch the same day, together with the hand-authored `program/` and `governance/`
spaces; the workflow takes over once the token exists.

**The precedent.** The team already tried this once. `TheUpskillingLabs/docs-archive`
(private, 2026-06-18) has a README describing exactly this archive and listing twelve
OLOS documents. **None of the twelve were ever pushed** — the repo holds one file. A
manual archive is an intention, not a process; that is why the move below is automatic,
one-way, and reviewable. `docs-archive` can be archived on GitHub once `Docs-repository`
holds its first sweep.

**One fact that changes the framing.** OLOS is a **public** repository. The split is
therefore not only about tidiness; it is a **privacy boundary**. Several documents in
OLOS today name real participants, private email addresses, and both Supabase project
refs (see §2.3). Internal and operational detail belongs in the private repo, and the
sweep that removes published files from OLOS is a privacy improvement, not just
housekeeping.

---

## 1. The principle: source and surface

| | **OLOS** (public, engineering) | **Knowledge repo** (private, whole team) |
|---|---|---|
| Role | the **source** — everything a code reviewer needs to judge a PR, and the plan that keeps the team aligned | the **surface** — browsable copies of the plan and decisions, plus the artifacts of completed work and the archive |
| Who edits | engineers and agents, by PR | the publish bot for `olos/**` (never people); the team, for `program/**` and `governance/**` |
| Direction | writes flow **out** | nothing flows back; a copy that needs changing is changed in OLOS |
| Audience | contributors; the public (it is a public repo) | teammates, executives, partners you grant access to |

Three questions decide where a document goes:

1. **Would a code reviewer need it to judge a PR?** → lives in OLOS (and may be mirrored).
2. **Would a teammate want to read it without opening the code?** → mirrored to the knowledge repo.
3. **Is it finished?** (a report, a superseded plan, a dated audit) → mirrored, then swept out of OLOS.

## 2. What lives where

### 2.1 By document class

| Class | OLOS | Knowledge repo | Manifest mode |
|---|---|---|---|
| Code-adjacent reference: `README`, `CONTRIBUTING`, `ARCHITECTURE`, `DESIGN_SYSTEM`, area `CLAUDE.md` | source | `ARCHITECTURE.md` under `olos/reference/`; the rest not published | mirror (ARCHITECTURE only) |
| `SCHEMA.md` | source (generated from migrations) | `olos/schema/SCHEMA.md` + a dated snapshot per release tag | mirror + snapshot |
| `CHANGELOG.md` | source | `olos/CHANGELOG.md` + one release note per tag | mirror + snapshot |
| Plan of record: `docs/roadmap/` | source — the alignment layer stays here | `olos/roadmap/` | mirror |
| Decisions: `docs/vault/` (PR #391) | source — a decision ships in the PR that made it | `olos/decisions/` | mirror |
| Explanation docs: sector model, labs, org cycles, sensemaking, Ortelius, the state-machine review | source (agents read them) | `olos/reference/` | mirror |
| Requirements in flight: `docs/requirements/` | source | `olos/requirements/` | mirror |
| Point-in-time audits: `docs/audit/` | source until superseded | `olos/audits/2026-07/` | mirror now; flip to `mirror+prune` when the next audit supersedes them |
| Living intake logs: feedback list, work-day retros | source (engineers and hosts append) | `olos/feedback/`, `program/work-days/` | mirror |
| Historical PRDs, design specs, mockups, superseded plans | until swept | `olos/archive/prds/`, `olos/archive/plans/` | mirror+prune |
| Session artifacts: `docs/archive/` | until swept | `olos/archive/` | mirror+prune |
| **Session reports: `docs/sessions/`** | inbox — current sprint only | `olos/sessions/` — the permanent trail | mirror+prune |
| Content corpus: `docs/marketing-site/` | until swept | `program/marketing-site-corpus/` | mirror+prune |
| Legal copy: `docs/legal/` | source (rendered by public pages) | not published | — |
| Curriculum, meeting minutes, governance | not in OLOS | `program/curriculum/`, `governance/meetings/` — hand-authored | — |

### 2.2 Never published

Secrets and env files; `supabase/migrations/` (the schema's source stays with the
code; `SCHEMA.md` is the readable form); `scripts/**` (operational SQL and scripts carry
project refs and data operations — their `.md` companions are summarized as vault
workflow notes instead); `lib/**`, `app/**`; `docs/legal/`. The manifest lists these
under `neverPublish` as a statement of intent; the publisher only ever reads paths in
`rules`.

### 2.3 Privacy is a placement rule

A grep of OLOS today finds real participant names in the May launch plan and the
PR #313 test logs, private email addresses in `lib/auth/CLAUDE.md` and
`docs/environments.md`, and both Supabase project refs in several docs. None of this is
a secret in the credential sense, but none of it belongs in a public repository either.
Rules going forward:

- Session reports and test logs name **roles and ids**, never people (the existing
  `scripts/ops/CLAUDE.md` "never log PII" rule, applied to prose).
- Documents that already carry names are `mirror+prune`: they move to the private repo
  and leave OLOS at the first sweep.
- The `docs-check` steward prompt gains one check: flag a changed Markdown file under
  `docs/` that contains an email address or a `participants.id` next to a name.
- `environments.md` keeps project refs only where an engineer needs them to run a
  command; the audit's `2026-08-21` fingerprint detail moves to a vault workflow note.

## 3. The knowledge repository — layout

**`TheUpskillingLabs/Docs-repository`** (private; every team member gets read, the docs
owner and owner get write; the publish bot gets write). Three top-level spaces with
different authorship rules, and a **README in every folder that says what is there and
why it matters** — generated for `olos/**` from the manifest's `folders` map, hand-written
for `program/**` and `governance/**`.

```
Docs-repository/
├── README.md                      ← the team's front page, hand-maintained (Appendix A)
├── olos/                          ← GENERATED by publish-artifacts; never edited by hand
│   ├── PUBLISHED.md               ← index: every file, its OLOS source, the sha and date it came from
│   ├── roadmap/                   ← mirror of docs/roadmap (the plan of record)
│   ├── decisions/                 ← mirror of docs/vault (ADRs, divergences, workflows)
│   ├── reference/                 ← mirror of the explanation docs
│   ├── requirements/
│   ├── audits/2026-07/
│   ├── feedback/
│   ├── sessions/                  ← every session report, forever, chronological by filename
│   ├── archive/                   ← swept session artifacts, prds/, plans/
│   ├── schema/SCHEMA.md
│   ├── schema/snapshots/SCHEMA-v2026.10.10.md
│   ├── releases/v2026.10.10.md    ← one changelog section per dev → main promotion
│   └── CHANGELOG.md
├── program/                       ← hand-authored by the program/success team
│   ├── curriculum/                ← onboarding modules: readiness ladder, welcome, Slack, GitHub, AI assistant, CONTEXT.md
│   ├── research/                  ← the research & design process: personas, interviews, stakeholders, six templates
│   ├── design/                    ← wireframes and the wireframe → ticket checklist
│   ├── work-days/                 ← mirror of work-day-improvements.md + hand-written run-of-shows
│   └── marketing-site-corpus/     ← swept from OLOS
└── governance/                    ← hand-authored by the owner / executive team
    ├── meetings/YYYY-MM-DD-<slug>.md   ← minutes; each decision links to its OLOS ADR
    └── decisions-log.md           ← hand index: meeting → issue → ADR
```

The repo is plain Markdown, so it opens as an Obsidian vault too — `olos/decisions/`
carries the same wikilinks as `docs/vault/`.

## 4. The mechanism

Three pieces, all in this branch:

**`docs/publish.manifest.json`** — the list of `{source, dest, mode}` rules and the
default destination repo. Three modes:

| Mode | On every merge to `dev` | On a release tag | At the monthly sweep |
|---|---|---|---|
| `mirror` | copy; keep in OLOS | — | — |
| `mirror+prune` | copy | — | if the knowledge repo holds the same content, the sweep PR deletes the OLOS copy |
| `snapshot` | — | copy to a `{tag}`-named file (the changelog rule copies only the newest dated section) | — |

**`scripts/publish-artifacts.mjs`** — the publisher. For each rule it copies files into
a checkout of the knowledge repo and, for Markdown: prepends a provenance comment
(`Published from …/blob/<sha>/<path> on <date>`); rewrites relative links so that a link
to another published file stays relative and a link to anything else becomes an
absolute, **sha-pinned** GitHub URL into OLOS; and writes `olos/PUBLISHED.md`. It never
commits. `--prune-plan` prints the `mirror+prune` files whose published body is
identical to the OLOS copy. `--dry-run --out <dir>` works locally:

```bash
node scripts/publish-artifacts.mjs --out /tmp/kr --tag v2026.10.10   # publish + snapshots
node scripts/publish-artifacts.mjs --out /tmp/kr --prune-plan        # what the sweep would remove
```

**`.github/workflows/publish-artifacts.yml`** — two jobs. `publish` runs on every push
to `dev` and every `v*` tag: checks out both repos, runs the publisher, commits to the
knowledge repo as `olos-publish[bot]` with the OLOS commit subject and a link back, and
pushes. `sweep` runs on the 1st of each month (and on manual dispatch): computes the
prune plan and opens a `chore/docs-sweep-<date>` pull request on OLOS that `git rm`s
those files, labeled `skip-changelog`, for a human to review and merge. Branch
discipline holds — nothing is deleted from OLOS without a PR.

**Guarantees.** One-way (nothing reads from the knowledge repo except for the prune
comparison). Idempotent (re-running publishes the same bytes; an unchanged tree makes no
commit). Provenance on every file. No secret leaves OLOS (the publisher reads only
manifest paths). Inert until the `KNOWLEDGE_REPO_TOKEN` secret exists.

**Known limits.** A PR opened with the workflow token does not trigger `docs-check`;
re-run it manually or open the sweep with a PAT. Branch protection on the knowledge
repo must let the bot push to `olos/**` (or protect only `governance/**`). The vault
(`docs/vault/`) rule is `optional` so the workflow is safe before PR #391 merges.

## 5. Session reports — the unit of "what was completed"

The convention lives in [`docs/sessions/README.md`](../sessions/README.md). The
lifecycle is the point:

```
work happens ──► report written in the same PR (docs/sessions/YYYY-MM-DD-slug.md)
   ──► reviewed with the code ──► merged to dev ──► published to olos/sessions/
   ──► swept out of OLOS at the next monthly sweep (the knowledge repo keeps it forever)
```

So OLOS holds only the current sprint's reports, the knowledge repo holds the
chronological trail, and a teammate who was not in the session can read what was asked,
done, verified, decided, and left open — with paths, PR and issue numbers that outlive
the branch. Two reports exist already (2026-09-15, 2026-09-25); `CLAUDE.md` now tells
every agent session to end with one.

## 6. The auditable trail of choices

Every consequential choice leaves a chain of links, and each link is something a person
can open:

```
a question surfaces ──► "Decision needed" issue in OLOS (owner, decide-by)
   ──► discussed: in the issue, or in an executive meeting whose minutes land in
       governance/meetings/ (knowledge repo)
   ──► recorded: docs/vault/decisions/ADR-NNNN-… (or divergence/…) in the PR that
       implements it, or a docs-only PR when nothing changes in code
   ──► mirrored to olos/decisions/ on merge; cited in the session report and, when
       it shipped something, in the CHANGELOG line
```

Executive meetings therefore produce two things: minutes in the knowledge repo, and
*Decision needed* issues in OLOS for anything that changes the build. The vault note is
the canonical record; the minutes are the context. `governance/decisions-log.md` is the
hand-kept index from meeting to issue to ADR, for people who start from the meeting.

## 7. Setup checklist (one afternoon, owner + docs owner)

1. ~~Confirm D12~~ — done: `Docs-repository` is the destination (owner, 2026-09-25). Archive `docs-archive` on GitHub after the first sweep.
2. **Access** — add every team member (read); docs owner and owner (write). Default
   branch `main`. If branch protection is on, allow the bot (or protect `governance/**`
   only).
3. **Token** — a fine-grained PAT (owner or a bot account) scoped to the knowledge repo,
   *Contents: read/write*, *Metadata: read*, 1-year expiry, stored in OLOS as the secret
   `KNOWLEDGE_REPO_TOKEN`. If the repo is renamed, set the OLOS repository variable
   `KNOWLEDGE_REPO`.
4. **Front page** — replace the June README with Appendix A (keeps its history section).
5. **First publish** — run `publish-artifacts` by `workflow_dispatch` from `dev`; check
   `olos/PUBLISHED.md` and a few rewritten links.
6. **First sweep** — dispatch with `sweep = true`; review the PR (expect ~45 files:
   `docs/archive/`, the marketing corpus, the historical PRDs); merge.
7. **First tag** — at the next `dev → main` promotion, tag `vYYYY.MM.DD`; confirm the
   release note and schema snapshot land.
8. **Governance folder** — create `governance/meetings/` with the executive meeting's
   minutes (D13) and `governance/decisions-log.md`.

## 8. What the team needs to provide

These are the inputs the plan cannot supply itself. Each is a decision or a fact; each
has a default so work does not stall.

| Area | Needed | Default if unanswered |
|---|---|---|
| **People** | The docs owner (framework §9); who administers the knowledge repo; who attends the executive meeting; CODEOWNERS line for `docs/**` | maintainer who runs the feedback lists; the owner; owner + maintainers + success lead |
| **Timelines** | Next cycle kickoff date and theme (D1) — every drip offset and the Showcase slice hang on it; any externally committed dates (partners, funders, library hosts); realistic weekly capacity (engineer-hours; Claude Code usage) | no Showcase slice; between-cycles experience by Nov 6; capacity assumed one engineer + agents |
| **Scope of "important and current"** | Ratify the §2.1 table — especially whether the north-star docs stay in OLOS, and whether the feedback logs are engineering or program documents | as in the table |
| **Governance cadence** | Executive meeting frequency; who ratifies ADRs (owner alone, or owner + one maintainer); a decide-by default for `proposed` notes; a minutes template | monthly; owner + one maintainer; 14 days; Appendix B |
| **Privacy posture** | Confirm OLOS stays public and the rules in §2.3; whether past reports with names are swept (recommended) or rewritten | swept |
| **Curriculum** | Who owns `program/curriculum/`; when the curriculum session runs; whether its output is reviewed by PR | success team; before Oct 9; yes |
| **Tooling** | An org-level GitHub Project spanning both repos; whether the team uses Obsidian on the knowledge repo | create the Project; optional |
| **Access model** | Whether `Docs-repository` should hold anything partners or funders see (then a `public/` folder with its own rules) | no |

## 9. The operating rhythm that ties documents to deadlines

| Cadence | What happens | Where it shows |
|---|---|---|
| Every PR | changelog line; decision note if a choice was made; session report if the work was substantive | `docs-check`; PR template |
| Weekly (30 min) | triage: steward issue, labels, milestones, stale PRs; update `next-sprint.md` §8 | the sprint doc; the board |
| Every `dev → main` promotion | tag `vYYYY.MM.DD`; changelog section closed; prod migrations listed; release note + schema snapshot published | `olos/releases/`, `olos/schema/snapshots/` |
| Monthly | sweep PR; retro line in the sprint doc | OLOS PR; `olos/sessions/` |
| Per sprint | re-baseline `next-sprint.md`; addendum to the current audit if reality moved | `docs/roadmap/` |
| Per cycle | journey review per role; new dated audit if the phase changed | `docs/roadmap/YYYY-MM-audit.md` |
| Executive meeting | minutes in `governance/meetings/`; *Decision needed* issues opened; ADRs follow by PR | the trail in §6 |

## 10. Non-goals and risks

- **Not a wiki, not two-way.** Editing a published file in the knowledge repo is lost at
  the next publish; the header says so on every file.
- **Not a place for exports.** CSV contact exports and anything from the database never
  enter either repo.
- **The token is a credential.** Rotate yearly; scope to one repo; prefer a bot account
  over a person's PAT once there is one.
- **The bot's PRs don't trigger CI.** Documented in the workflow; re-run `docs-check`
  before merging a sweep.
- **Drift between manifest and reality.** The steward's weekly check should include
  "does `olos/PUBLISHED.md` list every path the manifest names?" once the bridge is live.

---

## Appendix A — proposed front page for the knowledge repo

```markdown
# Docs-repository — The Upskilling Labs

A storage container for offloading past sprints, context documents, and other
development management materials. Private. Everyone on the team can read; the program and governance folders are yours to
write; `olos/` is generated from the OLOS repository and must not be edited here.

- **What is the plan?** `olos/roadmap/` — the current sprint, personas, and strategy.
- **Why is it like this?** `olos/decisions/` — decision records and spec divergences.
- **What shipped, when?** `olos/CHANGELOG.md` and `olos/releases/`.
- **What did a session do?** `olos/sessions/` — one report per unit of work.
- **What does the database look like?** `olos/schema/`.
- **What happened at the meeting?** `governance/meetings/`.
- **How do we onboard people?** `program/curriculum/`.

Every file under `olos/` starts with a comment naming the OLOS commit it came from; edit
it there via a pull request. `olos/PUBLISHED.md` is the index. The automated bridge is described in
`olos/roadmap/documentation-topology.md`; the June 2026 `docs-archive` repo was the
manual precursor.
```

## Appendix B — minutes template for `governance/meetings/`

```markdown
# <Meeting title> — YYYY-MM-DD

**Attendees:** · **Facilitator:** · **Minutes:**

## Context (two sentences)

## Decisions
| # | Decision | Owner | Recorded as | Deadline |
|---|---|---|---|---|
| 1 | … | @ | OLOS issue #N → ADR-NNNN (link when merged) | |

## Open questions carried forward

## Actions
- [ ] … (@owner, date)
```
