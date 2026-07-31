# Hackathon "About Event" copy, for Luma

The Aug 15 2026 event: <https://luma.com/bgow5pki>.

This file exists because `app/(public)/events/civics-elections-hackathon/page.tsx`
was deleted (Phase 4 of `docs/proposals/luma-driven-event-pages.md`) and that file
held the only copy of the audience cards, the two track descriptions and the
eleven-row schedule. **Luma is now the source of truth.** This is a paste-source
and a record of what was migrated, not a second master: editing this file changes
nothing on the site, and the next sync overwrites `events.about` from Luma
regardless of what is written here.

Everything between the rules below goes in Luma's **About Event** field.

## How it renders

`lib/content/markdown.tsx` infers the layout from the structure, so the shape
below is load-bearing:

- A bold-only line becomes a ruled small-caps heading (Luma's editor has no
  heading levels, so bold-as-heading is the convention it can express).
- A 2 to 4 item list directly under a heading, each item under 120 characters,
  becomes the numbered card row. Longer items stay a bulleted list.
- Two "**Label**: prose" paragraphs each followed by a short list become the
  side-by-side track panels. Keep the colon OUTSIDE the bold, or it ends up in
  the panel heading.
- A run of time rows becomes the schedule. Rows tagged `Pod Sprint Track:` and
  `Newcomer Track:` pivot into a two-column table on desktop and stack into cards
  on a phone; an untagged row (breakfast, lunch) spans both columns.
- Blank lines between blocks matter. Keep them.

Every one of those rules fails safe to plain prose, so a mistake here reads
plainly rather than breaking.

## What Luma cannot carry

The numeral row and the sponsor logo are editorial columns on the `events` row
(migration `00095`), not Luma fields. Set them with SQL — see
`scripts/ops/hackathon-editorial-fields.sql`.

Facts (date, time, venue, host, cost, register URL) come from Luma automatically.
Do not write them into About as well; they would then exist in two places and
drift, which is the bug this whole change removes.

---

Turn an idea into a working prototype in one day, with real teammates, real tools, and a real plan to test what you build. No AI experience required.

The event builds on civics and elections challenges inspired by The Upskilling Labs' Build Cycle, a thematic twelve-week program where participants work on real-world problems and build practical solutions. No previous involvement or AI experience needed.

Note: this is a non-partisan, non-political event.

**This event is for you if:**

- You are curious about AI but have not gotten hands-on with it yet
- You care about civic engagement and want to do more than read about it
- You want to meet builders, organizers and researchers changing the status quo

**Choose your track:**

**Newcomer Track**: A beginner-friendly morning where you learn how to turn an idea into something you can actually show someone. In the afternoon you get a look inside what the Pods are building.

- See a real project up close and ask every question you have been holding
- Learn by doing, and leave with something you actually built
- No prior experience needed; your outside perspective is genuinely useful here

**Pod Sprint Track**: For Upskillers in the Civics & Elections Build Cycle. Join a Pod, a small research team focused on a specific civics or elections challenge, for a structured full-day problem-solving sprint.

- Share your perspective on the problem with your Pod
- Help identify promising directions, then choose one to explore
- Build a simple prototype and a plan to test it with a real user

**Schedule:**

9:00 AM — Light breakfast

9:30 AM — Welcome from American University hosts

9:45 AM

- Newcomer Track: About The Upskilling Labs and what to expect
- Pod Sprint Track: Frame and orient problem statements with [Iliana Estévez](https://www.linkedin.com/in/ilianaestevez/)

10:00 AM

- Newcomer Track: Workshop on design thinking with [Emily Modde](https://www.linkedin.com/in/emily-modde/)
- Pod Sprint Track: Lightning talks, "How Might We" statements

10:50 AM

- Newcomer Track: Workshop on tool set-up and wayfinding
- Pod Sprint Track: Build prototypes

11:20 AM

- Newcomer Track: Pod briefing
- Pod Sprint Track: Build prototypes

11:50 AM — Lunch

1:00 PM

- Newcomer Track: From Prompt to Prototype, building your professional website with [AJ Bubb](https://www.linkedin.com/in/ajbubb/) and Lovable.dev
- Pod Sprint Track: Build prototypes

2:30 PM

- Newcomer Track: Working Backwards from the Outcome, a prompting workshop with [Ashwin Jaiprakash](https://www.linkedin.com/in/ashwin-jaiprakash-67366b24/)
- Pod Sprint Track: Build prototypes

3:30 PM — Pod member prototype presentations

4:30 PM — Depart for happy hour

**By 4:30 PM:**

Everyone leaves with a working prototype and a plan to test it in the real world.

---

## Changes from the bespoke page, and why

The words are the bespoke page's, lightly adapted where the old layout carried
meaning that prose has to carry instead:

- The audience cards had a label, a headline and a paragraph each. Cards in the
  renderer hold one line, so each became a single sentence under 120 characters.
  The three labels ("Curious about AI", "Care about civics", "Want community")
  are gone; the sentences say the same thing.
- Track names became `Newcomer Track` / `Pod Sprint Track` exactly, because the
  schedule tags have to match the panel headings for the table to pivot.
- Schedule workshop titles lost their colons ("Workshop: design thinking" →
  "Workshop on design thinking"). The entry parser splits on the first colon to
  find the track tag, and a second colon in the text reads fine but a title
  starting with one does not.
- "Come with an open and curious mind" and the closing "Build something real"
  headline were section furniture on a hand-built page. The closing line about
  4:30 PM was worth keeping, so it stayed as a short closing section.
