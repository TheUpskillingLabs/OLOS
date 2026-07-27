# PRD — The Deliberation Layer

| | |
|---|---|
| Status | **Proposal — for leadership review.** Not ratified. No schema claimed, no migration number reserved. |
| Author | Drafted 2026-07-27 |
| Audience | Owner, board, HQ leadership; DCPL innovation + digital inclusion leads as a secondary audience |
| Companion — program | [`LOCAL_LABS.md`](LOCAL_LABS.md), [`SECTOR_MODEL.md`](SECTOR_MODEL.md) — the cohort structure this sits inside |
| Companion — surfaces | [`PRD-moderator-dashboard.md`](PRD-moderator-dashboard.md) — the facilitator surface §7 extends |
| Related code | `app/(dashboard)/cycles/[cycle_id]/{propose,proposals,vote,solution-vote}/`, `lib/validations/votes.ts`, `app/api/votes/`, `lib/updates/social.ts` |

---

## 1. The proposition

**OLOS aggregates preferences. It does not host deliberation.** Those are
different things, and the gap between them is the largest unclaimed product
opportunity in the platform.

Today a cycle runs *propose → vote*. A participant writes a problem
statement, and some days later a ballot appears with a vote budget. Between
those two moments there is no surface on which cohort members reason with
one another about what they are about to decide. The vote is a poll: it
measures preferences that were formed elsewhere — in Slack, in a session, or
not at all.

This proposal argues that the deliberation *between* proposing and voting is
the most valuable thing the program produces, that OLOS is unusually well
positioned to host it, and that capturing it is simultaneously a product
improvement, an equity commitment, and — per the People's Archive
partnership — the creation of an archival record with standing.

The ask is a decision on scope and sequencing, not a request to build
everything described here.

---

## 2. Why now

Three things converge.

1. **The DCPL partnership.** A public library is not a neutral venue for
   this; deliberative forums are a practice libraries have hosted for the
   better part of a century. A cohort model that produces a documented
   community deliberation is legible to a library in a way that "we ran a
   coding bootcamp" is not.
2. **The People's Archive as publisher.** The deposit is stronger if it
   contains reasoning, not only outcomes. A tally is a number. A record of
   why forty residents thought a problem mattered — and why some disagreed —
   is a primary source.
3. **We already own the vocabulary.** The Triangulator rubric (§3.2) is a
   shared evaluative language sitting unused as a private checkbox. Turning
   it outward is a small change with disproportionate effect.

---

## 3. Current state — evidence

### 3.1 What exists

| Surface | What it does | Deliberative? |
|---|---|---|
| Propose (`propose-form.tsx`) | Submitter writes a statement + `voter_context` | Reason-giving, one direction only |
| Proposals gallery (`proposals/page.tsx`) | Read-only browse of statements | No interaction of any kind |
| Ballot (`vote/vote-ballot.tsx`) | Budgeted vote allocation, live tallies | Aggregation |
| Solution ballot (`solution-vote/solution-ballot.tsx`) | Budgeted allocation, tallies suppressed | Aggregation, blind |
| Pulse check | Private weekly reflection — blockers, tailwinds, mitigation | Reflective, not collective |
| Feed (`profile_updates`) | Social posts with likes + comments (00073) | Social, not decision-linked |
| Vote progress (`moderator/…/vote-progress`) | Aggregate tallies, poderator-scoped | Observation |

The feed is the only place in OLOS where one member responds to another in
writing — and it is attached to social updates, not to any decision the
cohort is making.

### 3.2 The asset we are not using

`lib/validations/votes.ts:54-64` defines a five-point quality rubric applied
to every problem statement:

```
grounded_in_evidence · real_actors · no_solution ·
paradox_self_undoing · same_picture
```

The submitter ticks these privately before submitting. Nobody else ever sees
them, and no one is ever asked to assess a *different* person's statement
against them. This is a ready-made shared standard for collective
evaluation, already written in the program's own idiom.

Likewise `voter_context` — `tried`, `scale`, `pod_work`, `skills_needed`
(`votes.ts:48-53`) — is explicitly the submitter making an argument to
voters. The reply channel was never built.

### 3.3 Two inconsistencies worth naming

- **Tally visibility contradicts itself.** The solution ballot deliberately
  hides tallies to prevent bandwagon effects (`solution-ballot.tsx:52-60`,
  "blind voting hides tallies regardless"). The problem-statement ballot
  shows live running totals on every card (`vote-ballot.tsx:419-427`). Same
  product, same class of decision, opposite theory of influence. One of
  these is wrong.
- **Revision is possible but invisible.** `voteSetSchema` is
  set-absolute — a voter can change an allocation at any time
  (`votes.ts:88+`). Changing your mind is the central act of deliberation,
  and the product neither notices nor records it.

---

## 4. What we mean by "deliberation"

Leadership should hold one definition, because the word is used loosely.
Three conditions, all required:

1. **Reason-giving.** Positions are stated with grounds, not only
   registered.
2. **Exposure.** Participants encounter reasoning they do not already hold.
3. **Revisability.** Preferences can change, and changing them is
   legitimate rather than embarrassing.

By that standard OLOS currently satisfies (1) partially and in one
direction, and neither (2) nor (3).

**Deliberation is not consensus.** Nothing here proposes that cohorts must
agree. Preserved, attributed disagreement is a *success* condition of this
work, not a failure of it.

---

## 5. Goals

- **G1.** Every consequential cohort decision carries a durable record of
  the reasoning behind it — including the reasoning that lost.
- **G2.** A participant encounters at least one substantive position they
  did not already hold before voting.
- **G3.** Changing your mind is visible, safe, and normal.
- **G4.** Facilitators can see where deliberation is thin, dominated, or
  absent — and intervene during the window, not after.
- **G5.** Every deliberative artifact is consent-tiered and archive-ready at
  the moment of creation (see §10).
- **G6.** None of the above increases library staff moderation load
  materially. Structure carries the burden that human moderation otherwise
  would.

---

## 6. Non-goals

Explicitly out of scope. Several of these are the obvious thing to build,
which is why they are listed.

- **N1. General threaded comments on everything.** Unstructured comment
  sections degrade predictably and transfer cost to facilitators. The feed's
  comment primitive stays where it is.
- **N2. Real-time chat.** Slack exists and is where synchronous talk
  belongs.
- **N3. Engagement metrics that reward volume.** No comment likes, no
  reply counts as status, no leaderboards. Rewarding output volume selects
  against the quiet participant this program exists to serve.
- **N4. Replacing facilitation.** This augments a session; it does not
  substitute for one.
- **N5. AI as a first-class deliberation participant.** See §11.4.
- **N6. Anonymous posting by default.** See §9.3.
- **N7. Opinion-clustering at pilot scale.** See §11.3.

---

## 7. Functional requirements

Grouped by phase. Phase A is scoped to be pilot-ready for a first library
cohort; B and C are sequenced behind evidence from that pilot.

### Phase A — make reasoning visible

#### 7.1 Reason-on-vote

When a participant allocates votes to a statement, prompt for one sentence
on why. Optional to submit, always asked.

- Attaches to the `(voter, statement)` allocation, not to the statement.
- Editable while the window is open; the edit history is retained but not
  displayed to peers.
- Appears on the statement's detail view alongside other voters' reasons.
- **Not required** — a hard requirement converts an equity feature into a
  literacy tax.

*Rationale: the single cheapest change with the highest yield. It converts a
tally into a corpus, and it is the piece the Archive most wants.*

#### 7.2 Statement response using the Triangulator rubric

On any statement in the gallery, a cohort member may respond by assessing it
against the five existing criteria (§3.2) — each as agree / unsure /
disagree, with an optional line of explanation.

- The submitter's own self-check is revealed *after* a respondent submits
  theirs, never before. (Avoids anchoring; makes the comparison the
  interesting moment.)
- Aggregate rubric response is shown on the statement — e.g. "7 of 9
  respondents felt this names real actors; 3 were unsure it avoids proposing
  a solution."
- Teaches the rubric by use rather than by instruction.

*Rationale: structured response instead of a comment box. Bounded input,
no moderation surface, and it produces comparable data across statements.*

#### 7.3 A deliberation window in `cycle_config`

A distinct, configurable phase between proposing and voting — a sibling of
the existing `voting_open`/`voting_close` pair. The cycle timeline, phase
indicator, and dashboard "up next" strip gain a corresponding step.

- Gallery becomes interactive during the window; ballot stays closed.
- For a 6–8 week library cohort this maps to one session plus the week
  around it.

*Rationale: deliberation that shares a window with voting will be skipped.
Phase separation is the mechanism that makes the rest of this real.*

#### 7.4 Preserve the reasoning of statements that don't advance

When a statement falls below `vote_threshold`, its reasons, rubric
responses, and supporters' arguments are retained and remain readable at a
stable URL rather than disappearing with the ballot.

*Rationale: deliberative respect, and — for the Archive — the record of
what a community considered and declined is frequently more revealing than
the record of what it built.*

#### 7.5 Resolve tally visibility

Adopt one posture across both ballots. **Recommendation: blind during the
window, fully open immediately after it closes**, with reasoning visible
throughout in both phases.

*Rationale: reasons should influence; running scores should not. This also
fixes the current contradiction (§3.3) and makes the moderator vote-progress
view the deliberate exception rather than an inconsistency.*

### Phase B — make revision and facilitation real

#### 7.6 Visible, safe preference revision

Surface to the individual: "you moved 2 votes from A to C after the
deliberation window." Offer an optional note on why. Aggregate movement —
never individual movement — is shown to the cohort after close.

*Rationale: in deliberative polling the change is the measurement. It is
also the clearest evidence that the program worked.*

#### 7.7 Facilitator deliberation view

Extends the Poderator dashboard (`PRD-moderator-dashboard.md` §7):

- statements with zero engagement
- participants who have not responded to anything
- statements where response is dominated by one or two voices
- where the cohort is genuinely split, as a prompt for the next session

Read-only. Signals for a facilitator to act on in the room, not automated
nudges.

#### 7.8 Support breadth vs. intensity

Budgeted voting already distinguishes "4 votes from 4 people" from "4 votes
from 3 people," and the data is in `votes` today but surfaced nowhere.
Display both figures wherever a tally appears.

*Rationale: intensity and breadth are different mandates and should be
legible as such before a cohort commits eight weeks to a problem.*

### Phase C — decisions as artifacts

#### 7.9 Decision records

Every consequential transition — statement becomes a pod, proposal becomes a
project, pod charters its scope — produces a durable record: what was
decided, what the alternatives were, the vote distribution, the reasoning on
each side, and any registered dissent.

*Rationale: this is the ADR pattern applied to civic work, and it is the
object the People's Archive would actually accession.*

#### 7.10 Consent-based decisions inside pods

Once a pod forms, majority voting is the wrong instrument for a group of
six. Offer sociocratic consent: a proposal stands unless someone registers a
reasoned objection, and objections are recorded and resolved in the open.

*Rationale: pods currently make their consequential decisions with no
record at all. This is the largest documentation gap in the cycle.*

#### 7.11 Minority report

A facilitator may advance one statement or proposal that did not meet
threshold, with the record stating plainly that it advanced on deliberative
grounds rather than vote count.

*Rationale: the safety valve that keeps a threshold from silently
overruling a well-argued minority. Deliberately capped at one, deliberately
attributed.*

---

## 8. Design principles

1. **Structure over free text.** Every input is bounded and typed. This is
   what keeps quality up and moderation load down (**G6**) — the two are the
   same constraint.
2. **Asynchronous first.** Cohorts meet weekly; deliberation happens in
   between. Nothing may require simultaneity.
3. **Low literacy load is an equity requirement.** Plain language, short
   inputs, examples, no minimum lengths, voice input where practical.
   Optional at every step. A deliberation layer that rewards fluent writers
   selects against the participants a digital-inclusion cohort exists to
   reach. This is the principle most likely to be quietly dropped under
   schedule pressure, and it is the one that would most invalidate the work.
4. **The vote is not the whole decision, and the UI should say so.**
5. **Disagreement is a preserved artifact,** never a problem to resolve away.
6. **Every artifact is consented at creation** (§10).

---

## 9. Permissions, safety, attribution

### 9.1 Scope
Deliberation is cohort-scoped — cycle and lab, matching the existing
same-lab guard on voting (`app/api/votes/route.ts`). Nothing here is
public-by-default.

### 9.2 Roles
Participants respond; facilitators see the §7.7 view and may advance a
minority report; admins retain existing oversight. No new role tier.

### 9.3 Attribution
**Attributed by default.** In a cohort of 8–30 people anonymity is largely
illusory, and attribution is what makes reason-giving accountable. Provide a
facilitator-visible-only option for genuine sensitivity. Do not provide
cohort-wide anonymous posting — it is the feature most likely to require
the moderation capacity we have committed not to consume.

### 9.4 Code of conduct
The existing CoC governs. Structured inputs (§7.2) sharply narrow the
surface for harm relative to open comment fields, which is a substantial
part of why they are the chosen form.

### 9.5 Accessibility
Every component ships WCAG 2.1 AA conformant. For a public-library
deployment this is a procurement gate, not a preference — and there is no
a11y testing in CI today. That gap should close before, not after, new
interactive surfaces land.

### 9.6 Language access
DC's Language Access Act and DCPL's service population make multilingual
support a real requirement rather than a future nicety. Phase A should at
minimum avoid designs that assume English-only input, even if translation
itself is out of scope for the pilot.

---

## 10. Archive alignment

Deliberation records are the artifact the People's Archive would publish.
That imposes requirements on Phase A rather than on Phase C:

- **Consent is collected at creation and again at deposit,** per-artifact
  and tiered (open / library-only / embargoed / dark). The existing
  `consent_version` / `anonymized_at` pattern on survey responses is the
  precedent to generalize.
- **Reflective material is not archival by default.** Pulse checks and
  learning logs are formative writing and stay out unless explicitly opted
  in. Deliberative material — reasoning offered publicly to peers about a
  shared decision — is a different category and can reasonably default to
  archivable *with* consent.
- **Withdrawal** is available until deposit; afterward, takedown of the
  published copy.
- **Authorship is retained by participants** and carried in the artifact
  metadata. Consistent with the ownership position in the Archive
  partnership: contributors hold copyright, the Archive owns the edition.

The practical consequence: **the consent fields must ship with Phase A, not
after it.** A cohort that deliberates without a consent architecture in
place has produced an unarchivable record, and that cannot be fixed
retroactively once the cohort disperses.

---

## 11. Risks

**11.1 Deliberation theater.** If the vote still decides everything and
reasoning is decorative, participants will detect it immediately and
disengage — leaving us worse off than before. §7.11 (minority report) and
§7.9 (decision records) are the mitigations that give deliberation actual
consequence. If leadership rejects both, I would recommend not building the
rest.

**11.2 Time cost.** A 6–8 week cohort has perhaps 20 contact hours. A
deliberation phase spends some of them. This is the real trade and should be
made explicitly with the program leads rather than discovered mid-cycle.

**11.3 Small-n.** Opinion clustering of the pol.is variety needs hundreds of
participants to produce meaningful groupings. At 8–30 it produces noise
dressed as insight. Deferred to Phase C or later, and only if cohort scale
justifies it (**N7**).

**11.4 AI mediation.** Summarizing deliberation with an LLM is tempting and
would work reasonably well — we already run Anthropic for pod naming and
moderator insights. It is nonetheless Phase C at the earliest, consent-gated
(`subject_informed_ai` exists for this reason), always additive to the
source text rather than a replacement, and never in the path of a decision.
Summarizing a community's reasoning back to itself is precisely where an
error is least visible and most consequential.

**11.5 Scope displacement.** This competes for the same engineering capacity
as the open-source extraction work and the DCPL pilot's blocking items
(non-Google sign-in, accessibility). §13 proposes the ordering.

---

## 12. Success measures

Deliberately mixed — the qualitative one is the real test.

| Measure | Signal |
|---|---|
| Share of allocations carrying a reason | Reason-giving took hold (§7.1) |
| Share of participants who responded to a statement they did not vote for | Exposure to difference (**G2**) |
| Preference-revision rate across the deliberation window | Minds changed (**G3**) |
| Breadth vs. intensity spread on advancing statements | Mandate quality (§7.8) |
| Facilitator moderation hours | Must stay near flat (**G6**) |
| Deposit-consent rate | Archive viability (§10) |
| **Can a participant explain why a statement they didn't support advanced?** | Whether any of this worked |

---

## 13. Proposed sequencing

Phase A is scoped to land inside the first library cohort. It should be
sequenced **behind** the two DCPL blocking items — non-Google sign-in and
the accessibility audit — because neither the program nor this feature can
run without them.

| Order | Work | Why here |
|---|---|---|
| 1 | Non-Google sign-in; a11y audit + CI gate | Blocks the pilot entirely |
| 2 | Consent/rights fields (§10) | Must precede cohort 1 or the record is lost |
| 3 | Phase A §7.1, §7.3, §7.5 | Smallest set that changes the cycle's shape |
| 4 | Phase A §7.2, §7.4 | Rubric response + dissent preservation |
| 5 | Pilot cohort runs | Evidence |
| 6 | Phase B, informed by 5 | Revision + facilitation |
| 7 | Phase C | Decision records, pod consent, archive packaging |

Steps 3 and 4 reuse shipped patterns — the feed's comment primitive
(`profile_update_comments`, 00073) is the closest analogue for storage, RLS,
and validation shape, which materially lowers the cost of both.

---

## 14. Decisions requested from leadership

1. **Is deliberation a phase or an overlay?** Recommendation: a distinct
   phase (§7.3). A phase extends the cycle calendar; an overlay will be
   skipped.
2. **Does deliberation carry consequence?** Recommendation: adopt §7.11
   (one facilitator-advanced minority report, attributed) and §7.9 (decision
   records). Without at least one of these, see **11.1**.
3. **Blind or open tallies?** Recommendation: blind during, open after,
   uniformly across both ballots (§7.5).
4. **Attribution default.** Recommendation: attributed, with a
   facilitator-only option; no cohort-wide anonymity (§9.3).
5. **Sequencing against the DCPL pilot and open-source extraction** (§13).
6. **Program-side trade:** how many of a cohort's contact hours the
   deliberation phase may consume (**11.2**) — a decision for the program
   leads, not engineering.

---

## 15. Considered and rejected

| Option | Why not |
|---|---|
| Threaded comments on statements | **N1.** Degrades predictably; transfers cost to library staff we have committed not to spend (**G6**). |
| Upvoting responses | Converts deliberation into a popularity contest — the precise failure mode this proposal exists to avoid (**N3**). |
| Pol.is-style opinion mapping in Phase A | Needs hundreds of participants; produces noise at cohort scale (**11.3**). Revisit if cohorts grow. |
| Quadratic voting | The existing budget model already captures intensity; swapping the mechanism is a large change that addresses aggregation, not deliberation. |
| Mandatory reason-on-vote | Becomes a literacy tax and depresses participation among exactly the participants the program targets (§8.3). |
| Synchronous deliberation sessions in-product | Duplicates Slack and the physical room; violates async-first (§8.2). |
| LLM-generated deliberation summaries in Phase A | **11.4.** Right idea, wrong phase, and consent-gated when it arrives. |

---

## 16. References

- `lib/validations/votes.ts` — Triangulator rubric, `voter_context`, set-absolute allocation
- `app/(dashboard)/cycles/[cycle_id]/vote/vote-ballot.tsx` — current ballot, live tallies
- `app/(dashboard)/cycles/[cycle_id]/solution-vote/solution-ballot.tsx` — blind-voting posture
- `app/(dashboard)/moderator/cycles/[cycle_id]/vote-progress/page.tsx` — aggregate vote view
- `lib/updates/social.ts`, migration `00073` — the comment primitive to reuse
- [`PRD-moderator-dashboard.md`](PRD-moderator-dashboard.md) §7 — facilitator surface
- [`LOCAL_LABS.md`](LOCAL_LABS.md) — cohort/lab structure
- [`docs/audit/DATA_ARCHITECTURE.md`](audit/DATA_ARCHITECTURE.md) — consent-column precedent
