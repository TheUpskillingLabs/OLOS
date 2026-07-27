# `app/components/tasks/` — the task surfaces

The shared rendering layer of the central task system. Data comes from
`lib/tasks/` (the `Task` type + `assembleTasks`/`dashboardTasks`); window
metadata from `lib/cycles/windows.ts`. Read this before adding any
task-shaped UI anywhere — new task renderings belong here, not inline in a
page.

Before writing code to push a one-off ask onto members' dashboards, check
whether `/admin/tasks` covers it: admins author `custom_tasks` rows (00093)
that the assembler merges into the queue as kind `custom` — title, link,
optional cycle scope, visibility window/deadline, pinned + dismissible
flags. The same page previews any member's live queue (`?preview=email`,
`lib/tasks/preview.ts`).

## The one rule a member learns

- **Dashboard = my queue.** `TaskList` ("Up next") — actionable, personal,
  dismissible where appropriate.
- **Cycle page = the cycle's state.** `TaskRow` ("Open now") — never
  dismissible; dismissing a card on your dashboard doesn't erase the fact
  that a window is open.
- **The rail = the calendar.** `cycle-phase-indicator` is timeline-only; its
  single "Up next: … opens {date}" chip is temporal context, not a task.

A fact appears **once per page**. The owner precedent: "three surfaces for
one action read as clutter" (2026-07-14).

## Consistency contract

1. **Dates** render only via `lib/cycles/lab-time` — `fmtLabDateTime` when
   the time matters (deadlines, reopen instants), `fmtLabDate` for date-only
   window bounds, `fmtDateOnly` for DATE columns (cycle start/end). No
   `toLocaleDateString` on member cycle surfaces. Components format;
   callers pass raw stored strings.
2. **Naming:** the queue is **"Up next"**; the checklist is **"Get set up"**
   (collapsed: "Setup"); cycle-page window sections are **"Open now"**.
   Retired: "On your plate", "What's next" (as a heading), "To Do list".
3. **Window labels** come from `CYCLE_WINDOWS` — `labels.action` verbatim on
   both the dashboard card and the cycle-page row; `labels.short` in
   timeline contexts. Never write a window label inline.
4. **Dismissal:** dismissible = time-boxed suggestions (open windows, the
   share/what's-next nudges). Never dismissible = the weekly-log gate,
   register, checklist rows. Auto-expiry is key rotation
   (`lib/tasks/keys.ts`), never timers. One affordance: the 44px top-right
   X — its absence IS the pinned signal. All persistence in
   `task_dismissals` (POST `/api/tasks/dismiss`); localStorage holds only
   cosmetic view prefs (checklist collapse).
5. **Tone from kind**, never per-callsite: red = the blocking gate only;
   teal border = start-here/feature; plain white elsewhere.
   **Deadline proximity** is the one sanctioned escalation, and only on the
   deadline/timing TEXT (never the card/row shell): within 3 days it goes
   teal-deep semibold with a relative "N days left" suffix; within 24 h it
   goes red and (on rows) shows the closing time. One derivation —
   `lib/tasks/urgency.ts` — used by both TaskCard and TaskRow; never
   hand-roll a countdown. The relative suffix accompanies the absolute
   lab-time instant, never replaces it.
6. **One tree, two layouts.** `TaskList` is the same DOM on phones (snap
   strip) and desktop (2-col grid) — never fork a separate mobile task
   list; that's the drift this system replaced.
7. **Hash anchors stay plain `<a>`** (`#learning-log`, `#leadership-log`):
   Next `<Link>` soft-navs never fire `hashchange`, and the feed composer
   opens its Learning Log tab on it.
