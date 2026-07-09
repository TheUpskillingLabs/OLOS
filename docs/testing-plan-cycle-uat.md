# Cycle UAT — group testing plan (5–12 testers)

A facilitator-led session that walks the **full cycle lifecycle** on the dev
environment: problem statements → voting → pod creation → pod registration →
solution proposals → solution voting → project creation → project
registration. One sitting, **60–90 minutes**.

Companion doc: [`dev-report-cycle-process.md`](./dev-report-cycle-process.md)
(what was fixed and why). Environment reference:
[`environments.md`](./environments.md).

---

## Roles

| Role | Count | Needs |
|---|---|---|
| **Facilitator** | 1 | Admin account **with the `testing:use` permission** (the phase-advance widget requires it, not just admin). Drives the phase-advance widget, the Finalize actions, and pod force-activation. |
| **Testers** | 4–11 | Google account each; signed in on the dev preview. |
| **Pod moderators** | 2 of the testers | Assigned by the facilitator mid-session (step 6) — validates the moderator experience. |

With fewer than 6 people, pad vote tallies with fake participants
(`--fake-participants`) — but pods/projects still need ≥3 real people to
exercise registration properly.

## Prerequisites (facilitator, ~15 min before the session)

1. **Environment**: everyone uses the **dev** deployment (Vercel preview off
   the `dev` branch) or `localhost:3000` against the dev Supabase — same data
   either way. **Never prod.**
2. **Accounts**: each tester signs in with Google. Anyone landing on
   `/register` completes it; then confirm every tester has a `participants`
   row (Admin → Participants).
3. **Seed the cycle**:
   ```bash
   npm run seed:test-cycle             # add: -- --fake-participants 3  (if <6 testers)
   ```
   Note the cycle id it prints. Config it seeds: `vote_threshold=3`,
   `max_pods=2`, `pod_min=3`, `project_vote_threshold=2`, `max_projects=2`,
   `project_min=2`, `project_max=5`.
4. **Enroll the testers** in the cycle (invitation with the cycle attached
   from `/admin/invitations`, or testers use the cycle's join flow once the
   registration window is set).
5. Open `/admin/cycles/<id>` and keep it up — the Dev tab's Testing controls,
   Finalize actions, and pods table all live here.
6. **Bug channel**: agree that all findings go through the in-app **feedback
   widget** (bottom of screen) so they land in the `feedback` table; note
   severity + phase in the text.

---

## Session script

Each step lists the actor, the action, and the **expected result** to check
off. Anything that doesn't match: file it via the feedback widget and move on.

### 1 · Problem statements (all testers) — ~10 min

Facilitator: Dev tab → **Start first phase** (opens Problem Statements).

- [ ] Every tester: cycle page shows the "Submit Problem Statements" CTA.
- [ ] Every tester submits one problem statement via `/cycles/<id>/propose`.
- [ ] **Key check (deadlock fix):** enrolled testers who have NOT joined any
      pod can submit. Before this branch they were blocked with "must be an
      active participant".
- [ ] Edge (1 tester): try submitting after the facilitator advances the
      phase (step 2) → clear "not currently open" error.

### 2 · Voting (all testers) — ~10 min

Facilitator: Dev tab → **Advance to Voting**.

- [ ] Every tester votes on `/cycles/<id>/vote`. Coordinate so tallies are
      engineered: pile votes on 2 statements (clearly ≥3 votes), give a third
      exactly 3 (threshold boundary), leave at least one below 3.
- [ ] Submitters see a bigger budget (5) than non-submitters (3).
- [ ] Edge (1 tester): try exceeding the vote budget → clear budget error.

### 3 · Pod creation (facilitator) — ~5 min

- [ ] **While Voting is still open**: click **Finalize pod voting** →
      expect a 409-style error ("Voting is still open…"). *(New phase gate.)*
- [ ] Dev tab → **Advance to Pod Registration**, then click
      **Finalize pod voting** → pods are created: only statements with ≥3
      votes, at most 2 pods (`max_pods`), ranked by votes. The
      exactly-at-threshold statement is eligible but capped out if it ranked
      third.
- [ ] Pod names are sensible (AI-generated; if the LLM call fails, a
      truncated statement text is used).
- [ ] Double-click / re-click **Finalize pod voting** → "already been
      finalized" error, no duplicate pods. *(Idempotency.)*

### 4 · Pod registration (all testers) — ~10 min

- [ ] Testers register via `/cycles/<id>/register-pods`. Coordinate: ≥3 into
      pod A, exactly 1–2 into pod B (keep it under `pod_min=3`).
- [ ] Pod A flips **forming → active** when the 3rd member joins; those
      members' enrollment status becomes active (Admin → cycle page →
      Participants).
- [ ] Pod B stays **forming**.
- [ ] Edge (1 tester): join two pods, then attempt a third → "already
      registered in 2 pods" error.
- [ ] Edge (1 tester): leave a pod and re-join it → works (soft-delete
      reactivation preserves the original join date).

### 5 · Force-activate the small pod (facilitator) — ~2 min

- [ ] On the admin cycle page, open pod B's **Manage** drawer — its forming
      status shows a **Force active** button → click it → pod B becomes
      active and its members' enrollments flip to active. *(Unblocks the
      under-`pod_min` cohort case.)*

### 6 · Moderators (facilitator) — ~3 min

- [ ] Assign 2 testers as moderators of pod A (pods table → Assign moderator).
- [ ] Those testers can open `/moderator` and see pod A.

### 7 · Solution proposals (pod members) — ~10 min

Facilitator: Dev tab → **Advance to Solution Proposals**.

- [ ] Each pod-A member submits a solution proposal on
      `/cycles/<id>/solutions`. Aim for ≥3 proposals in pod A.
- [ ] A tester who is in no pod sees the "not a member of any pods" state.

### 8 · Solution voting (pod members) — ~5 min

Facilitator: Dev tab → **Advance to Solution Voting**.

- [ ] Proposal submitters in pod A vote on `/cycles/<id>/solution-vote`.
      Engineer tallies again: 1 proposal clearly over threshold (≥2), 1
      exactly at 2, 1 below.
- [ ] A pod-A member who did NOT submit a proposal sees the "not eligible"
      panel. *(Submitters-only voting is intended.)*

### 9 · Project creation — ~5 min

Two triggers to validate; use both:

- [ ] **Per-pod button first (optional path):** after solution voting is
      closed — advance once — the facilitator can click **Finalize projects**
      in pod A's Manage drawer (Projects section). If instead you advance straight through, skip to the
      next check.
- [ ] **Auto on advance:** Dev tab → **Advance to Project
      Registration** → projects for every pod are finalized automatically.
      Check: only proposals meeting the threshold became projects, capped at
      `min(max_projects, floor(active_enrolled / project_min))`; each pod's
      Manage drawer shows the project count.
- [ ] The below-threshold proposal did **not** become a project.
- [ ] Re-triggering **Finalize projects** on a finalized pod (via the API or
      drawer before refresh) → "already been
      finalized" error.

### 10 · Project registration (all testers) — ~10 min

- [ ] Testers register on `/cycles/<id>/register-projects` — project
      registration is **cycle-wide**: a pod-B member can join a pod-A
      project.
- [ ] A project flips **forming → active** when its 2nd member joins
      (`project_min=2`).
- [ ] Edge (1 tester): register for a second project without withdrawing →
      "already registered in a project" error.
- [ ] Edge (same tester): withdraw, then register for a different project →
      works.
- [ ] Edge (if ≥6 in one project): the 6th registration into a full project
      (`project_max=5`) → "maximum registrant count" error.

### 11 · Wrap-up (facilitator) — ~5 min

- [ ] the Dev tab's Testing controls show all six phases completed after a final advance.
- [ ] Triage the feedback: Admin → feedback table (or `/api/feedback` data).
      Log each item in the table below.
- [ ] Tear down:
      ```bash
      npm run seed:test-cycle -- --cleanup <cycle_id>
      ```

---

## Findings triage

| # | Phase / step | Severity (blocker · major · minor · polish) | Reporter | Description | Owner |
|---|---|---|---|---|---|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |

## Notes for the facilitator

- The Dev-tab Testing controls opens each phase with a 24h auto-close; you never
  need to wait — **Advance** closes the current phase immediately.
- Advancing does NOT create pods — that's the deliberate manual **Finalize
  pod voting** click. Advancing INTO Project Registration DOES auto-create
  projects (per-pod outcomes in the API response; failures don't block).
- If a step 403s with "not currently open", check the Schedule section — a
  phase may have auto-closed (24h) if the session paused overnight.
- Everything here also runs headlessly: `npm run verify:cycle` covers this
  entire flow at the data layer in ~30s and must pass before a UAT session
  is scheduled — don't spend 12 people's hour on a regression a script
  catches.
