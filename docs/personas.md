# OLOS Personas

*Working definitions of the four people OLOS is built for. Draft, 2026-05-20; Labs Lead added 2026-07-11.*

The four personas below define who OLOS is for. They're meant to be used as a quick gut-check when making product, copy, and program decisions: would this make sense to an upskiller? Would it actually save an organizer time? Would it let a labs lead run their own city without pinging HQ? Would it give a moderator the signal they need?

---

## Upskiller

### Who they are

A participant in a Build Cycle. Largely a non-technical federal or fed-adjacent worker, looking to build real AI fluency by shipping something rather than sitting through another course.

- **Typical background:** civil servant at an agency, federal contractor, policy-shop or think-tank staffer, mission-driven NGO worker.
- **Employment status:** may or may not currently be working. Some are mid-career and carving out evenings, some are between roles, some are using cycle time as a deliberate reskilling window.
- **Technical depth:** has used AI tools as a consumer, but typically hasn't shipped with them on a team before. Many haven't worked alongside engineers in a building context at all.

### What they want

- A structured 13-week container they don't have to invent themselves, with a clear path from "I've played with ChatGPT" to "I've shipped something useful with a team I trust."
- Pods that are forgiving of varying time availability and varying technical depth.
- More technical pod-mates they can learn from, without feeling like the slowest person in the room.
- Concrete output to point at: a working thing, a team they can name, a problem they helped solve.

### What frustrates them

- Jargon-heavy onboarding that assumes an engineering background.
- Being the only non-technical person in a pod and quietly falling behind.
- Forms that ask the same question twice.
- Voting and never seeing whether their vote mattered.
- Showing up to a pod where they don't know who's in it or what's expected of them this week.
- Pulse-check fatigue if the form takes more than a minute.

### How they disengage

Silently. They will not flag that they're lost; they will just stop showing up. The pulse check exists in large part to catch this before it happens.

### What success looks like

Finishing the cycle and showcasing what they've built, alongside the group of people they built it with.

---

## Organizer

### Who they are

TUL HQ staff running the cycle. A small team measured in handfuls, not departments.

- **Hats worn:** program design, community management, ops, data, comms (often all in the same week, sometimes the same day).
- **Scope:** the whole program. In permission terms, the organizer is the global admin — they hold `cycles:write` and can configure any cycle in any lab. Metro-scoped delegation is the Labs Lead's job (below).
- **Current reality:** a large slice of every week goes to cross-sheet reconciliation in the legacy Upskiller community-manager spreadsheet: chasing pulse checks, deduping pod registrations, hand-tallying votes, reconciling typos between strings like "Pod 9" and "9. Medical Record Consolidation."

### What they want

- Their week back. Time spent talking to upskillers, refining the program, and unblocking pods, instead of maintaining VLOOKUPs.
- A single source of truth for cycle state.
- The ability to answer "which pods are at risk right now?" without opening a spreadsheet.
- Visibility into who's about to ghost, while there's still time to do something about it.

### What frustrates them

- Bespoke one-off lookup requests ("can you check if so-and-so registered yet?").
- Form data landing in the wrong column.
- Discovering on Friday that a pod has been quietly under-registered all week.
- The entire string-vs-ID class of bug, where the same thing has three different names across three different sheets.

### What success looks like

Running the next cycle with today's headcount while doing meaningfully less coordination work and engaging with more upskillers, particularly the quiet ones who are about to ghost.

---

## Labs Lead

### Who they are

The person running a Local Lab — a metro-level chapter of the program. Washington, DC is the active lab today; Baltimore and Philadelphia are next in line as waitlisted metros (`lib/metros.ts`). Part organizer, part community builder, but scoped to one city rather than the whole program.

- **Relationship to HQ:** not HQ staff. They run their lab inside the container HQ coordinates — shared cycles, shared tooling, shared program design.
- **Hats worn:** a metro-sized slice of the organizer's week: recruiting, pod formation, moderator wrangling, local partnerships, showing up in person.

### What they want

- To run their lab's day-to-day without waiting on HQ: form and finalize pods, manage projects, watch pulse health — for their own city.
- To participate in the shared HQ cycle calendar without being able to break it (or being blamed when someone else does).
- To spin up their own lab's cycle when their city is ready, and own its schedule and configuration end to end.
- Visibility into their own lab's people — and a clean line around everyone else's.

### What frustrates them

- Another lab's pods showing up in their lists — or worse, being editable.
- Needing an HQ admin to click a button that only affects their own city.
- HQ-internal org cycles leaking into their view.
- Being treated as either a full admin (too much) or a moderator (too little) when their actual scope is "everything, for one metro."

### What success looks like

Their lab's cohort makes it through the shared cycle with healthy pods, and the lab graduates to running cycles on its own calendar.

### Where they sit in the system

Between the organizer and the moderator: broader than one pod, narrower than the program. In permission terms they hold the `labs_lead` preset — `pods:read`, `pods:write`, `participants:read`, `pulse_checks:read` — deliberately **not** `cycles:write`, which is exactly what separates them from an organizer (HQ staff with global `cycles:write`). Their metro (`participants.metro_slug`) scopes everything, enforced by `lib/auth/cycle-access.ts`:

- They **see** HQ-open cycles plus their own lab's cycles — never another lab's cycles, never HQ-internal org cycles.
- Inside a shared HQ cycle they **manage** only the pods and projects tagged with their own metro.
- They **create and configure** their own lab's cycles end to end.

---

## Moderator

### Who they are

A community member who volunteers to shepherd one pod through one cycle. A guide and a connector, not an answer key.

- **Ideal profile:** a returning upskiller from a prior cycle who's been through the experience as a participant first and is ready to help the next group through it.
- **Also common:** moderators who come in fresh, drawn to the program and the role itself rather than having lived the participant experience.
- **What they are not:** staff, and not the subject-matter expert on whatever the pod is tackling.

### What they want

- A pod that doesn't lose momentum and members who don't disappear quietly.
- Early signal: knowing on a Tuesday that someone hasn't checked in, not on a Friday when the pod has already started to fracture.
- Clear visibility into what their pod is supposed to be doing in the current phase, what's coming next, and what's been asked of their members in the most recent pulse.
- A way to point a stuck upskiller toward the right resource (another pod that's solved a similar problem, a relevant tool, a staff member who can help) without digging through three Slack threads and a shared drive.
- For first-time moderators specifically: a quick way to get oriented to "what a healthy pod looks like at this point in the cycle," since they don't have the lived calibration a returning upskiller does.
- To feel useful without feeling like the bottleneck.

### What frustrates them

- Being asked questions they don't have the answer to, and feeling like they're supposed to.
- The pressure of being the "lead" when their actual role is closer to "guide."
- Information about their own pod living in five places, none of which are the one they're looking in.
- Realizing too late that an upskiller in their pod has been silently struggling for weeks.
- Pod members assuming the moderator role is more authoritative than it is and waiting for permission instead of just trying things.

### What success looks like

Their pod makes it to project showcase with members still energized, the moderator themselves grows into the role over the cycle, and at least one of their pod members raises their hand to moderate next cycle.

### Where they sit in the system

Between the upskiller and the organizer. A pod-member-eye view of what the experience feels like (especially if they're a returning upskiller), plus a pod-scoped slice of the visibility organizers need. This is why role-stacking is built in: a moderator who's also participating in their own project sees both views at once.
