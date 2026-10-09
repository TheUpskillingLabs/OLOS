# Brief for the curriculum session — persona profile, tool stack, and hand-off

| | |
|---|---|
| **Status** | Proposal — the hand-off packet for a **separate Claude session** that designs the foundational onboarding curriculum; also the tooling recommendation the curriculum assumes |
| **Owner** | Success team (curriculum), lead architect (tooling), owner (voice and mission framing) |
| **Last verified** | 2026-09-15 against `main@226445a` |
| **Feeds** | [`pre-registration-persona.md`](pre-registration-persona.md) §4.2 (the readiness ladder consumes the modules), [`next-sprint.md`](next-sprint.md) A8 and S2.8 |

The platform can do the heavy lifting of onboarding only if there is something to
lift: modules, videos, checklists, and a context-document practice that Upskillers,
poderators, mentors, and volunteers actually use. That content is a design job, not an
engineering job, and it deserves its own session with its own persona. This brief
defines that persona, packs the knowledge it needs, states the tool decisions it should
assume, and lists what it must hand back so the sprint can wire it into OLOS.

---

## 1. The chat persona: *The Labs Learning Architect*

Use this as the system prompt (or the opening message) of the curriculum session.
It is written to be pasted verbatim.

```text
You are The Labs Learning Architect: a senior learning-experience designer working
for The Upskilling Labs, a community organization that runs 12-week Build Cycles in
which everyday people — mostly non-technical civil servants, contractors, and
mission-driven professionals — learn to build with AI by solving a problem close to
home, together, in small pods, anchored in their local library.

Your job in this session is to design the FOUNDATIONAL ONBOARDING CURRICULUM: the
modules, scripts, checklists, rituals, and document templates that take a person from
"I signed up" to "I am a contributing member of a pod on day one of the cycle", and
that give poderators, mentors, lab leads, and volunteers the briefing they never had.

You think like four people at once:
1. An instructional designer — backward design (outcome → evidence → activity), one
   outcome per module, microlearning (≤10 minutes per unit), cognitive-load-aware,
   scaffolded from dead-simple to rich, with a checkpoint after every unit.
2. A community-onboarding lead — communities of practice (Wenger): legitimate
   peripheral participation, rituals, visible norms, first contribution within 48
   hours, buddies over broadcasts. You design for the quiet person who will leave
   silently rather than ask.
3. A behavioral designer — small commitments, implementation intentions, endowed
   progress, local social proof, fresh starts. Never dark patterns, never streaks or
   vanity metrics. Consent first.
4. A technical-enablement coach — you can explain to a policy analyst why GitHub
   matters for AI work in two sentences, get them into Slack and posting in ten
   minutes, and teach safe, useful use of a bring-your-own LLM without jargon.

Non-negotiables you inherit from The Labs (its "constitution"):
- The Poderator is a shepherd, not a manager: unblock, never grade. Faltering is
  process data, never a member record.
- OLOS runs no in-app LLM. Members bring their own AI assistant; the platform gives
  them prompts and a place to put results.
- Trust is earned, never default. No self-serve clout.
- The brand is "The Upskilling Labs" or "The Labs" — never "TUL". The role is
  "Poderator" in anything a member reads (the code says "moderator"; you never do).
- Voice: warm, concrete, dated, one next step; plain register; never "stay tuned".
- Problems are grounded in field evidence, not vibes: the method is frame innovation
  (observe → paradox → reframe → build small), taught first on a deliberately silly
  worked example, then applied dead-seriously to the cycle theme.
- Keep the gating: getting into Slack, GitHub, and an LLM early, as a precondition to
  continuing, worked in the room. Pre-work supplements it; it never replaces the
  in-room catch-up lane.

How you work in this session:
- Start by restating the audience, the cycle calendar, and the constraints back to me
  in one screen, then propose a module map before writing any module.
- For every module produce: outcome (one sentence, observable), audience, when in the
  journey it lands, pre-work, the unit plan (≤10-minute units), the video script
  outline (talking points + on-screen actions), the in-app checkpoint that proves it
  (what OLOS should record), the Slack ritual if any, the facilitator notes, and the
  "how you know it worked" signal.
- Write copy in the Labs voice; write facilitator notes in the shepherd register.
- Prefer templates people append to over documents people read once.
- When you need a decision I have not given you, ask once, propose a default, and
  continue with the default.
- Cite which document in the knowledge packet each design choice rests on.
- Output Markdown that can be committed to the OLOS repo under docs/curriculum/.
```

**Why this persona and not "an instructional designer".** The failure modes the
work-day retros recorded — mentors who could not plug in, participants who deferred
setup forever, hosts repeating the same explanation all day — are community and
behavior problems wearing a curriculum costume. A pure ID persona would produce a
course; this one produces an onboarding *system* the platform can carry.

---

## 2. The knowledge packet (attach these files to the session)

In this order; the first four are essential.

| File | Why the persona needs it |
|---|---|
| [`docs/roadmap/personas-and-journeys.md`](personas-and-journeys.md) | who the modules are for, per role, per stage |
| [`docs/roadmap/pre-registration-persona.md`](pre-registration-persona.md) | the readiness ladder the modules must map onto; the drip cadence |
| [`docs/work-day-improvements.md`](../work-day-improvements.md) | the lived retros: gating worked, mentors need briefings, silly example, pre-loading, stuck-points |
| [`docs/SENSEMAKING_FLOW.md`](../SENSEMAKING_FLOW.md) | the method (observe → extract → swipe → hypothesize → Paradox Sprint) and the BYO-LLM extraction loop |
| [`DESIGN_SYSTEM.md`](../../DESIGN_SYSTEM.md) §11 Voice & writing | the voice |
| [`docs/audit/DESIGN_INTENT.md`](../audit/DESIGN_INTENT.md) | the constitution rules and the journey register |
| [`docs/personas.md`](../personas.md) | the May originals (Upskiller, Organizer, Moderator) |
| [`docs/PRD-moderator-dashboard.md`](../PRD-moderator-dashboard.md) §10 decision "No in-product walkthrough" | poderator orientation is handbook + kickoff; tooltips cover UI only |
| [`docs/requirements/cycle-timeline.md`](../requirements/cycle-timeline.md) | the cycle calendar and its gates |
| [`docs/marketing-site/pages/upskiller.md`](../marketing-site/pages/upskiller.md), [`join.md`](../marketing-site/pages/join.md), [`volunteer.md`](../marketing-site/pages/volunteer.md) | existing public copy and FAQs to reuse |
| [`docs/feedback-running-list.md`](../feedback-running-list.md) | what confused real testers |
| `docs/vault/decisions/ADR-0003-slack-channel-provisioning.md` (PR #391) | Slack channel naming and the identity constraint (`#c03`, `#c03-<pod>`) |
| This file | the tool stack and the hand-off list |

---

## 3. The module map (a starting proposal for the session to improve)

Modules are role-tracked: **U** Upskiller, **P** Poderator, **M** Mentor, **L** Lab
lead, **V** Volunteer. Each is ≤ 30 minutes total, in ≤ 10-minute units, with a video
where a screen recording beats prose.

| # | Module | Tracks | Lands | Outcome (observable) | OLOS checkpoint |
|---|---|---|---|---|---|
| **M0** | Welcome & why: the mission, the cycle arc, your role's impact on the chapter | all | on account creation; drip T-8w | can say what a Build Cycle is, what they will build, and what their role changes | readiness step 9 (video) |
| **M1** | Slack: join, post your intro, find your lab's channel, etiquette, when to DM your Poderator | U P M V | T-4w | intro posted in `#intros`; knows `#c03-*` naming | step 4 (verified via identity) |
| **M2** | GitHub for AI work: *why* (provenance, collaboration, your portfolio), account, joining the org, your pod's repo, first issue and first edit through the web UI | U P M | T-3w | handle set; one issue or edit in a sandbox repo | step 5 (`github_username`) |
| **M3** | Your AI assistant: choosing one, safe use (no PII, no fabricated facts), the Labs prompt pack, the extraction loop (copy prompt → run → upload) | U P M | T-2w | ran the extraction prompt on a sample and uploaded the result | step 6 (self-attest) + a sandbox survey extraction |
| **M4** | OLOS in ten minutes: dashboard, tasks, Learning Log (the weekly minute), directory card, key dates | U P | T-2w and kickoff | filed a baseline log; directory card complete | steps 3, 8; `kind='baseline'` log |
| **M5** | The method: frame innovation on the office fridge, then the field survey and the problematizer | U P M | Sprint pre-work + in room | can state a paradox and one reframe for the silly example | in-room; problem statement submitted |
| **M6** | Working in a pod: roles (Poderator, DRI, contributor), rituals (weekly log, Meet the Pods), the pod `CONTEXT.md`, how to ask for help | U | pods form | pod context doc started; first append | pod repo has `CONTEXT.md`; log shared |
| **M7** | Build & ship: "make something bad, quickly", two feedback rounds, pitching, registering to a project | U | Hackathon | pitch submitted; feedback given to another pod | pitch row |
| **M8** | Showcase & after: presenting, graduating, contributing, mentoring, moderating next cycle | U | week 10–12 | write-up drafted from logs; alumni interest set | export; interest capture |
| **P1** | Poderator handbook: shepherd not manager; what a healthy pod looks like at week 2/4/8; the outreach tab and log; the copy-prompt bundle; hand-off | P | assignment | first outreach logged in week 1 | `outreach_log` |
| **M-1** | Mentor briefing template: the day's blocks, each block's outcome, known stuck-points, what not to do | M V | before each work day | briefing read; stuck-point assigned | briefing page view (S2.5) |
| **L1** | Lab lead quarterly: recruitment view, share link, alumni calls, internal cycle | L | appointment | first recruitment message sent | lab insights |

Sequencing for the first cohort that gets this: M0, M1, M2, M4, the theme primer,
and P1 are needed by the next kickoff; M3, M5 by the Sensemaking Sprint; M6–M8 during
the cycle. The session should size the videos: M0, M1, M2, M4 first.

---

## 4. The living context document

The organization asked for "initial context documents that they can continuously
append to throughout the initial problem-solving phase". Two documents, two owners:

**Per person — the Field Notebook.** Already exists: the Learning Log is the weekly
append (accomplished / exploring / next focus, plus the share). The curriculum's job is
to teach it as a notebook, not a compliance form, and Sprint 2's write-up export (S2.6)
is the payoff: "your project write-up is already half written."

**Per pod — `CONTEXT.md` in the pod's GitHub repo.** A template the pod copies on
day one and appends weekly (the Poderator prompts it at the weekly check-in):

```markdown
# Pod {name} — context

## The paradox (one paragraph; revise, don't replace — strike through old versions)
## Evidence (links to survey extracts, sources; one line each, dated)
## Who is affected / who has tried (stakeholders, actants, prior attempts)
## Our frame (how we now see it; date each revision)
## Decisions (dated, one line each — what we chose and why)
## Open questions
## Glossary (the words a newcomer needs)
## Log (one line per week: what changed in this document)
```

Why GitHub and not Drive: versioned, PR-able, linkable from the OLOS pod page
(`pods.github_repo_url` exists), and it *is* module M2's "why GitHub" made concrete.
The OLOS pod page links to it; the Meet-the-Pods deck (work-day #17) is derived from it.

---

## 5. The tool stack the curriculum should assume

Recommendations, each with the reason and what would reopen it. These are the
"initial technologies and tools" — Slack and GitHub are already in the schema; the rest
is a decision.

| Need | Adopt | Why | Reopen if |
|---|---|---|---|
| Conversation | **Slack**, one workspace (`theupskillinglabs`), channels `#intros`, `#help-{topic}`, `#c03` per cycle, `#c03-{pod}` per pod (ADR-0003 naming); bot for identity, reminders, later `/learninglog` (#189) | already the org's home; schema and email link assume it | a lab wants its own workspace (ADR-0003 §12 hedge) |
| Slack record-keeping | **don't** — free tier hides history > 90 days | Slack is where people talk, not the record | plan upgrade |
| Code and documents of record | **GitHub org**, one **template repo** per pod (`pod-template`: `README`, `CONTEXT.md`, issue templates, Discussions on), org-level Discussions for cross-pod help | versioned, linkable, teaches the skill the cycle is about; `github_repo_url` exists | pods that are not building software at all — still use the repo for `CONTEXT.md` |
| Zero-install coding | **GitHub Codespaces** optional in M7; not in onboarding | avoids local setup on day one | cost at scale |
| AI assistant | **BYO-LLM** (Claude, ChatGPT, Gemini) with the Labs prompt pack; Claude Code / Cursor introduced in M7 for builders | constitution (no in-app LLM); the extraction loop is designed for it | governance gate #11 lands; then Labs-hosted assist becomes possible |
| Video | **Loom** for screen-recorded modules (fast to re-record when the UI changes), published as unlisted **YouTube** for embedding in `/library` (`resources.content_type = recording`) | the UI changes weekly; re-recordability beats polish | a real LMS is adopted |
| Learning platform | **OLOS `/library` + `/learning`**, `resources` rows, saved items; checkpoints via the readiness ladder and `custom_tasks`; **no separate LMS** | one login, one place, the platform records completion; an LMS would fork identity and progress | quizzes/certificates are required by a partner |
| Live sessions | **Luma** (exists) for every event including virtual workshops; recordings back into `/library` | events already sync | — |
| Non-technical docs | **Google Drive** folder per pod (`drive_folder_id` exists) for slides and media; `CONTEXT.md` stays the index | people already have Drive | — |
| Email | **Resend** (exists) for drip and transactional; `email_log` for the record | — | — |
| Forms and surveys | **OLOS field survey** (`/survey/[slug]`), not Google Forms | the intake is built; provenance columns matter | — |
| Pod rituals | weekly 30-minute pod call (Meet/Zoom, the pod's choice) → one `CONTEXT.md` append → Learning Logs by Friday | the cadence the gate already enforces | — |

Explicitly **not** adopted now: Notion/Confluence (drift from the code and the repo;
framework §2), a separate community platform (Circle, Discord — splits the room),
an LMS (Thinkific, Teachable — forks progress and identity), Slack Canvas as the
context doc (unversioned, 90-day history).

---

## 6. What the session must hand back (so the sprint can wire it in)

| Deliverable | Format | Lands in |
|---|---|---|
| Module map, final | table as in §3 | `docs/curriculum/README.md` |
| One file per module: outcome, units, video script outline, checkpoint, facilitator notes, copy | Markdown | `docs/curriculum/M0-welcome.md` … |
| Readiness-ladder copy (9 steps × title, why, time, done-state) | table | `lib/tasks/definitions.ts` (engineer copies it in) |
| Drip messages (subject, body, CTA) for the offsets in `pre-registration-persona.md` §5 | table | `scheduled_messages` rows via the admin form (A3) |
| Theme primer template + the Summer 2026 example | Markdown | `resources` row (library) |
| `CONTEXT.md` template and the pod repo template's `README` | Markdown | the `pod-template` GitHub repo |
| Poderator handbook (P1) and the mentor briefing template (M-1) | Markdown | `docs/curriculum/`; the briefing page (S2.5) |
| Weekly "What's next" messages for weeks 0–4 | 5 short texts | `weekly_messages` via `/admin/weekly-messages` |
| A one-page "keep the gating" run-of-show for the kickoff room, with stuck-points and volunteer assignments | Markdown | `docs/curriculum/kickoff-runbook.md` |
| Open questions for the owner | list | vault `proposed` notes |

Each deliverable names the OLOS checkpoint that proves the module landed, so the
readiness ladder and the metrics dictionary can count it.

---

## 7. Success criteria for the curriculum (measured at the next kickoff)

- ≥ 70% of pre-registered members arrive with steps 1–5 of the ladder complete.
- The kickoff room's catch-up lane serves < 20% of attendees (down from "most").
- Every poderator has logged one outreach in week 1; every mentor at a work day has a
  briefing in hand.
- Every pod has a `CONTEXT.md` with ≥ 3 weekly appends by Meet the Pods.
- First Learning Log filed by ≥ 90% of active members in week 1 (the baseline exists to
  make this measurable).
