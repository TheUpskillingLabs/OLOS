# Plan: Luma-driven event pages

**Status:** phases 1 to 3 built and tested on dev, 2026-07-31. Phase 4 (deleting
the bespoke route) is written up but not done, and is gated on the Luma copy.
**Date:** 2026-07-31

> **Scope grew during testing.** Four things were added after seeing the real
> copy render, all recorded in the phases below: an on-page jump nav, an
> editorial treatment (lede / eyebrow headings / numbered cards) with tested
> thresholds, a Location section, and an editorial `sponsors` column. The
> "About this session" label was removed, and content-is-verbatim became an
> explicit tested invariant.
**Owner decision:** Luma is the single source of truth for event page copy. The
bespoke `/events/civics-elections-hackathon` route is retired, and the shared
`/events/[slug]` page is improved so Luma's markdown displays well.

This is the direction `lib/integrations/luma.ts` already declares in its header
comment ("Luma is the source of truth for ALL events, owner decision, July
2026"). Every non-anchor event page already works this way. The plan finishes
the job and makes the rendering good enough that the exception is no longer
needed.

**Why:** whoever runs an event edits it in Luma, a tool they already use, with a
WYSIWYG editor. No GitHub, no JSON, no HTML, no pull request. One source of
truth, so the class of bug behind the July 2026 anchor-date drift and the
current wrong-theme copy (below) stops being structurally possible.

---

## Alternatives considered and rejected

- **`content.json` beside the page** (built 2026-07-31, uncommitted, discarded).
  Worked, but kept the editor in a branch-and-pull-request flow and left the page
  as a second code path. Superseded by this plan.
- **Standalone HTML file in its own repo on GitHub Pages.** Cheap and removed all
  friction, but gave up member RSVP capture, Luma-driven facts, the site shell,
  and every safety net. Rejected.
- **A block system in `/admin/content`.** Still the strongest option *if* Luma
  ever proves too limited, because an author cannot produce something off-brand.
  Much larger, and unnecessary if Luma renders well. Keep in reserve.

---

## Blocking prerequisite

**The Luma copy for this event is wrong and must be corrected before the
switch-over in Phase 4.** As of 2026-07-31, https://luma.com/bgow5pki says the
event "builds on **climate and energy** challenges," is for people who "care
about **climate**," and describes a Pod as "focused on a specific
**environmental** challenge." The event is Civics and Elections. It is also
tagged `AI` and `Climate`.

The schedule there is stale too: no Iliana Estévez at 9:45, "led by TBD" at
10:50, and AJ Bubb's and Ashwin Jaiprakash's sessions carry their old titles. The
"Resources" bullets ("Details", "About the Pods") have no URLs.

The accurate copy is live in this repo right now, in
`app/(public)/events/civics-elections-hackathon/page.tsx` (`AUDIENCE`, `TRACKS`,
`SCHEDULE`, and the section headings). Use it as the source when correcting Luma.
Switching over before Luma is fixed would publish the climate and energy text.

---

## Current state, verified

| Fact | Where |
|---|---|
| `events.about` holds Luma's full About text, Luma-owned, overwritten every sync tick | `00094_event_about.sql`; `luma.ts:364-370` |
| The sync prefers `description_md` over plain text (landed 2026-07-31) | `luma.ts:340-356` |
| `about` renders **only when the editorial `body` is empty** | `events/[slug]/page.tsx:218` |
| `renderMarkdown` handles paragraphs, `- ` lists, `**bold**`, italics, `[t](url)`, bare `https://` URLs | `lib/content/markdown.tsx` |
| It does **not** handle `---`, headings, tables, relative links, or `mailto:` | same |
| `locationOf()` keeps **one** string: first of `name`, `place_name`, `full_address`, `address`, `city`. No coordinates, no place ID | `luma.ts:163-174` |
| `meeting_url` is in the API type but never stored, so virtual events show "Online" with no join link | `luma.ts:44` vs `lumaFields` at `:357` |
| Rendering is safe: React escaping throughout, no `dangerouslySetInnerHTML` | `markdown.tsx:8-9` |
| Sync runs every 6h, plus a manual button in `/admin/content` | `vercel.json`; `sync-events-button.tsx` |

**Stale comment to fix:** `events/[slug]/page.tsx:210-217` claims Luma's
"markdown emphasis and links are dropped rather than half-rendered." The code
contradicts it, `renderMarkdown` renders both. Left over from before the
2026-07-31 change.

**Claimed migration number: `00095`** (latest on `dev` is `00094`).

---

## Phase 1: make the markdown renderer good

No migration. Improves every event page immediately. Nothing regresses, because
today's output is a strict subset.

**File:** `lib/content/markdown.tsx`

1. **Strip invisible characters.** Luma injects U+200B at the start of most
   lines, and sometimes U+FEFF. Strip both before parsing.
2. **Horizontal rules.** A block of `---`, `***` or `___` alone becomes an
   `<hr className="ed-rule" />`. The current About text uses five of them and
   they render as literal `---` paragraphs today.
3. **Pseudo-headings.** Luma's editor has no heading levels, so authors use a
   bold-only line: `**This event is for you if:**`, `**Schedule:**`. A paragraph
   whose entire content is one bold run becomes an `<h3 className="t-h4">`. This
   single change does more for legibility than anything else here.
4. **Links, widened.** Keep `https?://` and bare URLs. Add root-relative
   (`/survey/civics`, via `next/link`), `mailto:`, and `www.`-without-scheme.
   Underline them so they match the site's `.see` style.
5. **Nested lists, one level.** Luma indents sub-bullets; today they flatten.

6. **Content is verbatim.** An explicit, tested invariant at the top of the
   file: whatever the author wrote in Luma appears character for character. No
   em-dash substitution, no smart quotes, no case or punctuation tidying. The
   house preference for avoiding em dashes governs copy *we* write and must
   never be applied to someone else's words. Invisible characters are the single
   exception, since they are not content.
7. **Jump nav.** `markdownToc()` returns the headings with unique slug ids; the
   page renders an "On this page" nav once there are three or more. This is the
   one length-based gate in the whole feature, justified because a two-item
   table of contents is noise. Everything else gates on content shape, so a page
   never silently restyles itself because someone added a paragraph.
8. **Editorial treatment** (owner request after seeing it render). Headings
   become ruled small-caps eyebrows, the opening paragraph becomes a lede, and a
   short parallel list under a heading becomes numbered `.lcard` cards.
   Presentation flags (`lede`, `cards`) are decided in `parseMarkdown` rather
   than the renderer **so the thresholds are unit-tested** — they are the risky
   part, since promoting prose to a designed layout means inferring design from
   structure. All of them fail safe to plain prose: cards need 2–4 unnested
   items under 120 chars sitting directly under a heading; lede needs a first
   paragraph of 280 chars or fewer (the same number `ledeOf()` uses).

**Known gap:** the two track lists in the hackathon copy follow a *bold-led
paragraph* rather than a heading, so they stay plain lists. The "two tracks"
moment was the strongest part of the retired page and is currently the plainest
part of the new one. Fixing it needs a "bold-led paragraph followed by a short
list, repeated" rule, which is the most speculative inference yet. Deliberately
not built; judge it on the real page first.

**Tests:** new `lib/content/markdown.test.ts`, 40 cases. The real About text
from this event is a fixture, since it exercises every case above.

**Size:** ~2h as scoped, ~5h as built.

## Phase 2: the schedule block

No migration. The judgment call in this plan.

Luma's About already contains a usable structure, so the renderer recognises the
pattern authors already write rather than asking them to learn syntax:

```
9:45
- Newcomer Track: About The Upskilling Labs and what to expect
- Pod Sprint Track: Frame and orient problem statements
```

**Rules:**

1. A short block that parses as a time (`9:00am`, `9:45`, `1:00 PM`), optionally
   followed by a dash and inline text, starts a schedule row. Handle both forms
   in the current copy: `9:00am — Light Breakfast` (time plus inline text) and a
   bare `9:45` followed by a list.
2. Consecutive rows collect into one schedule block, rendered as ruled rows with
   the time in `.lbl .lbl-teal` and entries beneath, matching the retired page's
   mobile presentation.
3. Where an entry starts with a `Label:` prefix (`Newcomer Track:`, `Pod Sprint
   Track:`, `All:`), split it and render the label as a tag.
4. **Fall back silently.** If the pattern is absent, render a heading and a list
   exactly as Phase 1 would. No author is ever penalised for not matching.

**Accepted limitation:** this is a time-ordered list with track tags, not a
two-column desktop table. The retired page already switched to precisely this
shape below tablet width, so this is "use the mobile presentation at every
width." If a real table is wanted later, add pipe-table support, but first
confirm Luma's editor can emit one.

**Tests:** both time forms, the track-prefix split, and the fallback.

**Size:** ~3h.

## Phase 3: location and maps

**Migration `00095`.** Applies to dev, then prod by hand after `dev → main`
(prod migrations are not automatic here).

1. **Migration:** add `events.location_address VARCHAR(500)` (the full postal
   address, for map links), `events.meeting_url VARCHAR(500)` (virtual join
   link), and `events.sponsors JSONB`. `location_name` keeps its current job as
   the short display name. Include a `-- DOWN:` block. Update `SCHEMA.md` in the
   same PR.

   `sponsors` rides along per the batch-at-write-time rule in
   `supabase/CLAUDE.md` — same table, same PR, same subject. Unlike the other
   two it is **editorial, never synced**: Luma renders sponsor logos on its own
   page but omits them from the events API. Shape `[{src, alt, bg?}]`, where
   `bg: "dark"` marks knockout art that would vanish on the warm paper. Each
   logo renders in a fixed 180×96 `.lcard` tile with `object-fit: contain`, which
   tidies mismatched aspect ratios and lets `next/image` use `fill` rather than
   intrinsic dimensions we cannot know. The flag is a human hint, not pixel
   sampling. **No `/admin/content` editor yet** — set by SQL; adding the field
   there is the natural follow-up.
2. **Sync** (`luma.ts`): `locationOf()` returns the display name *and* the full
   address rather than collapsing to one. Store `meeting_url`. Both are
   Luma-owned, so add them to `lumaFields` and document them in the file header's
   ownership list.
3. **Page** (`events/[slug]/page.tsx`): the "Where" value becomes a link to
   `https://www.google.com/maps/search/?api=1&query=<encoded address>`, which
   needs no API key and is what Luma's own page does. For virtual events, show
   the join link instead. Add an "Open in Maps" affordance to the facts rail.
4. **Queries:** add both columns to `EventRow` in `lib/content/queries.ts`.

**Deliberately out of scope:** an *embedded* map. That needs a Google Maps Embed
API key, which carries a cost and a third-party-content consent question. The
link covers the actual need.

**Size:** ~2h plus the migration.

## Phase 4: switch the hackathon over

Do this last, and only after Luma's copy is correct.

1. **Confirm the row's `body` is empty**, on dev and prod. `about` is suppressed
   whenever `body` is set (`page.tsx:218`), so a non-empty `body` silently wins.
   Ops SQL, not a migration.
2. **Delete** `app/(public)/events/civics-elections-hackathon/` entirely. That is
   the whole change: one directory holding one `page.tsx`, which stops shadowing
   `[slug]`. Copy `AUDIENCE`, `TRACKS` and `SCHEDULE` into Luma first, since this
   deletes the only accurate copy of them.
3. **Leave `next.config.ts:19-31` alone.** Both legacy redirects point *at*
   `/events/civics-elections-hackathon`, which `[slug]` will now serve. Verify,
   do not remove.
4. **Unaffected hardcodes**, confirmed: `lib/cycles/anchor-events.ts:54` and
   `lib/content/event-ics.test.ts:9` reference the slug, not the route, and the
   slug is unchanged.

**What the page gains:** an "Add to calendar" `.ics` link, which the bespoke page
never had.

**What changes:** the social-share text now comes from `generateMetadata`
(`events/[slug]/page.tsx:31-50`), built from the row's `name` and `description`,
rather than the hand-written `metadata` export in the bespoke `page.tsx`. Check
the result reads well; `description` is editorial and fill-only, so it can be
tuned in `/admin/content`.

**Size:** ~1h.

---

## Delivery: one PR

All four phases ship in a single PR, `feat/luma-driven-event-pages`, into `dev`.
`CONTRIBUTING.md` asks for one logical change per PR, and this qualifies: the
phases are one change ("Luma owns event copy") and the route deletion is only
safe once the renderer can carry the content.

Commit in this order so the diff reads in sequence:

1. `docs:` this document
2. `feat:` markdown renderer (Phase 1) + the stale-comment fix + tests
3. `feat:` schedule block (Phase 2) + tests
4. `feat(db):` migration `00095` + `SCHEMA.md` + `EventRow`
5. `feat:` sync stores full address and `meeting_url`; maps and join links (Phase 3)
6. `chore:` delete `app/(public)/events/civics-elections-hackathon/` (Phase 4)

### The one gate

**This PR cannot merge until Luma's copy is corrected.** Commit 6 deletes the
only accurate copy of `AUDIENCE`, `TRACKS` and `SCHEDULE`, and Luma currently
carries the wrong Build Cycle theme (see "Blocking prerequisite"). Order of
operations:

1. Correct the About text in Luma, using `page.tsx` as the source.
2. Run the manual sync in `/admin/content`.
3. Confirm the dev preview of `/events/civics-elections-hackathon` reads correctly.
4. Then merge.

If waiting on the Luma edit becomes a problem, split commit 6 into its own
follow-up PR. Commits 1 to 5 are purely additive, improve every event page, and
regress nothing while the bespoke route is still in place.

---

## Risks

| Risk | Mitigation |
|---|---|
| `about` is overwritten every tick, so no local fix is possible. Wrong copy in Luma means a wrong page | The editorial `body` field still overrides About completely. That is the escape hatch, and it is already built |
| Luma's markdown drifts, or an author writes something the renderer mishandles | Every rule falls back to plain paragraphs and lists. Nothing throws |
| Third-party text on a page where members are signed in | Already safe: React escaping, no `dangerouslySetInnerHTML`. Keep it that way |
| Up to 6h of staleness after a Luma edit | The manual sync button in `/admin/content` is the answer for urgent fixes |
| Losing the tracks, numbered cards, stat row and sponsor logo | Accepted. If they turn out to be missed, that is the trigger for the block system, not for another bespoke route |

## Test plan

- Unit: `lib/content/markdown.test.ts` with this event's real About text as a fixture.
- Dev: run the manual sync, then check `/events/civics-elections-hackathon`
  against the Luma page for parity of every section.
- Check the schedule at desktop and phone widths.
- Check member RSVP still writes an `event_rsvps` row and shows "You're going".
- Check the facts rail, the maps link, and the `.ics` download.
- Check the featured strip on `/events`, the homepage cards, and both related
  strips still reach the page.
- Check a virtual event renders its join link.
- Check an event with a non-empty `body` still suppresses About.

## Rollback

Phases 1 to 3 are additive and revert cleanly. Phase 4 is a route deletion, so
restoring it is a `git revert` plus, if `00095` shipped, leaving the columns in
place (harmless). Keep the branch until the event has passed.
