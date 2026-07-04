# Design Intent — the distilled dossier

**What this is:** the single-page-per-theme reference for what the product is *supposed to be*,
distilled from the design source of truth (`onboarding-proto`). Check changes against this
before shipping; when OLOS deviates from the prototype, the deviation needs a stated reason and
a ratification trail (precedent: the OAuth read-only email step, ratified in
`docs/PROTO_TRANSLATION_PLAN.md` Stage B — "strictly better").

Every entry cites its source. Prototype paths are relative to the `onboarding-proto` repo.
Companion docs: `docs/audit/GAP_AUDIT.md` (where OLOS stands against this intent) and
`docs/audit/IMPROVEMENT_ROADMAP.md` (the reconciled build sequence).

---

## 1. Identity: naming + voice (hard rules)

- **The brand is "The Upskilling Labs", shortened only to "The Labs" — never "TUL"** or any
  other abbreviation, in every rendered string. Fine in prose/commits. (proto `CLAUDE.md:20`)
- **The persona word is "Poderator", never "moderator", in rendered copy.** Code identifiers
  and routes may keep `moderator`. (proto `CLAUDE.md` moderator.html entry; `UX_EVALUATION.md:45`)
- **The noun for a cohort is always "Build Cycle."** Cycles have modes: `open` / `closed`.
  (proto `CLAUDE.md:284`)
- **Voice (Red Antler register, smart-14-year-old reading level):** short declarative
  sentences, plain words, second person, zero jargon; warm but precise — dates, numbers, terms
  stated exactly; no hedging, no corporate speak. Gravity moments (threshold, agreement, gate)
  stay weighty in plain language ("that's the deal, and you're agreeing to it").
  (proto `CLAUDE.md:24`)
- **Always lead with benefits, rooted in the member's hero's journey:** the member is the hero,
  The Labs is the guide. Copy opens with where THEY end up, then the path, then the ask. Never
  open with what the program is or demands. (proto `CLAUDE.md:24`)
- **Never deprecate learning/education:** the critique targets information overload and
  outdated methods, never learning itself. (proto `CLAUDE.md:34`)
- **Copy changes happen in the prototype first, then re-port** — owner-approved copy is ported
  byte-for-byte, curly apostrophes included. (`docs/PROTO_TRANSLATION_PLAN.md` Stage B)
- Reference lines already in the voice: "Find your people. Build your edge." / "Not a
  curriculum. Real work." / "You keep the craft, the credit, and the story."

## 2. The UX constitution (12 rules — owner decisions; judge every surface against them)

Quoted from proto `docs/UX_EVALUATION.md:33-51`:

1. **Every seam gets a threshold** — flows never silently chain; close ✓ → name next → consent.
2. **Terms before effort, ceremony after intent** — commitment summary precedes questions;
   signature ends them.
3. **Any agreement is scroll-gated** — read to the end before agree/sign ("Read to the end ✓";
   content that fits without scrolling counts as read). Applies to EVERY current and future
   agreement. (also proto `CLAUDE.md:435`, `attachAgreeGate` app.js:1104)
4. **Registration has gravity; account creation stays light.** "Not now" is always respectable.
5. **The weekly cadence has teeth** — the lockout gate is firm, instant to clear, never shaming
   ("You're back in ✓").
6. **Evidence precedes assistance** — mentor requests carry tried/evidence/challenge.
7. **The Poderator is a shepherd, not a manager** — wide member latitude; faltering is process
   data, never a member record.
8. **Trust is earned, never default** — locked badges, requested-only testimonials,
   admin-granted vouching.
9. **The commons is whispered early, stated at the threshold, bound at the signature** — never
   sprung.
10. **Public browse is free** — no gated see-alls; survey and RSVP never require an account.
11. **Design system:** warm `--paper` only; dark reserved for covers/nav/ceremony; one radius
    (`--r` 14px, no pills); orb never raw under text; 16px+ inputs; `100dvh` shells; chrome
    switches at 768px; "The Labs" never "TUL"; "Poderator" never "moderator."
12. **Design language:** every element follows the Tinder/Airbnb-inspired language the landing
    sets — media-led tappable cards with soft elevation and hover lift; flush full-bleed
    imagery; bottom-sheet modals and sticky action bars on mobile; bold tight display type
    with eyebrow labels; generous section rhythm; conversational copy. No surface gets to feel
    like a different product — admin and Poderator tables included.

## 3. The journey (11 stages, each with an intended register)

From proto `docs/UX_EVALUATION.md:17-31` — the register column is intent, not decoration; a
technically-working screen in the wrong register is a defect:

| Stage | Core mechanics | Intended register |
|---|---|---|
| **Discover** (public) | Browse free; every card is a teaser opening the item's real page; city-first waitlist joins | Light, warm, zero pressure |
| **Contribute** (public) | Survey + RSVP with no account, "add another" loop, share link | Effortless, generous |
| **Join** | Auth explainer → role intent → 5-screen signup → scroll-gated Participant Agreement; silent zip→metro | Quick, respectful — "give your name at the door" |
| **Commit** | Two-beat threshold → questions → Open Cycle Agreement signature → signed confirmation + `.ics`; committed dates findable forever | Weighty but warm — "sign a lease you understood" |
| **Practice** (weekly) | Setup checklist, Learning Log (sliders + blocked toggle + 3 prompts + share preview), todos; the weekly hard gate | Light ritual; gate firm, never shaming |
| **Form** (cycle) | Situations → proposals → budget ballot (locks on cast) → tally + naming beat → team registration | Legible momentum; ignition celebratory |
| **Build** | Ignition interstitial → project canvas (frame/intervention/metrics/evidence, roster, mentor request) | Earned, real |
| **Connect** | Directory (members-only), profiles, follow, requested-only testimonials, nominations | Trustworthy, earned |
| **Sensemake** | Survey pool → Triangulator; concept-before-pool; unsaved-work guard | Focused, tool-like |
| **Shepherd** | Poderator: journey spine, compliance strip, needs-attention, themes, AI bundle (clipboard), process signals | Calm, observational — never managerial |
| **Operate** | Admin: phase controls, cycle knobs, aggregate-only vote progress, invitations | Instrumental |

## 4. Owner-decision ledger

The located non-negotiables beyond §1–§2. Source of each: proto file:line.

**Architecture**
- The signed-in app is real pages, one per destination — Home (`dashboard/`) · My Cycle ·
  Learning · Directory · Me — the LinkedIn model, not a SPA. (`CLAUDE.md` repo-layout;
  `app.js:836`)
- **"Me" is the avatar**, not a nav link; its menu opens with a filled **Profile** button,
  then View-as, feedback, sign out. Mobile tab bar carries the same five. (`CLAUDE.md:159`,
  `system.css:251`, `HANDOFF.md:27,44`)
- **Cards are teasers; every content item has a real page** — shareable URL, breadcrumb,
  "more like this", signed-out upsell. No accordion browse cards (the cycle page's working
  lists and stories keep expand-in-place by design). (`CLAUDE.md:168`)
- **Production-architecture fidelity**: the prototype's structure mirrors OLOS's public
  surface 1:1 — data.js ↔ table, generate.js ↔ server render, session flag ↔ auth session.
  (`CLAUDE.md:194`)
- Design system: three layers, one source each — tokens → system → per-page vocabulary; the
  home page is the reference design; a shared component changes at the source, never as a
  per-page copy. (`CLAUDE.md:76`)
- Global search is **a quiet icon, not a centered pill** — it graduates only when content
  volume creates a real findability problem. (`search.js:5,8`, `system.css:131`)

**Ceremonies + gates**
- All four cycle-registration entries route through the threshold; **beat 1 value, beat 2 the
  three commitments** (five dated core events, the weekly check-in named honestly, the
  open-source term). "Not now" is a respectable exit on both beats. (`CLAUDE.md:341`,
  `app.js:914`)
- The open-source term is framed as **mutual freedom** (owner wording): "when the cycle's over
  you're free to do whatever you want with it, and so is everyone else." Never "nothing is
  your property"; never "ships to the commons" in member-facing copy. License pair is always
  "MIT code · CC BY 4.0 content" (pending legal review). (`CLAUDE.md:350`)
- **The weekly Learning Log gate is hard**: no log since `logDueAt` → every destination but
  Home routes to the dashboard, nav dims, the log section stays lit; saving unlocks instantly.
  (`CLAUDE.md:381`, `app.js:727`)
- **Leaving well**: stepping back is a respectable status (`stepped_back`), never gate-chased;
  the Poderator sees it; rejoining is one action. (`app.js` startStepBack/rejoinCycle; UX F4)
- Ballots lock on cast, always through a confirm sheet — votes are never mutated directly.
  (`CLAUDE.md` journey rules)
- Post-ignition continuity: ignition interstitial (with an escape), team card flips to the
  canvas, a non-dismissible "Your project" card pins first in Up next. (`CLAUDE.md` journey rules)

**Trust + community**
- Directory and member profiles are **members-only at launch** (`profileVisibility='labs'`);
  public portfolio tier is opt-in and deferred. (`people/data.js:3`, backend doc §7)
- **The Work layer is public by artifact, private by process** — approved case studies, pod
  identity+output, opt-in portfolios; never raw working state. (`pods/data.js:4`,
  `projects/data.js:3`)
- Testimonials are requested, never self-written; authors write, subjects can only hide.
  Vouching ("✓ Vouched by The Labs") is admin-granted, never self-serve. (`CLAUDE.md` flows)
- Mentor intake **publishes immediately** — no review queue; staff can concierge, never gate.
  Nominations likewise: members surface talent, staff concierge. (`CLAUDE.md` flows)
- Waitlists are **city-first**: commit the city before the account ask; never ask for the city
  twice. Metros have exactly two states (active / waitlist). (`CLAUDE.md:184`, `app.js:312`,
  `labs/data.js:5`)

**Shepherd + operate**
- Process signals are an R&D intervention-design log — where teams falter, the faltering is
  data for upstream fixes, **never a member record**. (`moderator.html:480,487`, backend §6b)
- The Poderator AI bundle is **copy-to-clipboard; no in-app LLM** for member-reflection
  analysis. (OLOS's one sanctioned LLM use is project/pod naming.) (`CLAUDE.md` moderator entry)
- Vote progress shows **aggregates only, never per-voter attribution**. (`admin.html` intent)
- Milestone evaluations are Learning Log variants (`kind:'milestone_7'|'milestone_13'`),
  prefilled, never grades. (`CLAUDE.md` moderator entry)
- The Triangulator is **reskin-only** — the canvas/classify/export engine stays untouched
  from upstream `triangles`; its design-language divergence is accepted with owner sign-off.
  (`CLAUDE.md` triangulator conventions; `UX_FINDINGS.md:147`)

**The cycle's public rhythm**
- Six anchor events (Kickoff Summit + five core) lead the events data, drive the week rail and
  milestones, and ARE the presence commitment in the Open Cycle Agreement — single source of
  truth, rendered from the array. Phases: Problem Sprint / Frame Sprint / Building.
  (`CLAUDE.md` formation section)
- Formation sizing: pods 12–30; teams real at 3, capped at 5; max 4 projects; ballot budgets
  submitters 5 / others 3; threshold 5. (`app.js:95` CYCLE_CONFIG, backend §2)

## 5. The ceremony chains (state + function anchors)

- **Commit:** `startCycleRegistration(backFn, fromSignup)` → `view-cycle-threshold` (two
  beats) → `FLOWS('cycle')` questions → `signature` step (Open Cycle Agreement,
  `version:'open-2026-07-v2'`, typed full name, scroll-gated) → writes
  `userState.cycleAgreement {name, at, version}` → `view-cycle-signed` (kickoff, `cycleICS()`,
  pod chooser). Production: `cycle_agreements` insert-only, read as a precondition inside
  `reconcileEnrollmentActivation` — never a second enrollment write path. (backend §2c)
- **Form → Build:** proposal UPSERT → `renderSolutionBallot` → `confirmBallot` (locks) →
  `tallyAndFormProjects` + naming beat → `registerForProject` → at min 3 `view-team-ignition`
  → `view-project-canvas`.
- **Practice:** `saveLearningLog()` (three parts: health metrics private to Poderator+admins /
  scaffolded reflection / opt-in share to the feed) → `logGateActive()` clears instantly.
  Backend: `learning_logs` (metrics / log_content / share_publicly), the weekly cron arms
  `logDueAt`. (backend §6)
- **Scroll-gate (any agreement):** `attachAgreeGate(scrollEl, hintEl, onRead)` — agree/sign
  inert until the box is read to the end.

## 6. Data contracts (prototype global → OLOS concept)

The mock shapes are contracts — production swaps the data source, not the markup.
(Full map: proto `docs/HANDOFF.md` §4/§6; backend doc § refs.)

| Prototype | OLOS concept | Backend § |
|---|---|---|
| `EVENTS` (Luma-shaped; anchors carry `kind`+`anchor:true`) | `events` Luma cache | §1.6, §3 |
| `RESOURCES` (`from` = commons provenance) | `resources` CMS | §1.7, §4 |
| `METROS` (two-state) | `metros` + `metro_waitlist_signups` | §1.1/§1.1b |
| `MEMBERS` | `participants` directory query (members-only) | §7 |
| `CYCLE_CONFIG` | `cycle_config` knobs | §2 |
| `SOLUTION_PROPOSALS` → `CYCLE_PROJECTS` | `solution_proposals` → `projects` | §1.10, §2 |
| `SITUATIONS` | `problem_situations` (voted-in, read-only history) | §1.10 |
| `userState.learningLogs` | `learning_logs` (weekly gate reads these) | §6 |
| `userState.cycleAgreement` | `cycle_agreements` | §2c |
| `userState.saved[]` / `following[]` / `updates[]` | saved-items / `follows` / `profile_updates` | §6a, §1.9 |
| `SURVEY_SEED` + `olos.surveyPool.v1` | `field_surveys` + `survey_responses` (anon-capable) | §1.2/§1.3 |
| Triangulator `olos.sensemaking.v2` | `sensemaking_sessions` (JSONB blob) | §1.4 |
| `PROCESS_SIGNALS` | `process_signals` | §6b |
| Mentor intake / `MENTOR_FLAGS` / testimonials | `mentor_profiles` / nominations / `mentor_testimonials` | §5 |
| `FEEDBACK_LOG` | `feedback` (shipped in OLOS: migration 00029) | — |
| `STORIES`/`SPOTLIGHTS`/`STORY_SUBMISSIONS` | editorial tables — deliberately parked | HANDOFF §8 |
| `olos.viewAsRole.v1` | real roles + RLS (View-as is a lens, gating is server-side) | §8 |

## 7. Where intent lives (go deeper)

| Source (in onboarding-proto) | What it codifies |
|---|---|
| `CLAUDE.md` | The whole contract: rules, architecture, flows, function index |
| `docs/HANDOFF.md` | 1:1 translation map — URL→route, data→table, param/key→production |
| `docs/OLOS_BACKEND_CHANGES.md` §1–§10 | Every schema/API change the frontend implies + 12 open product questions |
| `docs/UX_EVALUATION.md` | The constitution, 8 personas, ~45 user stories with AC, the evaluation method |
| `docs/UX_FINDINGS.md` | Round-1 findings F1–F14 + per-surface design-language fidelity grades |
| `app.js` / `chrome.js` / `system.css` | The behavioral truth: flows, gates, renderers, chrome |
