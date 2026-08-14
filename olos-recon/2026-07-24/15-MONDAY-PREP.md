# 15 — Monday Meeting Prep: sprint scaffold + what Aaron does next

*Prepared 2026-08-10 for the Monday call. Inputs: Madhu's next-sprint candidates CSV (2026-08-02, 16 items), Madhu's two suggestions (stability review; split the P1 strategy work), and the full audit evidence (`01`–`14`, exec summary + P1 strategy PDFs). Purpose: turn "review everything" into a specific agenda Aaron can run.*

## 0. One reading of the quiet week

The 08-04 commit stop now has a probable explanation: the team paused to plan — Madhu's sprint-candidate collation is dated 08-02 and roles are shifting (Aaron out of Programming & Events, back toward the stack). Treat exec-summary Q1 as half-answered; confirm on the call. [INFER: med]

## 1. Cross-walk: Madhu's 16 candidates × audit evidence

The audit changes the effort/priority picture on about half the items. Bringing these corrections **is** Aaron's fastest credibility re-entry — it shows command of the current build without touching anyone's code.

| CSV # | Item (Madhu's priority) | Audit correction / connection |
|---|---|---|
| 9 | Slack connectivity (**P1**) | Not from zero: issue **#189** already scopes the concrete use cases (reminders, in-Slack Learning Log, membership verification); Part A (Slack app creation) needs the workspace owner; `pods.slack_channel_id` has existed since 00001 with nothing writing it; four stale `claude/slack-*` branches hold abandoned starts. The "needs a concrete use case" note in the CSV is already answered by #189 — the missing thing is a decision on which slice ships first. |
| 10 | GitHub connectivity (**P1**) | This is not a generic integration — it's **the Triangulator/Ortelius bridge**. PR #302 already ships hand-pasted `repo_url` links to per-team Triangulator working folders; survey `#r-<id>` anchors are cited by triangles extract cards (triangles#72). Scoping item 10 without deciding the sensemaking fork (#185 in-app port vs #302 bridge) will build the wrong thing. Must be planned with item 3 and with Brendan. |
| 3 | Public Project Pages + Git artifacts (High) | Depends on item 10; `projects.github_repo_url` written only via org chartering today. This is also the "show off our growing library of learning assets" goal in product form — and the first real slice of Ortelius provenance (currently zero migrations). Natural flagship for the *following* sprint, scoped this sprint. |
| 1 | Unified event audience view (**P1.5**) | Cheaper than "Medium" suggests: the July events rework (00092–00095) already syncs Luma guest lists into `event_rsvps` plus subscriptions/attendance state — this is mostly a read surface over data that now exists. |
| 2 | "My events" on dashboard (Medium) | Small read over `event_rsvps` + a card in the new task/feed system (`lib/tasks/assemble.ts`). Quick win. |
| 8 | Surface survey results (Low) | **Mostly shipped by #302**: participant-visible results with pending rows marked "awaiting review" + stable anchors. What's actually missing: the **approve/moderation UI** (17 submissions sat pending with no way to approve) and ratification of the pending-visible default. The CSV's "quick check with the team" = one agenda line. |
| 4 | Public problem statements, no login (Low) | The gallery shipped (#302) but auth-gated with per-lab scoping and a no-author convention. Making it public is a **policy decision first** (authorship anonymity, consent — adjacent to the unfiled blind-voting leak), then a small build. Don't estimate it as pure frontend. |
| 13 | Learning Log compliance timing (**P0.5**) | Lands directly on the just-reworked enrollment machine (#348 / 00099 `registered` status): who is log-gated between registration and pod formation is now a state-machine question. Same cluster as #213. |
| 15, 16 | Banning; dropping from a cycle (Low) | These are the **productization of Aaron's own machinery**: access_revocations + the owner console reset RPCs + the two unmerged one-off SQLs (remove-4-participants `24610cf`; close-underfilled-pods, feedback #14) that did this by hand against live data. "Low" effort is right *if* built on the existing RPC/audit pattern — and building them retires the one-off-SQL failure mode. |
| 11 | Automated Pod Squad emails (Medium) | Agreed mostly plumbing-free (Resend + templates + moderator context exist) — but sequence **after** the cron-auth fail-closed fix, and wire the never-used `email_log` table (00057) so automated sends are audited. |
| 6 | Demographic data decision (Medium) | Pure decision → ratification agenda. Must involve the consent layer (00055/00057) and the pending attorney review of the bundled-consent language. |
| 5 | Engagement dashboards / Kirkpatrick (High) | Genuinely new (closest surface is pod-scoped Poderator health). The data substrate exists (learning_logs, event_rsvps, pod activity, enrollment states). Scope after item 7's sprint structure lands; pairs with Iliana. |
| 7 | Iliana's sprint structure in OLOS (High) | The org-cycles/workstreams model (00060/00069) is the intended home; this is mapping, not greenfield. Needs Iliana's spreadsheet in hand. |
| 12, 14 | Pod page functionality; newsletters (–/High) | Under-specified; park for scoping. Pod activity feed (#300) just shipped — item 12 should start from what exists. |

## 2. Answering Madhu's two suggestions concretely

**(a) "Stable build — maybe another code and security review."** Don't commission a review from zero — the material exists and is going stale:
- **Merge PR #286 (VIBE_SCAN)** — 38 findings + 14 decision questions, already cited by merged fixes, unmerged since 07-17. Tier-1 was fixed (#291–#294); tiers 2–3 are the ready-made stability backlog.
- **The six named security fixes** from the P1 strategy doc §2: blind-voting authorship leak (comment 4941719186), cron auth fail-open (`Bearer undefined`, `CRON_SECRET` missing from `.env.local.example`), erasure FK gap (runbook:171-178), the two uncodified prod-only fixes (participant_erasures RLS; participants_insert), revocation cron scheduling (#213), ledger reconciliation (00099-as-00092; prod 00092–00100).
- **The enforcement flip** (branch protection + CI-must-finish + CODEOWNERS) — stability is more process than code right now; the re-land tax and the #313 near-miss are the evidence.
- *Then* a fresh scoped review (security lens on `lib/auth/`, cron surface, RLS posture) to verify the fixes — this can be run agent-assisted against the repo in an afternoon once the above lands.

**(b) "Split the P1s — you take one, I take the other."** Recommended split, by context held:
- **Madhu → Slack (item 9 / #189).** He shipped every Slack-adjacent piece so far (invite link, advisory rows #287–#298) and owns the operating loop the reminders plug into. Strategy questions for his one-pager: which #189 slice first (channel-per-pod vs reminders vs verification), bot vs webhook, who owns the Slack app, what the pod-formation trigger is.
- **Aaron → GitHub (items 10+3) — because it is inseparable from Triangulator/Ortelius.** This P1 cannot be scoped without Brendan's fork decision, and Aaron owns that conversation anyway (exec-summary Q4). Strategy questions for Aaron's one-pager: what does triangles#72 actually consume from OLOS (the one contract the audit couldn't read); repo-per-pod provisioning vs hand-pasted URLs; where provenance lives (first `asset_links` slice vs `github_repo_url` columns); what "public project page" exposes and under what consent.
- **Third pile, unclaimed in Madhu's framing:** the audit's own P1s (#213 revocation, #212 metro-blind) + CSV items 13/15/16 form one coherent **enrollment & enforcement track** on Aaron's old machinery — Aaron should claim this too; it's ratification-plus-small-builds, not a big program.

## 3. Proposed sprint scaffold (bring this as the strawman)

- **Track 0 — Stability & enforcement (pre-req, ~2–3 days total):** branch protection + CI gating + CODEOWNERS; file the four missing issues; merge #286; ledger reconciliation; cron-auth fail-closed. Owner: Aaron (none of it collides with Madhu's lanes).
- **Track 1 — Enrollment & enforcement (Aaron):** ratify O2 → resolve #125; #213 dry-run → live; item 13 (log gating vs `registered` state); items 15/16 as owner-console actions; underfilled-pods admin path (feedback #14).
- **Track 2 — Integrations strategy (split):** Madhu: Slack one-pager (item 9/#189). Aaron: GitHub/Triangulator one-pager (items 10+3, after the Brendan conversation). Both due before sprint planning; build starts next sprint.
- **Track 3 — Member-visible quick wins (Madhu's build lane, unchanged):** items 1, 2, 8-remainder (approve UI), 11 (post cron fix). All small-to-medium reads/UI on data that already exists.
- **Parked pending inputs:** 5 & 7 (Iliana's structure), 12, 14. **Decisions-only:** 4, 6 → ratification agenda.

## 4. Monday agenda proposal (60 min)

1. **(10 min) Confirm/correct** — the exec summary's §6 questions; circulate the PDFs *before* the call so this is a checklist, not a presentation.
2. **(20 min) Ratification block** — O2 index drop; #302 pending-visibility default; #213 cadence + labs semantics; item 6 demographics scope; item 4 public-statements policy. Output: a decisions log line each.
3. **(15 min) Adopt the sprint scaffold** — tracks above; confirm the P1 split (Madhu: Slack; Aaron: GitHub/Ortelius + enrollment track).
4. **(10 min) Access + facts only people hold** — Supabase/Vercel dashboards (prod 00092–00100, CRON_SECRET), Slack workspace ownership (for #189 Part A), Brendan's availability for the Triangulator scoping conversation, Iliana's spreadsheet.
5. **(5 min) Owners + dates** — each track gets one name and one deliverable for the following week.

## 5. Aaron's checklist between now and Monday

1. Send the two PDFs + this scaffold to the channel (async pre-read; ask for §6 corrections in-thread).
2. Book 30 minutes with Brendan before or right after the call: triangles#72 contract, fork criteria, what item 10 must support. (Everything in Aaron's P1 packet depends on this one conversation.)
3. File the four missing issues (drafts in P1-strategy §2 — 10 minutes each) so the Monday ratifications have issue numbers to land on.
4. Skim `14-RERUN-BRIEF` §4 (failure-mode catalog) — it is the evidence base if anyone asks "why enforcement first."
5. Do **not** prepare code changes in Madhu's active lanes (events/Luma, poderator UI, tasks) — the value Monday is decisions, corrections, and claimed ownership of the cold zones.

## Gaps

- Iliana's sprint spreadsheet (item 7) and the Slack-channel context around the CSV were not available to this audit; the scaffold slots them as inputs, not conclusions.
- triangles#72 remains unreadable from this session — Aaron's GitHub/Ortelius one-pager needs Brendan for that contract.
- CSV priorities (P0.5/P1/P1.5) are Madhu's; the corrections above adjust *effort/newness* based on repo evidence, not his priority intent.
