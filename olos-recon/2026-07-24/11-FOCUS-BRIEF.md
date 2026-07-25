# 11 — Focus Brief: where the team is, what's being built, and where the co-lead should point himself

*Synthesis of `09-PLATFORM-TRAJECTORY.md` and `10-AGENT-LANDSCAPE.md` on top of the seven audit lanes. Purpose: fill the returning co-lead's knowledge gaps and guide him to scope one area of focus that helps the team. Updated for events through 2026-07-25 (~14:30Z): PR #302 merged; prod survey backfill assumed done per the owner [UNVERIFIED in-repo — one confirmation question remains, not a workstream].*

---

## 1. What kind of platform is being built

Three nested identities, in the team's own words:

1. **Near-term: "the build-cycle operating system"** for The Upskilling Labs — it walks a member from field observations → problem statements → votes → pods → solution proposals → projects → weekly Learning Logs → showcase, replacing Google Forms and reconciliation spreadsheets [FACT: README.md:3-8]. This engine is BUILT and verified end-to-end (27/27 live e2e) [FACT: dev-report-cycle-process.md].
2. **Mid-term: "The Labs runs like open source."** Sectors are durable problem-domain communities (foundations), Cycles are time-boxed incubator cohorts, Local Labs are the place-based tenancy spine (one HQ open cycle, labs as sub-cohorts), and the org runs its own machinery on itself via org cycles/workstreams. Structure BUILT in July (00048–00069); graduation and commons governance still paper [FACT: SECTOR_MODEL.md; LOCAL_LABS.md; ORG_CYCLES.md].
3. **Long-term: Project Ortelius** — "the legitimate, participatory, consented, open civic counterpart to Foundry": a provenance-complete, consent-governed corpus of community sensemaking. Declared lead buyers: **a frontier AI lab + local/state civic leaders & philanthropists** (owner decision 2026-07-05) [FACT: ORTELIUS_NORTHSTAR.md:264,309].

**The intended outcome** is therefore layered: upskilled members shipping civic projects in teams → a compounding sector commons of projects + field research → ultimately a clean, consented sensemaking corpus with research and civic-legitimacy value. The product's recurring promise: problem statements **"grounded in data, not vibes"** [FACT: SENSEMAKING_FLOW.md:6-8].

**How much of the ambition is real:** the cycle engine, logs, social layer, labs/org structure, and field-survey slice are BUILT; the entire Ortelius graph spine (asset_links, embeddings, situations, extracts, swipe, canvas) has **zero migrations** — the atlas is one slice deep [FACT: 09 §4 pillar table].

## 2. Where the team actually is (the shift of the last 3 weeks)

Early July built structure; since ~07-14 the team is **operating a live cohort (Civics & Elections) and wiring the sensemaking loop into it**: survey↔cycle integration (00089/00090), participant-visible results with citable `#r-<id>` anchors, the proposal gallery, Learning Log v2 instrument, Slack onboarding, and vibe-scan defect burn-down [FACT: 09 §5]. This is alpha operations plus one strategic thread — not greenfield.

Current thrusts: **brendanwhitaker** drives the propose→vote→sensemake arc and the Triangulator bridge personally (authored and self-merged #302 today); **amguzzi** hardens the instruments and quality loop (survey linkage, Log v2, VIBE_SCAN triage, #286 open); **inferno-gh/MJ** is the defect burn-down and merge engine; **TheLabsHQ** does release ops and legal/content housekeeping [FACT: 09 §6].

**The one live architecture fork:** in-app Data Sensemaker port (the unmerged #185 brief: port the Triangulator canvas into OLOS, agent-team build order WS-A/B/C) **vs.** the just-merged lighter bridge (#302: sensemaking happens in per-team Triangulator GitHub repos, linked via `repo_url`, citing OLOS survey anchors). The current cohort is sensemaking *outside* OLOS; nothing ratifies the interim or sets switch criteria [FACT: 09 §3, §7.1].

## 3. Where the agents come from and what they're used for

Two opposite postures, deliberately:

- **Development is agent-saturated.** ~Half of all commits are authored "Claude" (386 all-time; 180 of the ~220 dev commits since 06-18), steered by two humans; 66 of 129 branches are `claude/*` session branches. Work arrives through four lanes: the Claude GitHub App (PR author = supervisor, not writer), Claude Code sessions → `claude/*` branch → PR (the sanctioned lane), **direct agent pushes to dev** (90 since 06-18, traceable only to session URLs — the lane that violates the repo's own rule), and the experimental **agent-teams** setup: five checked-in roles (`backend`, `frontend`, `migrations`, `docs`, read-only `reviewer`) with ownership zones, pre-approved permissions, and a migration-collision hook — built precisely because parallel agents kept colliding on migration numbers (five renumber incidents) [FACT: 10 §1–4]. There is even an agent-audits-agent pattern (PR #233 re-baselined another session's requirement docs against shipped reality) — the strongest quality mechanism in the repo, though evaluator and author were supervised by the same person [FACT: 10 §3].
- **The product is almost AI-free by governance rule.** "OLOS runs no in-app LLM" appears in three docs; Ortelius gate #11 blocks AI-assisted features until consent/governance land. The single exception: `lib/llm/names.ts` (one Haiku call naming pods/projects, graceful fallback). Everything else is copy-prompt / BYO-LLM by design — the moderator AI-summary block copies a prompt to the clipboard; the planned Sensemaker extraction has members run a deterministic prompt in their own model and upload the result, explicitly to sidestep gate #11 [FACT: 10 §5].

Operating rules for him: don't read `git blame` (read PR supervisor + session trailers); always work branch→PR yourself; treat "not exercised at runtime" agent disclaimers as real; don't add server-side model calls without confronting gate #11; and note `claude/experimental-agent-teams-qlovep` carries **possibly-unmerged security fixes** (RLS-bound admin writes silently no-op'ing; invitation revoke not revoking) — triage before assuming fixed [FACT: 10 §6; disposition UNVERIFIED].

## 4. The gap the co-lead uniquely fills

The team has an owner setting product direction at high tempo, a quality-instrument builder, and a defect-burn-down engine. What it does not have: **a second brain at decision altitude.** Every consequential call since 06-18 — prod reset, roles rebuild, pulse pivot, labs ratification, today's data-visibility default — was made by one person into a review vacuum (zero reviews on 245+ PRs; #302's objection window was 2.5 hours). The team knows it: they wrote CODEOWNERS with his name in it, they built after-the-fact audit machinery, and #302's body literally asks someone to shout. Meanwhile his old surface (enrollment/revocation machinery, migration/prod discipline, reference docs) is the only bus-factor-0 territory [FACT: lanes B/C/G; 08-DELTA].

## 5. Candidate focus areas (scored for team benefit × fit)

**A. Steward of the sensemaking/Ortelius arc** — own Decision-fork §2 above (in-app port vs bridge; set switch criteria), the consent question (bundled-consent reframe is owner-decided but *attorney review pending* while anonymous submissions accrue), buyer-sequencing → build priority, and the pod-formation contradiction (ratified cluster-vote Paradox Sprint vs shipped statement ballot) [FACT: 09 §7.1/.2/.3/.7]. *This is where the platform's stated outcome lives, and where decisions currently happen fastest with least scrutiny.* Fit: product-strategy altitude; no need to re-learn 74 new routes first. Benefit: unblocks brendanwhitaker's thread with a real counterpart instead of a vacuum.

**B. The review-and-ratification function** — become the shout: lightweight review policy (protect `dev`/`main`, review only auth/migrations/participant-data PRs, self-merge stays for copy/content), fix CODEOWNERS, run the retro-ratification loop (Decision-Debt §2 ADRs + §3 queue + #302's visibility default + the "resolved-by-build" owner-decision queue items), triage `experimental-agent-teams-qlovep` and VIBE_SCAN #286. Fit: exactly the co-lead-shaped hole; sustainable for a volunteer team because it gates a narrow surface. Benefit: converts the team's own half-built guardrails into working ones without slowing their tempo.

**C. Cycle-engine reliability + his old machinery** — re-adopt enrollment/revocation (#212/#213), pod-formation switch planning, migration/prod discipline (#77). Fit: lowest ramp (his code); Benefit: real but narrower — and per the owner, prod ops is explicitly *not* his lane right now.

**Recommendation: A as the focus area, with B's minimal version as the enabling first act.** The team's whole current thrust converges on the sensemaking loop; it is the piece with an external contract (the `triangles` repo), a pending legal question, an unratified architecture fork, and a declared buyer thesis — the highest concentration of decisions that need a second lead. Do B's smallest slice first (protection + CODEOWNERS + "shout surface" agreement, ~a day) so that A's decisions have somewhere to land other than a 2.5-hour self-merge window. Keep C as a bounded adoption of #212/#213 only — one afternoon, because it's his code and it's a p1 — and delegate the rest of C.

## 6. First-week choreography (superseding `04-REENTRY-PLAN.md` Day-1 where noted)

1. **Read**: this file → `09` → `10` → `03-DECISION-DEBT.md`. (~1 hour.)
2. **Retro-ratify #302** (supersedes "review #302" — it merged): confirm or revert the pending-observations default; ask brendanwhitaker for a 30-minute walkthrough of the Triangulator working-folder workflow and `triangles#72` (the one thing this audit could not read) [UNVERIFIED].
3. **One confirmation question, not a workstream**: "prod is fully applied through 00091 and the 00089/00090 backfills ran — correct?" Then drop prod ops.
4. **The B-slice**: propose the minimal review policy + branch protection + CODEOWNERS fix at the ratification session; bring Decision-Debt §3 as the agenda.
5. **Enter focus area A**: write the one-page memo only a co-lead can write — "the sensemaking fork: interim bridge vs in-app port, switch criteria, consent status, what the buyer thesis means for the next two cycles" — and put it in front of the team for decision. That memo is the first artifact of the focus area and forces every open §7 question in `09` onto the table.
6. **Bounded C**: adopt #212/#213, re-anchor #212's stale references, schedule the cron dry-run.

## 7. What remains unknown (carry into conversations)

The `triangles` repo's actual state and contract (triangles#72) [UNVERIFIED — outside session access]; whether `experimental-agent-teams-qlovep`'s security fixes were re-landed [UNVERIFIED]; who operates `TheLabsHQ` and who drove the 90 direct agent pushes; attorney-review status of the bundled consent; prod applied-through confirmation (item 3 above); and the private strategy context (AI Use Case Canvas docs, Slack decisions, funding/board material) that several repo docs cite but do not contain [FACT: 09 Gaps].
