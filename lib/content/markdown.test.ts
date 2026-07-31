import { describe, it, expect } from "vitest";
import { parseMarkdown, markdownToc, scheduleColumns } from "./markdown";
import type { MdBlock, MdSlot } from "./markdown";

/* Tests target parseMarkdown, the pure half of the renderer. The vitest
   environment is `node` with no DOM, so there is nothing to assert markup
   against; the parse tree is the contract and the JSX mapping over it is
   mechanical. */

/** U+200B. Luma prefixes almost every line of its markdown export with one.
    Written as an escape so it is visible to whoever reads this file next. */
const ZW = "\u200B";

/* Verbatim shape of Luma's "About Event" field for the Aug 2026 hackathon
   (https://luma.com/bgow5pki), read 2026-07-31: zero-width prefixes, bold
   lines standing in for headings, "---" dividers, and loose lists.

   The words are deliberately preserved even though the copy is wrong — it says
   climate and energy for a civics and elections event, tracked separately as a
   content bug. What this fixture pins down is the *shape* Luma emits. */
const LUMA_ABOUT = [
  `${ZW}Interested in using AI to solve a real world/life problem? Come find out.`,
  `${ZW}This Hackathon is a fast-paced, one-day event where you'll go from idea to working prototype — with real teammates, real tools, and a real plan to test what you build.`,
  `${ZW}**This event is for you if:**`,
  `- ${ZW}You're curious about AI but haven't gotten hands-on with it yet`,
  `- ${ZW}You care about climate and want to do something beyond reading about it`,
  `---`,
  `${ZW}**Schedule:**`,
  `${ZW}9:00am — Light Breakfast`,
  `${ZW}9:30`,
  `- ${ZW}Welcome (AU Hosts)`,
  `${ZW}9:45`,
  `- ${ZW}Newcomer Track: About The Upskilling Labs and what to expect`,
  `- ${ZW}Pod Sprint Track: Frame and orient problem statements`,
  `${ZW}10:00`,
  `- ${ZW}Newcomer Track: Workshop — Design Thinking with Emily Modde`,
  `- ${ZW}Pod Sprint Track: Lightning Talks, How Might We statements`,
  `${ZW}10:50`,
  `- ${ZW}Newcomer Track: Workshop — Download Github, tool wayfinding`,
  `${ZW}11:20`,
  `- ${ZW}Newcomer Track: Pod Briefing`,
  `${ZW}11:50 — All: Lunch`,
  `${ZW}1:00`,
  `- ${ZW}Newcomer Track: Workshop — Vibe Coding with AJ Bubb`,
  `${ZW}2:30`,
  `- ${ZW}Newcomer Track: Workshop — Prompt Engineering with Ashwin Jaiprakash`,
  `${ZW}3:30 — All: Pod member prototype presentations`,
  `${ZW}4:30 — All: Depart for Happy Hour`,
  `---`,
  `${ZW}**About The Upskilling Labs:** An open, project-based learning community. [theupskillinglabs.org](https://theupskillinglabs.org/?utm_source=luma)`,
].join("\n\n");

/* The other end of the range: a real short workshop's About text, taken from
   /events/introduction-to-github-for-team-projects-vfudkb. Most events look like
   this, not like the hackathon, and the renderer has to leave them alone —
   every editorial flourish must stay dormant here (owner constraint,
   2026-07-31: "if we are using this for all events, for the short ones this
   should work"). */
const SHORT_ABOUT = [
  `${ZW}**About the Workshop** This session is a hands-on introduction to GitHub for people who work on community projects. You don't need any coding experience. We'll cover what GitHub actually is (and isn't), how to create a repository, and how to invite collaborators.`,
  `${ZW}**About the Instructor**`,
  `${ZW}Aaron McKeever is a recent graduate of Columbia University, where he studied information science and specialized in computational linguistics. At Columbia, he worked as a research assistant and project lead across multiple teams.`,
].join("\n\n");

/* The two-track section of the corrected hackathon copy, in Luma's shape. */
const LUMA_ABOUT_TRACKS = [
  `${ZW}**If you are a Newcomer:** join a beginner-friendly morning track where you'll learn how to turn an idea into something you can show someone.`,
  `- ${ZW}See a real project up close and ask every question you've been holding`,
  `- ${ZW}Learn by doing, so you leave with something you actually built`,
  `${ZW}**If you are an Upskiller in the Civics & Elections Build Cycle,** join a Pod for a structured full-day problem-solving sprint.`,
  `- ${ZW}Share your perspective on the problem with your Pod`,
  `- ${ZW}Build a simple prototype and a plan to test it with a real user`,
].join("\n\n");

function kinds(blocks: MdBlock[]): string[] {
  return blocks.map((b) => b.kind);
}

function firstSchedule(blocks: MdBlock[]): MdSlot[] {
  const s = blocks.find((b) => b.kind === "schedule");
  if (!s || s.kind !== "schedule") throw new Error("no schedule block parsed");
  return s.slots;
}

describe("parseMarkdown — Luma accommodations", () => {
  it("strips the zero-width spaces Luma prefixes lines with", () => {
    expect(parseMarkdown(`${ZW}Hello there`)).toEqual([
      { kind: "para", text: "Hello there", lede: true },
    ]);
  });

  it("treats a bold-only line as a heading, with or without a trailing colon", () => {
    expect(parseMarkdown("**Schedule:**")).toEqual([
      { kind: "heading", text: "Schedule:", id: "schedule" },
    ]);
    expect(parseMarkdown("**Two tracks**")).toEqual([
      { kind: "heading", text: "Two tracks", id: "two-tracks" },
    ]);
  });

  it("does not treat a partially bold line as a heading", () => {
    expect(kinds(parseMarkdown("**Note:** bring a laptop"))).toEqual(["para"]);
  });

  /* Authors bold a whole sentence for emphasis just as readily as a label, and
     only the short ones are behaving like headings. A 100-character sentence set
     in heading type looks like a mistake. */
  it("leaves a long bolded sentence as a paragraph", () => {
    const long =
      "**By the end of the day, everyone leaves with a working prototype and a plan to test it in the real world.**";
    expect(kinds(parseMarkdown(long))).toEqual(["para"]);
  });

  it("still promotes a short bolded label", () => {
    expect(kinds(parseMarkdown("**Come with an open mind. Choose your track:**"))).toEqual([
      "heading",
    ]);
  });

  it("recognises horizontal rules", () => {
    expect(kinds(parseMarkdown("a\n\n---\n\nb"))).toEqual([
      "para",
      "rule",
      "para",
    ]);
    // A rule opening the document is dropped (see the "double rules" block),
    // so these need something above them to divide from.
    expect(kinds(parseMarkdown("a\n\n***\n\nb"))).toEqual([
      "para",
      "rule",
      "para",
    ]);
    expect(kinds(parseMarkdown("a\n\n___\n\nb"))).toEqual([
      "para",
      "rule",
      "para",
    ]);
  });
});

describe("markdownToc — jump links", () => {
  it("lists the headings with their anchor ids", () => {
    expect(markdownToc("**Schedule:**\n\nsome text\n\n**The tracks**")).toEqual([
      { id: "schedule", text: "Schedule:" },
      { id: "the-tracks", text: "The tracks" },
    ]);
  });

  it("suffixes duplicate headings so every link points somewhere real", () => {
    expect(markdownToc("**Notes**\n\na\n\n**Notes**\n\nb").map((h) => h.id)).toEqual([
      "notes",
      "notes-2",
    ]);
  });

  it("is empty when the copy has no headings", () => {
    expect(markdownToc("just a paragraph")).toEqual([]);
  });
});

describe("content is rendered verbatim", () => {
  /* Owner rule 2026-07-31: whatever the author wrote in Luma appears on the
     page character for character. The house preference for avoiding em dashes
     governs copy WE write, and must never be applied to someone else's words. */
  it("preserves em dashes, en dashes and smart quotes untouched", () => {
    const text = "Go — really go – to “the thing” … it’s worth it";
    expect(parseMarkdown(text)).toEqual([{ kind: "para", text, lede: true }]);
  });

  it("does not alter spacing or casing", () => {
    const text = "ALL CAPS SHOUTING and    odd spacing";
    expect(parseMarkdown(text)).toEqual([{ kind: "para", text, lede: true }]);
  });
});

describe("parseMarkdown — lists", () => {
  it("collects bullets into one list", () => {
    expect(parseMarkdown("- one\n- two")).toEqual([
      {
        kind: "list",
        cards: false,
        items: [
          { text: "one", children: [] },
          { text: "two", children: [] },
        ],
      },
    ]);
  });

  it("stitches a loose list (blank lines between bullets) back together", () => {
    const blocks = parseMarkdown("- one\n\n- two\n\n- three");
    expect(kinds(blocks)).toEqual(["list"]);
    expect(blocks[0].kind === "list" && blocks[0].items).toHaveLength(3);
  });

  it("nests indented bullets under the item above", () => {
    expect(parseMarkdown("- parent\n  - child\n- sibling")).toEqual([
      {
        kind: "list",
        cards: false,
        items: [
          { text: "parent", children: ["child"] },
          { text: "sibling", children: [] },
        ],
      },
    ]);
  });
});

describe("plain 'Label:' lines as headings", () => {
  /* Not every author reaches for bold. This copy is verbatim from the Aug 25
     workshop, which uses bare colon-terminated lines throughout. */
  it("promotes a bare label line that has a block under it", () => {
    expect(kinds(parseMarkdown("What to bring:\n\n- A laptop\n- A charger"))).toEqual([
      "heading",
      "list",
    ]);
  });

  it("leaves a sentence that merely ends in a colon alone", () => {
    const prose =
      "We looked at the options and reached the following conclusion:\n\nIt works.";
    // Contains a sentence-ending period, so it is prose, not a label.
    expect(kinds(parseMarkdown("Something happened. Then this:\n\nmore"))).toEqual([
      "para",
      "para",
    ]);
    expect(kinds(parseMarkdown(prose))).toEqual(["heading", "para"]);
  });

  it("leaves a dangling label at the end of the copy as a paragraph", () => {
    expect(kinds(parseMarkdown("Intro text.\n\nBio:"))).toEqual(["para", "para"]);
  });

  it("leaves a long line alone even with a trailing colon", () => {
    expect(kinds(parseMarkdown(`${"z".repeat(81)}:\n\nmore`))).toEqual([
      "para",
      "para",
    ]);
  });
});

describe("length thresholds measure visible text, not markdown", () => {
  /* A link's URL is syntax. Letting it count toward a length limit means the
     layout changes because someone used a long tracking parameter. */
  it("cards a list whose items are short once links are resolved", () => {
    const md =
      "What to bring:\n\n" +
      "- A [laptop](https://example.com/a/very/long/path?utm_source=luma&utm_campaign=x)\n" +
      "- A [charger](https://example.com/another/extremely/long/url?utm_source=luma)";
    const list = parseMarkdown(md).find((b) => b.kind === "list");
    expect(list?.kind === "list" && list.cards).toBe(true);
  });
});

describe("short events stay plain", () => {
  /* Most events are a workshop with two paragraphs and a bio. If any of the
     editorial machinery fires here, it fires wrongly. */
  const blocks = parseMarkdown(SHORT_ABOUT);

  it("produces only paragraphs and one heading", () => {
    expect(kinds(blocks)).toEqual(["para", "heading", "para"]);
  });

  it("promotes nothing to cards, panels or a schedule", () => {
    expect(blocks.some((b) => b.kind === "panels")).toBe(false);
    expect(blocks.some((b) => b.kind === "schedule")).toBe(false);
    expect(blocks.some((b) => b.kind === "list" && b.cards)).toBe(false);
  });

  it("does not show a jump nav — one heading is not a table of contents", () => {
    expect(markdownToc(SHORT_ABOUT).length).toBeLessThan(3);
  });

  /* The lede is the one treatment that suits short copy: it gives a two-
     paragraph page a proper opening instead of starting flat. Everything more
     elaborate stays dormant, per the assertions above. */
  it("still gives the opening paragraph a lede, which short copy needs most", () => {
    expect(blocks[0].kind === "para" && blocks[0].lede).toBe(true);
  });

  it("keeps a bold lead-in inline rather than making it a panel", () => {
    expect(blocks[0].kind === "para" && blocks[0].text).toContain(
      "**About the Workshop**"
    );
  });
});

describe("panels — parallel options side by side", () => {
  const pair = [
    "**If you are a Newcomer:** join the beginner-friendly morning track.",
    "- See a real project up close\n- Learn by doing",
    "**If you are an Upskiller:** join a Pod for a full-day sprint.",
    "- Share your perspective\n- Build a prototype",
  ].join("\n\n");

  it("pairs each bold-led paragraph with the list under it", () => {
    const blocks = parseMarkdown(pair);
    expect(kinds(blocks)).toEqual(["panels"]);
    const panels = blocks[0].kind === "panels" ? blocks[0].items : [];
    expect(panels).toHaveLength(2);
    expect(panels[0].heading).toBe("If you are a Newcomer:");
    expect(panels[0].points).toEqual([
      "See a real project up close",
      "Learn by doing",
    ]);
    expect(panels[1].heading).toBe("If you are an Upskiller:");
  });

  it("needs the pattern to repeat — one pair stays a paragraph and a list", () => {
    const single =
      "**If you are a Newcomer:** join the morning track.\n\n- See a project\n- Learn by doing";
    expect(kinds(parseMarkdown(single))).toEqual(["para", "list"]);
  });

  it("leaves a bold-led paragraph with no list alone", () => {
    expect(kinds(parseMarkdown("**Note:** bring a laptop\n\n**Also:** and a charger"))).toEqual(
      ["para", "para"]
    );
  });

  it("refuses a panel whose prose is too long for a card", () => {
    const wordy = [
      `**Track one:** ${"x".repeat(401)}`,
      "- a\n- b",
      `**Track two:** ${"y".repeat(401)}`,
      "- c\n- d",
    ].join("\n\n");
    expect(kinds(parseMarkdown(wordy))).toEqual(["para", "list", "para", "list"]);
  });

  it("finds the two tracks in the real hackathon copy", () => {
    const blocks = parseMarkdown(LUMA_ABOUT_TRACKS);
    const panels = blocks.find((b) => b.kind === "panels");
    expect(panels?.kind === "panels" && panels.items).toHaveLength(2);
  });
});

describe("scheduleColumns — pivoting to a two-column timetable", () => {
  it("finds the two tracks, in first-appearance order", () => {
    expect(scheduleColumns(firstSchedule(parseMarkdown(LUMA_ABOUT)))).toEqual([
      "Newcomer Track",
      "Pod Sprint Track",
    ]);
  });

  it("ignores shared rows, which span rather than forming a third column", () => {
    const slots = firstSchedule(
      parseMarkdown(
        "9:00\n\n- All: Breakfast\n\n9:30\n\n- Track A: one\n- Track B: two\n\n10:00\n\n- Track A: three\n- Track B: four\n\n11:00\n\n- All: Lunch"
      )
    );
    expect(scheduleColumns(slots)).toEqual(["Track A", "Track B"]);
  });

  it("returns null for a single-track day — a one-column table is just a list", () => {
    const slots = firstSchedule(
      parseMarkdown("9:00\n\n- Track A: one\n\n10:00\n\n- Track A: two")
    );
    expect(scheduleColumns(slots)).toBe(null);
  });

  it("returns null for three tracks", () => {
    const slots = firstSchedule(
      parseMarkdown(
        "9:00\n\n- A one: x\n- B two: y\n- C three: z\n\n10:00\n\n- A one: x\n- B two: y\n- C three: z"
      )
    );
    expect(scheduleColumns(slots)).toBe(null);
  });

  it("returns null when nothing is tagged at all", () => {
    const slots = firstSchedule(
      parseMarkdown("9:00 — Breakfast\n\n10:00 — Welcome")
    );
    expect(scheduleColumns(slots)).toBe(null);
  });

  it("does not count a tag that appears on only one row as a track", () => {
    const slots = firstSchedule(
      parseMarkdown(
        "9:00\n\n- Track A: one\n- Track B: two\n\n10:00\n\n- Track A: three\n- Track B: four\n\n11:00\n\n- Keynote: once only"
      )
    );
    expect(scheduleColumns(slots)).toEqual(["Track A", "Track B"]);
  });
});

describe("double rules", () => {
  /* Authors write "---" above a heading, and headings draw their own rule, so
     the two stacked into a visible double line (owner report, 2026-07-31). */
  it("drops a divider that sits immediately above a heading", () => {
    expect(kinds(parseMarkdown("text\n\n---\n\n**Heading**\n\nmore"))).toEqual([
      "para",
      "heading",
      "para",
    ]);
  });

  it("drops a divider opening the document, with nothing above to divide", () => {
    expect(kinds(parseMarkdown("---\n\ntext"))).toEqual(["para"]);
  });

  it("keeps a divider between two paragraphs", () => {
    expect(kinds(parseMarkdown("one\n\n---\n\ntwo"))).toEqual([
      "para",
      "rule",
      "para",
    ]);
  });
});

describe("editorial treatment — the thresholds", () => {
  /* These decide when prose gets promoted to a designed layout. Guessing wrong
     is worse than plain prose, so every case here must fail safe. */

  function cardsFlag(md: string): boolean {
    const list = parseMarkdown(md).find((b) => b.kind === "list");
    if (!list || list.kind !== "list") throw new Error("no list parsed");
    return list.cards;
  }

  const short = "- one thing\n- two thing\n- three thing";

  it("makes cards of a short parallel list under a heading", () => {
    expect(cardsFlag(`**For you if**\n\n${short}`)).toBe(true);
  });

  it("leaves a free-floating list alone, however short", () => {
    expect(cardsFlag(short)).toBe(false);
    expect(cardsFlag(`Some intro prose.\n\n${short}`)).toBe(false);
  });

  it("leaves a single-item list alone rather than making one lonely box", () => {
    expect(cardsFlag("**For you if**\n\n- only one")).toBe(false);
  });

  it("leaves a long list alone rather than cramming five boxes", () => {
    const five = ["a", "b", "c", "d", "e"].map((x) => `- ${x}`).join("\n");
    expect(cardsFlag(`**For you if**\n\n${five}`)).toBe(false);
  });

  it("leaves a wordy list alone", () => {
    const wordy = `- ${"x".repeat(130)}\n- short one`;
    expect(cardsFlag(`**For you if**\n\n${wordy}`)).toBe(false);
  });

  it("leaves a nested list alone", () => {
    expect(cardsFlag("**For you if**\n\n- parent\n  - child\n- other")).toBe(false);
  });

  function ledeFlag(md: string): boolean {
    const para = parseMarkdown(md).find((b) => b.kind === "para");
    if (!para || para.kind !== "para") throw new Error("no para parsed");
    return para.lede;
  }

  it("promotes only the first paragraph to lede type", () => {
    const blocks = parseMarkdown("First para.\n\nSecond para.");
    expect(blocks.map((b) => b.kind === "para" && b.lede)).toEqual([true, false]);
  });

  it("finds the first paragraph even when a heading comes first", () => {
    expect(ledeFlag("**Heading**\n\nThe opening paragraph.")).toBe(true);
  });

  it("leaves a long opening paragraph at body size", () => {
    expect(ledeFlag("y".repeat(281))).toBe(false);
    expect(ledeFlag("y".repeat(280))).toBe(true);
  });
});

describe("parseMarkdown — schedule detection", () => {
  it("reads a bare time followed by a list as a slot with tagged entries", () => {
    const slots = firstSchedule(
      parseMarkdown(
        "9:45\n\n- Newcomer Track: About the Labs\n- Pod Sprint Track: Frame the problem\n\n10:00\n\n- All: Break"
      )
    );
    expect(slots).toEqual([
      {
        time: "9:45",
        entries: [
          { label: "Newcomer Track", text: "About the Labs" },
          { label: "Pod Sprint Track", text: "Frame the problem" },
        ],
      },
      { time: "10:00", entries: [{ label: "All", text: "Break" }] },
    ]);
  });

  it("treats inline text after a dash as an entry, tag and all", () => {
    expect(
      firstSchedule(parseMarkdown("9:00am — Light Breakfast\n\n11:50 — All: Lunch"))
    ).toEqual([
      { time: "9:00am", entries: [{ label: null, text: "Light Breakfast" }] },
      { time: "11:50", entries: [{ label: "All", text: "Lunch" }] },
    ]);
  });

  it("accepts a meridiem without minutes, and a plain hyphen", () => {
    const slots = firstSchedule(parseMarkdown("9 AM - Doors\n\n5 PM - Close"));
    expect(slots.map((s) => s.time)).toEqual(["9 AM", "5 PM"]);
  });

  it("mixes inline-text rows and list rows in one schedule", () => {
    const slots = firstSchedule(
      parseMarkdown(
        "9:00am — Light Breakfast\n\n9:45\n\n- Newcomer Track: Orientation\n\n11:50 — Lunch"
      )
    );
    expect(slots.map((s) => s.time)).toEqual(["9:00am", "9:45", "11:50"]);
    expect(slots[1].entries).toEqual([
      { label: "Newcomer Track", text: "Orientation" },
    ]);
  });

  it("needs more than one row — a lone time stays a paragraph", () => {
    expect(kinds(parseMarkdown("9:00am — Light Breakfast"))).toEqual(["para"]);
  });

  it("leaves prose that merely opens with a time alone", () => {
    expect(
      kinds(parseMarkdown("10:00 is when we start\n\n11:00 is lunch"))
    ).toEqual(["para", "para"]);
  });

  it("does not mistake a bare number for a time", () => {
    expect(kinds(parseMarkdown("9 — nine\n\n10 — ten"))).toEqual([
      "para",
      "para",
    ]);
  });

  it("splits an entry tag on the first colon only", () => {
    const slots = firstSchedule(
      parseMarkdown(
        "1:00\n\n- Newcomer Track: Workshop: Prompt to Prototype\n\n2:00\n\n- All: Wrap"
      )
    );
    expect(slots[0].entries[0]).toEqual({
      label: "Newcomer Track",
      text: "Workshop: Prompt to Prototype",
    });
  });

  it("leaves an untagged entry untagged", () => {
    const slots = firstSchedule(
      parseMarkdown("9:00\n\n- Light breakfast\n\n9:30\n\n- Welcome")
    );
    expect(slots[0].entries).toEqual([{ label: null, text: "Light breakfast" }]);
  });

  it("keeps a child bullet with its parent entry, untagged", () => {
    const slots = firstSchedule(
      parseMarkdown(
        "9:45\n\n- Pod Sprint Track: Frame the problem\n  - bring your notes\n\n10:00\n\n- All: Break"
      )
    );
    expect(slots[0].entries).toEqual([
      { label: "Pod Sprint Track", text: "Frame the problem" },
      { label: null, text: "bring your notes" },
    ]);
  });
});

/* What `events.about` ACTUALLY held after a real sync (read from the dev
   database, 2026-07-31), which is materially different from the shape the
   fixture above was written from: no blank lines between blocks, ATX headings,
   "*   " bullets, and the track tags bolded with the colon on either side of the
   markers. All three defeated the first version of the parser — the whole thing
   collapsed into one paragraph and the schedule never formed. */
const LUMA_TIGHT = [
  "## **Schedule:**",
  "9:00am — **All:** Light Breakfast",
  "9:30",
  "*   **All:** Welcome (AU Hosts)",
  "9:45",
  "*   **Newcomer Track**: About The Upskilling Labs and what to expect",
  "*   **Pod Sprint Track**: Frame and orient problem statements",
  "10:00",
  "*   **Newcomer Track**: Workshop — Design Thinking with Emily Modde",
  "*   **Pod Sprint Track**: Lightning Talks, How Might We statements",
  "11:50 — **All:** Lunch",
].join("\n");

describe("parseMarkdown — Luma's tight export", () => {
  const blocks = parseMarkdown(LUMA_TIGHT);

  it("treats an ATX heading as a heading, without the markers", () => {
    expect(blocks[0]).toEqual({
      kind: "heading",
      text: "Schedule:",
      id: "schedule",
    });
  });

  it("forms the schedule despite single newlines between blocks", () => {
    expect(firstSchedule(blocks).map((s) => s.time)).toEqual([
      "9:00am",
      "9:30",
      "9:45",
      "10:00",
      "11:50",
    ]);
  });

  it("reads a bolded track tag, colon inside or outside the markers", () => {
    const slots = firstSchedule(blocks);
    expect(slots[0].entries).toEqual([{ label: "All", text: "Light Breakfast" }]);
    expect(slots[2].entries.map((e) => e.label)).toEqual([
      "Newcomer Track",
      "Pod Sprint Track",
    ]);
    // The markers are consumed, not left in the text for the reader to see.
    expect(JSON.stringify(slots)).not.toContain("**");
  });

  it("still pivots to two columns", () => {
    expect(scheduleColumns(firstSchedule(blocks))).toEqual([
      "Newcomer Track",
      "Pod Sprint Track",
    ]);
  });

  it("does not read a bolded sentence as a track tag", () => {
    const [block] = parseMarkdown("**Note: this matters** and more follows.");
    expect(block.kind).toBe("para");
  });

  it("keeps a single newline inside prose as a line break, not a block split", () => {
    const blocks = parseMarkdown("First para.\n\nBio:\nAda Lovelace");
    expect(blocks).toHaveLength(2);
    expect(blocks[1]).toEqual({
      kind: "para",
      text: "Bio:\nAda Lovelace",
      lede: false,
    });
  });
});

describe("parseMarkdown — the real Luma About text", () => {
  const blocks = parseMarkdown(LUMA_ABOUT);

  it("finds the schedule and reads every row in order", () => {
    expect(firstSchedule(blocks).map((s) => s.time)).toEqual([
      "9:00am",
      "9:30",
      "9:45",
      "10:00",
      "10:50",
      "11:20",
      "11:50",
      "1:00",
      "2:30",
      "3:30",
      "4:30",
    ]);
  });

  it("tags both tracks where the copy names them", () => {
    const nineFortyFive = firstSchedule(blocks).find((s) => s.time === "9:45")!;
    expect(nineFortyFive.entries.map((e) => e.label)).toEqual([
      "Newcomer Track",
      "Pod Sprint Track",
    ]);
  });

  it("tags an 'All:' row written inline after a dash", () => {
    const lunch = firstSchedule(blocks).find((s) => s.time === "11:50")!;
    expect(lunch.entries).toEqual([{ label: "All", text: "Lunch" }]);
  });

  it("turns the bold pseudo-headings into headings", () => {
    const headings = blocks.flatMap((b) =>
      b.kind === "heading" ? [b.text] : []
    );
    expect(headings).toContain("This event is for you if:");
    expect(headings).toContain("Schedule:");
  });

  it("renders the dividers as rules rather than literal dashes", () => {
    expect(blocks.some((b) => b.kind === "rule")).toBe(true);
    expect(
      blocks.some((b) => b.kind === "para" && b.text.trim() === "---")
    ).toBe(false);
  });

  it("keeps the intro prose as paragraphs, not schedule rows", () => {
    expect(blocks[0]).toEqual({
      kind: "para",
      text: "Interested in using AI to solve a real world/life problem? Come find out.",
      lede: true,
    });
  });

  it("leaves no zero-width spaces anywhere in the parse tree", () => {
    expect(JSON.stringify(blocks)).not.toContain(ZW);
  });
});
