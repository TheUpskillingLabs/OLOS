# Lane 12 — GitHub stream re-read, window 2026-07-25 → 2026-08-09 (run 2026-08-09)

Read-only pass over TheUpskillingLabs/OLOS PRs #302–#360, issues, reviews, check runs; git
cross-checks against origin/dev / origin/main only (working tree untouched). All timestamps UTC.

Bottom line: **58 new PRs, zero reviews, 100% self-merge, one new issue (filed 23 seconds
before its own fix PR), and the spec/decision layer has fully migrated out of the issue
tracker into PR bodies.** Activity stops 2026-08-04 02:21Z (#360 merge). dev is fully merged
into main (merge-base = origin/dev tip 6b7af16; main = a9f437f, the #360 merge commit)
[FACT: git merge-base].

---

## 1. PR stream map (#302–#360)

Authors are the `user` field = the human supervising the Claude session. #313 body and #316
footer carry claude.ai/code session links [FACT: #313, #316]; commit author on inferno-gh's
rebased ports is git identity `HQ <hq@theupskillinglabs.org>` [FACT: #348 commits].

### Wave 0 — Sensemaking-sprint day patches (07-25, brendanwhitaker) — #302–#305
- #302/#303/#304: **one branch (`claude/triangulator-workflow-gaps-yv0dzb`) merged three
  times in one day** (14:29, 19:31, 20:06) — proposal gallery, then propose wizard, then lean
  problem-situation form [FACT: #302–#304 head refs + merged_at].
- #305 promote dev→main (22:42).

### Wave 1 — amguzzi's last stretch (07-26 → 07-28) — #306–#317
- #306 `docs/work-day-improvements.md` — a "living feedback / proto-requirements doc",
  explicitly the events counterpart to `docs/feedback-running-list.md`; its body records six
  decision-needing findings against existing code (see §4) [FACT: #306 body].
- **#307, #308, #314 were based on and merged straight to `main`**, bypassing dev
  [FACT: base.ref=main on all three], then recovered into dev by backmerges #310 and #315 —
  a standing violation of the repo's own branch discipline (CLAUDE.md: everything via dev).
- #309 promote; #316 pod-page proposal details (+#317 cherry-pick of it to main).
- #311 (task consolidation), #312 (view-as simulation), #313 (registered status + revocation
  cron, migration "00092") opened 07-27/28 and left open while dev moved on — all three
  later **closed unmerged** (see wave 3).

### Wave 2 — Events/Luma blitz (07-30 → 08-01, inferno-gh, ~24 PRs) — #318–#341, #346–#347
- #318 (the anchor of the wave, 19.5h open — the longest-lived PR of the window): events page
  reworked around three featured anchor events; migration 00092_events_taxonomy_and_anchor_dates;
  fixes 4 of 6 anchor rows still carrying prototype dates ("public site showed … the hackathon
  26 days late"); hackathon re-slugged to `civics-elections-hackathon`; Luma sync taught anchor
  exemption + luma_url adoption. Body asks "**Please sanity-check this table before merge — it
  is the cycle calendar the public site will show**" — no review ever happened [FACT: #318 body;
  get_reviews on sampled PRs all empty].
- Anchor-facts fix chain within 40 min: #319 (`fix-anchor-luma-facts`, 01:30) → #321 (**same
  branch merged again**, 01:52:19) → #322 (`anchor-facts-v3`, 01:52:17 — two seconds apart)
  [FACT: merged_at].
- #323 event editor, #324 members-only events (00093: events.visibility, RLS tightened,
  "apply to prod before promotion") [FACT: #324 body], #326 events.about.
- **History repair**: #325 promote was squash-merged (main first-parent shows
  `344e284 Promote dev to main: … (#325)` — a squash, unlike the "Merge pull request" promotes
  around it) [FACT: git log origin/main --first-parent]. #328 ("Merge main into dev: rejoin
  histories after squash promotions" — "squash promotions leave dev and main with disjoint
  histories, so every promotion PR re-conflicts on content both sides already agree on…
  tree byte-identical to dev, zero content change") was **itself accidentally squash-merged**,
  destroying the history join it existed for; #330 redid it 2 minutes later titled
  "(merge-commit required)" [FACT: #328/#330 bodies]. **They then switched promote style
  permanently**: every promotion from #327 onward is a true merge commit ("Merge pull request
  #N from …/dev"), incl. #332/#334/#341/#343/#345/#347/#349/#352/#356/#360 [FACT: git log].
- #329 sync fetches full event details; #331 sync observability; #333 about-markdown +
  hackathon copy.
- **The #335/#336/#337 commit-loss incident**: #335 (`feat/luma-driven-event-pages`) was
  squash-merged 44 seconds after opening while the branch was still growing; #337's body:
  "**The squash of #335 landed only the first two commits of the old branch. The nested-link
  fix — the Volunteer Orientation bug you reported — never reached dev**", so #336 (same
  branch, remainder incl. migration 00095) went `mergeable_state: dirty` and was closed
  unmerged with the one-word comment "Old"; #337 cherry-picked the two lost commits and
  retired the bespoke hackathon route [FACT: #335 merged_at−created_at; #336 state+comment;
  #337 body]. #337 also instructs: promotion must be "**merge commit, not squash** … the
  reason #335 lost two commits is worth remembering here."
- #338/#339/#340: **`fix/luma-copy-polish` merged three times in 17 minutes** (22:33, 22:46,
  22:50) [FACT: merged_at]. #346 Luma image markdown fix next morning (08-01 04:26).
- Promotes #320, #325, #327, #332, #334 — **five promotions to main before 05:30 on 07-31**,
  six counting #341 that evening [FACT: merged_at].

### Wave 3 — Rebased re-lands of amguzzi's trio (07-31 → 08-02, inferno-gh) — #342–#349
Why re-lands: the originals sat 4–6 days while ~20–56 commits landed on dev; merging their
history "would have dragged that stale tree back in", and all three had claimed migration
number 00092, which dev spent on the events taxonomy [FACT: #342/#344/#348 bodies].
- #342 = #311 ported: central task system (lib/tasks, task_dismissals, custom_tasks);
  migrations renumbered 00092/00093 → **00096/00097**; the port deliberately re-applies dev's
  removal of the survey nudges #311 had rebuilt (product removal recorded only here).
  #311 closed unmerged 23:53 [FACT: #342 body; #311 closed_at, merged=false].
- #344 = #312 ported: view-as-member simulation, signed 1-hour cookie, simulation_sessions
  audit table as **00098** ("already exists on the dev database, applied under the old name —
  the rename is bookkeeping for prod's benefit"); re-audited all of app/(dashboard); guards
  deliberately kept on the real user to avoid privilege escalation [FACT: #344 body].
- #348 = #313 ported: 'registered' enrollment status as **00099** + **carried
  00100_access_revocations_fresh_rows** (git: file enters dev via f8f1e90, the #348 merge)
  [FACT: git log origin/dev -- supabase/migrations/00100…]. Commit 2 is titled "the defect
  that kept #313 unmerged": the missed-log counter had no floor, so "pointing the admin sweep
  at the live civics cohort today would have warned and then revoked a large number of people
  who had done nothing wrong" [FACT: #348 commit 3571694]. Commit 4: PGRST201 embed ambiguity
  made the revocation cron "a silent no-op"; 00100 drops 00030's unique index so
  re-revocations write fresh audit rows (decision O2); sweep confirm copy (O3)
  [FACT: #348 commit 1ae38f1]. #348's body still lists "Ship decisions to settle: O2, O3, O4".
  #313 closed unmerged with "Superseded by #348" [FACT: #313 comment].
- #349 promote: "Prod DB prepared ahead of merge: snapshot archive_pre00099; 00099 applied
  (40 inactive→registered…); 00100 applied … **cron is deliberately not scheduled in
  vercel.json**" — settling O4 inside a promote-PR body while issue #213 ("Schedule the
  two-stage revocation cron") stays open and un-updated [FACT: #349 body; #213 open].

### Wave 4 — Poderator wave (08-02 → 08-04, inferno-gh) — #350–#360
- #350 pod-scoped Entity Explorer + CSV export (no migrations; service-role reads gated only
  by app guards — "the gates are the only protection") [FACT: #350 body].
- #351 poderator sub-page redesign — "per the approved design (mockups + design doc reviewed
  with HQ 2026-08-02/03)": design approval happened entirely off-GitHub [FACT: #351 body].
- #352 promote; #353 workshops nav (open→merge **41s**); #354 all-pods cycle-range filter
  (open→merge **8 seconds**) [FACT: created_at/merged_at].
- **5247a3e: direct no-PR merge to main**, author `HQ`, 08-03 05:35Z, "merge: dev → main
  (workshops nav + all-pods cycle/range filters)" — promoting #353/#354 without any PR
  [FACT: git show 5247a3e]. #356 then promotes on top of it via PR the same evening.
- #355 pod-nav cycle filter; #357 (issue) + #358 remove unscoped Moderator preset;
  #359 poderator assignment flexibility; #360 final promote titled just "Dev" (08-04 02:21).
  Silence since [FACT: no PR/issue activity after 08-04].

---

## 2. Fast-cycle failure modes (with cost)

1. **Squash-promote history divergence, paid twice.** #325's squash promotion split dev/main
   histories; the repair PR #328 was then itself squash-merged — the failure mode consumed
   its own fix — needing #330 minutes later [FACT: #328/#330 bodies]. This was already the
   *second* occurrence (#315 "Same fix as PR 315", plus branch `merge/sync-main-into-dev`
   #297 in the prior window). Cost: 3+ zero-content repair PRs, every interim promotion
   re-conflicting "on content both sides already agree on", and a repo where merge provenance
   needed archaeology. Producing pattern: GitHub's default squash button + no branch
   protection + solo operator at 4am. Resolved structurally after 07-31: all later promotions
   are merge commits [FACT: git log origin/main --first-parent].

2. **Merge-then-keep-committing (same-branch serial PRs).** Three instances:
   `claude/triangulator-workflow-gaps-yv0dzb` merged 3× on 07-25 (#302/#303/#304);
   `fix-anchor-luma-facts` merged 2× in 22 min (#319/#321) plus its `anchor-facts-v3` twin
   #322 merging 2 seconds before it; `fix/luma-copy-polish` merged 3× in 17 min
   (#338/#339/#340) [FACT: head refs + merged_at]. Cost: PR numbers stop identifying change
   units, overlapping diffs, and it directly caused failure mode 3. Producing pattern: the
   agent session keeps working on a branch after its PR merges; the human merges whatever is
   there when they look up.

3. **Premature squash = silently lost commits.** #335 was squash-merged 44s after opening,
   landing only 2 of the branch's eventual 4 commits; a user-reported bug fix (Volunteer
   Orientation nested links) "never reached dev" for ~26 hours until #337 noticed and
   cherry-picked it; #336 closed as "Old" [FACT: #337 body, #336 state]. Cost: a
   believed-shipped fix unshipped, one PR (#336, 2149 additions) written and discarded, and
   only self-audit — not review or CI — caught it.

4. **Stale-branch rot → full re-land tax.** #311/#312/#313 (all amguzzi, 07-27/28) sat 4–6
   days unreviewed while inferno-gh's events blitz put dev 20–56 commits ahead; all three were
   closed unmerged and re-implemented as ports #342/#344/#348, each requiring hand-narrated
   conflict resolution and migration renumbering because **all three had claimed 00092**
   (→ 00096/00097/00098/00099) [FACT: bodies]. Extra cost: the dev database had already
   applied two of the migrations under their *old* numbers ("do not re-run … its backfill is
   not a no-op"), so the migration ledger now differs between what dev ran and what the files
   say — tracked only in PR/commit prose. Producing pattern: two supervisors' agent sessions
   racing on one integration branch with no reviewer to land the slower party's work.

5. **Merges don't wait for CI.** Sampled check runs: #339 merged 22:46:12, its `ci` run
   finished 22:47:24 (72s *after* merge); #355 merged 20:40:00, ci finished 20:40:02; #354
   merged 8s after opening — before CI could start [FACT: get_check_runs + merged_at]. Both
   sampled runs concluded green, so no red-CI merge is *proven* [UNVERIFIED across the full
   window], but the merge decision structurally precedes the signal; CI is a post-hoc alarm,
   not a gate. Several PR bodies admit local build/test could not run in the authoring
   sandbox ("CI is the real check here" #318; "CI is the first real build" #336/#337).

6. **Fix-chain density.** Within 24h of feature #318 landing: ≥9 corrective/polish PRs
   (#319, #321, #322, #329, #331, #333, #338, #339, #340), with #346 at hour 27
   [FACT: merged_at]. The whole events surface was effectively debugged in production-dev.
   Meanwhile 16 promotions to main in 10 days — six on 07-31 alone — means each fix-chain
   link also shipped to prod nearly immediately.

7. **Branch discipline bypasses.** #307/#308/#314 merged feature branches straight to main
   (base=main), needing backmerges #310/#315; 5247a3e is a direct push-merge to main with no
   PR at all [FACT: base refs; git show]. Both violate the repo's written rule (CLAUDE.md:
   never commit/push to dev or main directly).

---

## 3. Review state

- **Still zero reviews, repo-wide.** `reviewed-by:` searches for inferno-gh, amguzzi,
  brendanwhitaker, adm-2k each return 0 results across the whole repo; get_reviews returned
  `[]` on all 7 sampled recent merged PRs (#344, #348, #350, #351, #353, #358, #359)
  [FACT: search + get_reviews].
- **Self-merge: 100% of the window.** Every sampled PR has merged_by == user (inferno-gh ×9
  sampled, amguzzi #316, #306) [FACT: merged_by fields].
- **MJ's merge share since 07-30: 100%.** Every merged PR from #318 through #360 (41 merged
  PRs) is authored *and* merged by inferno-gh; amguzzi's last supervised PR activity is
  07-28 (#316/#317), brendanwhitaker's 07-25 (#305). The team has collapsed to one operator
  plus the `HQ` git identity on his commits [FACT: user/merged_by across list; INFER: high
  that HQ == MJ's local git identity, since HQ authors the commits inside inferno-gh's PRs].
- **requested_reviewers still routes to adm-2k** — inferno-gh's PRs request
  [adm-2k, brendanwhitaker, amguzzi]; amguzzi's requested [adm-2k, brendanwhitaker]
  [FACT: #318, #342, #344, #348, #350, #358, #359, #313, #316]. adm-2k has never submitted
  a review. The Vercel bot's "Request Review" button also sits unused on every PR.

---

## 4. Issue #357 and the frozen tracker

**#357** (inferno-gh, 08-03 21:03:47, open): the Moderator preset on
`/admin/participants/[id]/permissions` "granted the 3 poderator caps globally: no pod/cycle
scope, no un-apply in the UI, and no effect on which pods the person sees … Fix: remove the
preset from the page and API, point admins to the assignment flow" [FACT: #357 body].
**PR #358 was opened 23 seconds later** and merged in under 3 minutes; its body reads
"Fixes #." — a broken reference, so the issue never auto-closed and nobody closed it manually
[FACT: #358 body/timestamps]. #357 is not a tracked work item; it is a retroactive changelog
entry for a decision already made — and even that failed to link.

**Why the tracker froze while 58 PRs shipped:** the content issues used to carry now lives in
PR bodies and docs merged via PR. Direct evidence:
- #306 creates `docs/work-day-improvements.md` as a "living feedback / proto-requirements
  doc" with "a graduation path into docs/requirements/" — an issue-tracker substitute
  [FACT: #306 body].
- #348 embeds "**Ship decisions to settle:** re-revocation audit gap (O2), no confirm on Run
  inactivity check (O3), cron not scheduled (O4)" and #349 settles O4 in a promote-PR body
  — while open issue #213 asks exactly that question and was never updated [FACT: bodies].
- #318 carries a "Please sanity-check … before merge" decision table and a "Known follow-ups
  (not in this PR)" section, one item flagged "worth its own issue" — never filed
  [FACT: #318 body; issue search].
- #351 cites an offline design review ("reviewed with HQ 2026-08-02/03") as its authority.
- Findings docs merged as code: `docs/testing/pr-313-findings.md` (referenced by #348, #349,
  and #313's closing comment) [FACT].

### New decision-debt items found in PR bodies #303–#360 (18)

| # | Item | Where |
|---|---|---|
| 1 | problem_statements has no status/moderation column — pre-ballot review has no workflow; "likely wants a requirements/ doc" | #306 |
| 2 | pod_min=5 vs SENSEMAKING_FLOW 12-person floor — two competing definitions of a viable pod | #306 |
| 3 | Pod cull has no phase boundary — unscheduled operational action | #306 |
| 4 | pod_active_join opens 2 days before hackathon — "last call" framing contradicts schedule | #306 |
| 5 | advance-phase hardcodes 24h windows; live intra-day gate flip unrehearsed (+ naive-timestamp tz gap) | #306 |
| 6 | Calendar drift: "Problem Sprint" name/time wrong in code; hackathon absent from hosts' Google Calendar | #306 |
| 7 | Anchor-date table required pre-merge sanity check "it is the cycle calendar the public site will show" — never reviewed | #318 |
| 8 | 00034 seed migration no longer safely re-runnable for events (CHECK + renamed slug) | #318 |
| 9 | featuredEvents naive wall-time vs UTC — events drop ~4h early on Vercel; "worth its own issue" — never filed | #318 |
| 10 | Hackathon `api_id='anchor-03'` vs real Luma id — ownership decision left to owner | #318 |
| 11 | Correct hackathon About copy must be hand-pasted into Luma; Luma still holds wrong theme (climate/energy) | #337 |
| 12 | Non-empty `events.body` silently suppresses the Luma copy — undocumented override rule | #336/#337 |
| 13 | Revocation cron deliberately unscheduled in vercel.json (O4) — contradicts still-open issue #213 | #348/#349 |
| 14 | Dev DB ran 00098/00099 under old numbers ("do not re-run"); migration ledger vs files divergence recorded only in prose | #344/#348 |
| 15 | Poderator pulse_checks scope leaks other cycles' pulses — "acceptable for a read-only stopgap", flagged in a code comment only | #350 |
| 16 | Range-filter deviation from approved design doc ("every page" → Logs/Feedback only) | #351 |
| 17 | ROLE_PRESETS.moderator kept after preset removal (feeds role-to-caps resolution) — cleanup undecided | #358 |
| 18 | Survey nudges (survey_contribute/share tasks) permanently dropped during the #311 port — product removal decided in a PR body | #342 |

Plus standing: `origin/feat/luma-driven-event-pages` "still has unmerged" content per #337
[UNVERIFIED whether branch was since deleted].

---

## 5. Open PR state (as of run)

Exactly **7 open PRs — the identical pre-existing seven**, all untouched in the window:
#286 (vibe-scan doc, upd. 07-17), #248 (upd. 07-13), #244, #243, #199, #185, #173
[FACT: list open PRs]. None received a review, comment, or push since 07-25. The vibe-scan
audit (#286, "38 findings") remains unmerged even though Tier-1 fixes from it shipped back
in #291–#294.

**#311, #312, #313: all CLOSED unmerged** (07-31, 08-01, 08-02), superseded by re-lands
#342/#344/#348. #336 also closed unmerged ("Old"). #360 was the last event in the repo
(merged 08-04 02:21Z).

Issues: 14 open (13 carried + #357); zero closed in the window [FACT: list_issues
totalCount=14, no closed_at in range].

---

## Gaps

- **Red-CI merges**: only 2 PRs' check runs sampled (#339, #355 — both green but completed
  after merge); a full sweep of all 58 head SHAs was not done, so "no red merge" is
  [UNVERIFIED] beyond the sample.
- **Whether prod actually received 00092–00098 in order**: #349 documents prod apply of
  00099/00100 only; the apply state of the wave-2 migrations (00092–00095) on prod rests on
  PR-body instructions ("apply before promotion") with no confirmation artifact [UNVERIFIED].
- **HQ identity**: HQ <hq@theupskillinglabs.org> authors commits inside inferno-gh PRs and
  the direct main merge 5247a3e; equating HQ with MJ is [INFER: high], not proven.
- **docs/testing/pr-313-findings.md contents** (O-decision full list) not read — file lives
  in-repo; local tree read was out of lane scope beyond git log cross-checks.
- **Why activity stops 08-04**: no signal in the GitHub stream (no comment, issue, or PR
  explains the halt) [UNVERIFIED — outside this lane].
- Comments on most PRs are the Vercel deploy bot; a handful of human comments may exist on
  PRs not sampled with get_comments.
