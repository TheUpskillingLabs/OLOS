# Vibe Scan — recurring AI-coding defect patterns, codebase-wide

**What this is:** a systematic scan of the codebase for the defect classes that keep
showing up in fixes — unlinked parallel configs, seed data displayed as live,
duplicate derivations, create-vs-edit asymmetries, duplicate actions. The deliverable
is an **inventory of weirdness plus the decision questions we need answered to
simplify** — not fixes. Scan date: 2026-07-15, dev-lineage @ `5377f4d`.

**How to read:** each finding cites `file:line` evidence, the user-visible symptom,
a severity, and the product question that unblocks simplification. Verdicts:
`CONFIRMED` (read the code, it disagrees/duplicates) · `DOCUMENTED-BRIDGE` (the
duplication is a declared, intentional migration bridge — the question is *when it
retires*, not whether it's a bug) · `REFUTED` (suspected, checked, fine).

Companion docs: [`GAP_AUDIT.md`](GAP_AUDIT.md) (2026-07-04 — intent-vs-reality;
partially stale, see §Ledger) · [`../feedback-running-list.md`](../feedback-running-list.md)
(hands-on testing feedback #1–#11 + July-11 triage).

---

## The pattern taxonomy (grounded in fix history)

| # | Pattern | Canonical past instance |
|---|---|---|
| P1 | Configs/stores that do the same job but aren't linked | Registration hours stored in `cycle_agreements.answers` while the profile read a separate availability list (`77b318a`); project follow wrote `project_subscriptions` while the feed read `follows` (`aebcb70`) |
| P2 | Display values that are dummy/seed data, not calculated | Homepage lab counts read hand-set `metros.members` — DC showed 312 vs 62 real (`9763c5f`); prototype dates shipped in `anchor-events.ts` (`0968d93`) |
| P3 | Same thing calculated multiple ways in multiple places | Metro label computed at 6 join sites → "Washington, DC, DC" (`5460f11`); vote budget derived independently in ballot and server (`779da15`) |
| P4 | Over-complicated logic | Directory tab snap-back from stale searchParams adoption (`04eaf0a`); `.single()` throwing on missing config instead of a clear message (`779da15`) |
| P5 | Config editable in one place but not another | Cycle theme copy hardcoded until `cycle_config.theme_description` (`c3cdd32`); Register CTA vanishes when a cycle flips `active` though the join route still accepts it (feedback #1) |
| P6 | Duplicative actions/buttons | Duplicate composer-less feed in the directory; two follow mechanisms; redundant log-due alert (`aebcb70`) |
| P7 | Over-broad permission gates / scope confusion *(emergent from fix history)* | Pod pulse data exposed via a globally-granted permission — fixed three times on the same page (`3d55574`, `04eaf0a`, `aee0bdf`); `/admin/org` absorbed lab cycles (`8201b58`) |
| P8 | Stale/archived data still surfacing *(emergent)* | Archived metros still returned by public queries (`7aaa8cb`) |

---

## Findings

> Populated by the 2026-07-15 scan (six domain passes: cycles/windows,
> pods/projects/votes, participants/auth/roles, counts/labs/content,
> learning-logs/moderator, admin/owner/validations). Ranked within each pattern by
> severity: **high** = users see wrong data or are blocked · **med** = inconsistent
> behavior/UX · **low** = maintainer-only risk.

*(scan in progress)*

---

## Questions to answer to simplify

*(populated after adjudication)*

---

## Proposed simplification backlog

*(populated after adjudication)*

---

## Ledger — already-filed issues (not re-reported above)

Seeded from the existing catalogues so this scan doesn't double-count them.

### From `docs/feedback-running-list.md` (2026-07-12)

| # | Item | Pattern | Status there |
|---|---|---|---|
| 1 | Register CTA only renders for `status='upcoming'`; gone once `active` though join route accepts it | P5 | 🔍 root-caused, open |
| 2 | Can't see own problem statement after submitting | P5 | 🆕 |
| 3–5 | Voting UX: budget clamp, vote visibility, vote removal | P3/P6 | ✅ addressed (#224) |
| 6 | Zip→state autofill on profile | — (feature) | 🆕 |
| 7 | Availability not carried registration→profile | P1 | ✅ hours (#238); root pattern remains dual-store |
| 8 | "Pre-registered" card is a dead end | — (UX) | 🆕 |
| 9 | Page-admin management on the view page; where should it live? | P5/P6 | hidden on pods (#225); decision open |
| 10 | Intro/welcome screen shows on return sign-in | P4 | 🆕 |
| 11 | What to collect on no-lab waitlist join | — (design) | 🆕 |
| — | July-11 triage items (see doc) — many ✅ on #224–#228 | various | mixed |

### From `docs/audit/GAP_AUDIT.md` (2026-07-04 — **partially stale**)

Audited at PR #144; since then learning logs, the directory, follows, stories, and
the owner console have shipped, so Part A rows describing those as `missing` are
historical. Items believed still live and relevant to this scan:

| Item | Pattern | Notes |
|---|---|---|
| B4 violations 1–2: revocations routes demote/promote directly, bypassing the reconciler | P7-adjacent | verify current state (see Findings) |
| B5: `lib/metros.ts` still wired into the funnel despite the real `metros` table | P1 | verify |
| B5: dead code — `POST /api/registrations/short`, `.heart` CSS | hygiene | verify |
| B5: placeholder-name debt (`Unknown` rows) gated by `lib/participants/placeholder.ts` | P2 | verify |
| B5: stale docs (`TUL_MVP_Spec.md` FastAPI backend, roadmap §6 tracker self-admittedly wrong) | P2 (docs) | still true as of this scan's exploration |
| B1 §1.6/1.7: `events`/`resources` column drift vs spec names; `resources.from_line` text instead of `project_id` FK | P1 | spec errata never written |
| A4 voter-eligibility policy fork (problem votes budgeted, project votes submitter-only; `non_submitter_votes` config partially unwired) | P1/P5 | owner decision §10-Q1 still open |
| A7 "Moderator" rendered-copy leak at vote-progress page | copy rule | verify fixed |
| RSVP rate limiting missing (spec pre-launch blocker) | security | verify |

### Known-good reference patterns (use these when consolidating)

- **Paired create/patch schemas in one file** — announcements, surveys (`lib/validations/`)
- **Single shared action component** — `app/components/follow-button.tsx` (one component, one endpoint, reused everywhere)
- **Centralized lifecycle registry** — `lib/owner/registry.ts` + `app/components/owner-lifecycle.tsx` + `api/owner/[entity]/[id]`
- **Extracted single-source helpers born from past fixes** — `lib/metros-label.ts` (`metroLabel`), `lib/format/rel-time.ts` (`relTime`), `lib/cycle/week.ts` (`getCycleWeek`), `lib/learning-logs/eligible.ts`
