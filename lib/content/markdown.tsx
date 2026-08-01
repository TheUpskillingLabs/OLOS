import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";

/* A deliberately small markdown renderer for Luma's About text (events.about,
   00094). Luma's editor has no heading levels and no tables, so the subset it
   can actually produce is: paragraphs, "- " lists (one level of nesting),
   **bold**, *italic* / _italic_, [text](url) links, bare URLs, ![alt](url)
   images (Luma's editor inserts uploaded images this way — sponsor logos),
   and "---" dividers. This renders exactly that subset and nothing more — if Luma copy
   ever outgrows it, reach for a real renderer rather than growing this one.

   Server-safe, dependency-free, and everything passes through React's escaping
   (no dangerouslySetInnerHTML, ever — this renders third-party text).

   ── CONTENT IS RENDERED VERBATIM (owner rule, 2026-07-31) ──────────────────
   Whatever the author wrote in Luma is what appears on the page, character for
   character. Do NOT add "helpful" rewriting here: no em-dash substitution, no
   smart quotes, no sentence-casing, no punctuation tidying, no truncation.
   The Labs' house preference for avoiding em dashes applies to copy WE write;
   it does not license this renderer to edit someone else's words. If Luma copy
   needs changing, it gets changed in Luma.

   The single exception is invisible characters (see `clean` below), which are
   removed because they are not content — they defeat the parser and render as
   nothing either way.
   ───────────────────────────────────────────────────────────────────────────

   Two Luma-specific accommodations:

   · Luma prefixes most lines with a zero-width space, so those are stripped
     before parsing or every paragraph starts with an invisible character.
   · Luma authors use a bold-only line as a heading (`**Schedule:**`) because
     the editor gives them no h2/h3. A paragraph that is nothing but one bold
     run is therefore treated as a subheading.

   Parsing is separated from rendering: `parseMarkdown` is pure and unit-tested
   (markdown.test.ts), `renderMarkdown` only maps blocks to elements. The
   vitest environment is `node` with no DOM, so the tests assert on the parse
   tree rather than on markup. */

/* ── Types ──────────────────────────────────────────────────────────────── */

/** One entry within a schedule slot. `label` is a recognised `Prefix:` tag. */
export type MdEntry = { label: string | null; text: string };

/** One time row of a schedule. Text written inline after a dash and text
    written as bullets below both land in `entries`, so a tag like "All:" is
    recognised the same way either way round. */
export type MdSlot = { time: string; entries: MdEntry[] };

export type MdListItem = { text: string; children: string[] };

/* Presentation decisions live in the parse tree rather than the renderer, so
   the thresholds below are unit-tested. They are the risky part of the
   editorial treatment: promoting prose to a designed layout means inferring
   design from structure, and inferring wrong is worse than plain prose. Both
   flags are therefore deliberately conservative and fail to "plain". */
const LEDE_MAX = 280; // matches ledeOf() in lib/integrations/luma.ts
const CARDS_MIN = 2;
const CARDS_MAX = 4;
const CARD_TEXT_MAX = 120;

export type MdBlock =
  | { kind: "rule" }
  /** `id` is a slug assigned after parsing, unique within the document, so the
      on-page jump links and the headings they point at cannot drift apart. */
  | { kind: "heading"; text: string; id: string }
  /** `cards` asks for the bordered numbered grid rather than a bulleted list.
      Only a short, parallel list directly under a heading earns it. */
  | { kind: "list"; items: MdListItem[]; cards: boolean }
  /** `lede` asks for the larger opening-paragraph type. First paragraph only,
      and only when it is short enough to read well at that size. */
  | { kind: "para"; text: string; lede: boolean }
  /** Two or more "**Label:** prose" paragraphs each followed by a short list —
      the shape authors use to describe parallel options (the two hackathon
      tracks). Rendered side by side rather than as a run of bullets. */
  | { kind: "panels"; items: MdPanel[] }
  | { kind: "schedule"; slots: MdSlot[] };

export type MdPanel = { heading: string; text: string; points: string[] };

/* ── Parsing ────────────────────────────────────────────────────────────── */

/** Luma sprinkles U+200B (and occasionally other invisibles) through its
    markdown export. They break nothing visually but they do defeat regexes
    anchored with ^, so they go first. */
function clean(text: string): string {
  // U+200B zero-width space through U+200D joiner, plus U+FEFF BOM. Written as
  // escapes on purpose: as literals they are invisible in the source too.
  return text.replace(/\r\n?/g, "\n").replace(/[\u200B-\u200D\uFEFF]/g, "");
}

const RULE_RE = /^(?:-{3,}|\*{3,}|_{3,})$/;
const BULLET_RE = /^[-*]\s+/;
/** A line that is exactly one image. Luma's editor inserts uploaded images as
    their own block (`![](url)`, alt always empty), and its tight export puts
    them one newline under whatever precedes them — so, like bullets and rules,
    an image line has to start a block of its own or it fuses into the
    paragraph above (the sponsor-logo-as-raw-text bug, owner flag 2026-08-01). */
const IMAGE_LINE_RE = /^!\[[^\]]*\]\([^\s)]+\)$/;
/** A bold-only line, with an optional trailing colon inside or outside. */
const HEADING_RE = /^\*\*\s*([^*]+?)\s*\*\*:?$/;
/** An ATX heading. Luma's editor does emit these ("## **Schedule:**"), despite
    offering no heading control in its toolbar, so the level is ignored and the
    text is treated the same as the bold-line convention. */
const ATX_RE = /^#{1,6}\s+(.+?)\s*$/;

/* Authors who don't reach for bold write a bare label line ending in a colon
   instead ("What to bring:", "Bio:"). Same intent, so same treatment. Guarded
   hard, because a colon is common mid-prose: it must be one short line, end in
   a colon, contain no sentence-ending punctuation (which is what separates a
   label from a sentence that happens to end in a colon), and be followed by
   something for it to be a heading OF. */
const COLON_HEADING_RE = /^([^\n.!?]{2,80}):$/;

/** Link URLs and emphasis markers are syntax, not text. Length thresholds
    measure what a reader sees, so a markdown link's URL cannot decide layout. */
function visibleText(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^\s)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^\s)]+\)/g, "$1")
    .replace(/\\([^\sA-Za-z0-9])/g, "$1")
    .replace(/\*\*|\*|_/g, "");
}

/* Luma's About text ends with the calendar's standing boilerplate — "About The
   Upskilling Labs: an open, project-based learning community…". On Luma that
   paragraph earns its place, introducing us to someone who arrived from a
   discover feed. On our own event page, one click from /about, it is filler
   (owner call, 2026-07-31), so a trailing section that introduces the Labs is
   dropped along with the divider above it.

   Only the TAIL is considered. The same words mid-document are content — the
   hackathon's own schedule has "About The Upskilling Labs and what to expect" as
   a 9:45 entry, and that must survive. */
const BOILERPLATE_RE = /^about\s+(?:the\s+)?upskilling\s+labs\b/i;
const BOILERPLATE_TAIL = 3; // blocks from the end that count as "the tail"

function dropTrailingBoilerplate(blocks: MdBlock[]): MdBlock[] {
  for (
    let i = blocks.length - 1;
    i >= 0 && i >= blocks.length - BOILERPLATE_TAIL;
    i--
  ) {
    const b = blocks[i];
    if (b.kind !== "para" && b.kind !== "heading") continue;
    if (!BOILERPLATE_RE.test(visibleText(b.text).trim())) continue;
    // Take the divider that introduced the section with it, or the page ends on
    // a rule with nothing under it.
    let cut = i;
    while (cut > 0 && blocks[cut - 1].kind === "rule") cut--;
    return blocks.slice(0, cut);
  }
  return blocks;
}

/* Luma authors bold a whole sentence for emphasis as readily as they bold a
   two-word label, and only the short ones are acting as headings. Past this
   length it stays a paragraph, where the bold still renders inline — so
   emphasis is never lost, it just isn't promoted. */
const HEADING_MAX = 80;

/* A schedule row: a time, then either nothing or a dash and inline text.
   Requiring either a colon (9:45) or a meridiem (9 AM) keeps bare numbers out,
   and requiring a dash before trailing text keeps prose like
   "10:00 is when we start" from being mistaken for a row. */
const TIME_RE =
  /^(\d{1,2}:\d{2}\s*(?:[ap]\.?m\.?)?|\d{1,2}\s*[ap]\.?m\.?)\s*(?:[—–-]+\s*(.*))?$/i;

/* A track tag on an entry: "Newcomer Track: …", "All: …". Lazy, so the FIRST
   colon wins, and the character class excludes sentence punctuation so a
   mid-sentence colon can't be mistaken for a tag. */
const LABEL_RE = /^([A-Z][A-Za-z0-9 &'’()/-]{0,28}?):\s*(.+)$/;

/* The same tag, bolded — which is how Luma's editor actually writes it, with the
   colon landing either inside the bold ("**All:** Lunch") or outside
   ("**Newcomer Track**: …"). Both are one optional colon in the pattern.

   The label class excludes `:` `.` `!` `?`, which is what keeps a bolded
   SENTENCE from being read as a tag: "**Note: this matters** and more" cannot
   match, because the label would have to swallow a colon to reach the closing
   `**`. */
const BOLD_LABEL_RE =
  /^\*\*\s*([A-Z][^*\n.:!?]{0,28}?)\s*:?\s*\*\*\s*:?\s*(.+)$/;

function parseTime(block: string): { time: string; text: string | null } | null {
  const lines = block.split("\n");
  if (lines.length !== 1) return null;
  const m = TIME_RE.exec(lines[0].trim());
  if (!m) return null;
  return { time: m[1].trim(), text: m[2]?.trim() || null };
}

function parseList(block: string): MdListItem[] | null {
  const lines = block.split("\n").filter((l) => l.trim());
  if (!lines.length || !lines.every((l) => BULLET_RE.test(l.trim()))) return null;
  const indents = lines.map((l) => /^\s*/.exec(l)![0].length);
  const base = Math.min(...indents);
  const items: MdListItem[] = [];
  lines.forEach((line, i) => {
    const text = line.trim().replace(BULLET_RE, "");
    // Anything indented past the shallowest bullet is a child of the item
    // above it. One level only; deeper nesting flattens into that level.
    if (indents[i] > base && items.length) items[items.length - 1].children.push(text);
    else items.push({ text, children: [] });
  });
  return items;
}

function labelSplit(text: string): MdEntry {
  const m = BOLD_LABEL_RE.exec(text) ?? LABEL_RE.exec(text);
  return m
    ? { label: m[1].trim(), text: m[2].trim() }
    : { label: null, text };
}

function toEntries(items: MdListItem[]): MdEntry[] {
  return items.flatMap((item) => [
    labelSplit(item.text),
    // A child bullet under a tagged entry belongs to that entry, untagged.
    ...item.children.map((c) => ({ label: null, text: c })),
  ]);
}

/* A "**Label:** then prose" paragraph — a bold run with text after it, which is
   what separates a panel head from a heading (bold and nothing else). */
const PANEL_RE = /^\*\*\s*([^*]+?)\s*\*\*:?\s*([\s\S]+)$/;

/* Panels are the most speculative inference here, so they are the most tightly
   fenced: both the label and the prose have to be short enough to sit in a card,
   and the pattern has to repeat. One such paragraph is just a paragraph. */
const PANEL_HEAD_MAX = 90;
const PANEL_TEXT_MAX = 400;
const PANELS_MAX = 3;

function parsePanelHead(block: string): { heading: string; text: string } | null {
  const m = PANEL_RE.exec(block.trim());
  if (!m) return null;
  const [, heading, text] = m;
  if (
    visibleText(heading).length > PANEL_HEAD_MAX ||
    visibleText(text).length > PANEL_TEXT_MAX
  ) {
    return null;
  }
  return { heading: heading.trim(), text: text.trim() };
}

function allBullets(block: string): boolean {
  const lines = block.split("\n").filter((l) => l.trim());
  return lines.length > 0 && lines.every((l) => BULLET_RE.test(l.trim()));
}

/* Luma's markdown is TIGHT: structural lines are separated by single newlines,
   not blank ones. What its API actually returns for the hackathon looks like

     ## **Schedule:**
     9:00am — **All:** Light Breakfast
     9:30
     *   **All:** Welcome (AU Hosts)

   Splitting on blank lines alone turns all of that into ONE paragraph, so the
   heading stays literal "## " text and the schedule never forms — the bug behind
   "the schedule didn't render as a table" (owner flag, 2026-07-31).

   So a blank line is inserted before any line that *starts* a block of its own:
   an ATX heading, a bullet, a horizontal rule, or a time row. Prose is untouched,
   which matters: a single newline inside a paragraph is meaningful in Luma copy
   ("Bio:" over a name) and still renders as a <br>.

   Bullets being split from each other is harmless — the loose-list pass below
   stitches adjacent bullet-only blocks back into one list, indentation intact. */
function loosen(text: string): string {
  const starts = (line: string): boolean => {
    const t = line.trim();
    return (
      ATX_RE.test(t) ||
      BULLET_RE.test(t) ||
      RULE_RE.test(t) ||
      TIME_RE.test(t) ||
      IMAGE_LINE_RE.test(t)
    );
  };
  const out: string[] = [];
  for (const line of text.split("\n")) {
    const prev = out[out.length - 1];
    if (prev !== undefined && prev.trim() && line.trim() && starts(line)) {
      out.push("");
    }
    out.push(line);
  }
  return out.join("\n");
}

/** Split into blocks, then group any run of time rows into one schedule. */
export function parseMarkdown(text: string): MdBlock[] {
  const split = loosen(clean(text))
    .split(/\n\s*\n/)
    .map((b) => b.replace(/\s+$/, ""))
    .filter((b) => b.trim());

  /* Loose lists: a blank line between bullets is legal markdown and Luma's
     export uses them, which would otherwise shatter one list into a run of
     single-item lists (and break schedule entries, which are lists). Adjacent
     bullet-only blocks are therefore stitched back into one block. Two lists
     cannot be adjacent in markdown without something between them, so this
     never merges things that were meant to be separate. */
  const blocks: string[] = [];
  for (const b of split) {
    const prev = blocks[blocks.length - 1];
    if (allBullets(b) && prev !== undefined && allBullets(prev)) {
      blocks[blocks.length - 1] = `${prev}\n${b}`;
    } else {
      blocks.push(b);
    }
  }

  const out: MdBlock[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const time = parseTime(blocks[i]);

    if (time) {
      /* Collect consecutive time rows. Each may be followed by one list block
         holding its entries. A lone row is not a schedule — it falls through
         to normal rendering below. */
      const slots: MdSlot[] = [];
      let j = i;
      while (j < blocks.length) {
        const t = parseTime(blocks[j]);
        if (!t) break;
        const items = j + 1 < blocks.length ? parseList(blocks[j + 1]) : null;
        slots.push({
          time: t.time,
          entries: [
            ...(t.text ? [labelSplit(t.text)] : []),
            ...(items ? toEntries(items) : []),
          ],
        });
        j += items ? 2 : 1;
      }

      if (slots.length > 1) {
        out.push({ kind: "schedule", slots });
        i = j - 1;
        continue;
      }
      // Fall through: render the single row as an ordinary paragraph.
    }

    const block = blocks[i];
    const single = block.split("\n").length === 1 ? block.trim() : null;

    if (single && RULE_RE.test(single)) {
      out.push({ kind: "rule" });
      continue;
    }
    if (single) {
      /* An ATX heading is explicit, so it needs none of the length and
         punctuation guards the inferred forms below carry. Its text often has
         bold wrapped round it as well ("## **Schedule:**"); the markers are
         syntax twice over, so they come off. */
      const atx = ATX_RE.exec(single);
      if (atx) {
        const text = atx[1].replace(/^\*\*\s*|\s*\*\*$/g, "").trim();
        out.push({ kind: "heading", text, id: "" });
        continue;
      }
      const bold = HEADING_RE.exec(single);
      /* A bare "Label:" line is only a heading when there is a block after it
         to head. At the end of the copy it is just a dangling sentence. */
      const colon =
        i + 1 < blocks.length ? COLON_HEADING_RE.exec(single) : null;
      const h = bold ?? colon;
      if (h && visibleText(h[1]).length <= HEADING_MAX) {
        out.push({ kind: "heading", text: h[1], id: "" }); // id assigned below
        continue;
      }
    }
    /* Panels: "**Label:** prose" + a list, repeated. Authors reach for this to
       describe parallel options, and a run of bullets buries the parallelism.
       Two is the minimum — one such pair is just a paragraph and a list. */
    if (parsePanelHead(block) && parseList(blocks[i + 1] ?? "")) {
      const panels: MdPanel[] = [];
      let j = i;
      while (j + 1 < blocks.length) {
        const head = parsePanelHead(blocks[j]);
        const points = head ? parseList(blocks[j + 1]) : null;
        if (!head || !points) break;
        panels.push({ ...head, points: points.map((p) => p.text) });
        j += 2;
      }
      if (panels.length >= 2 && panels.length <= PANELS_MAX) {
        out.push({ kind: "panels", items: panels });
        i = j - 1;
        continue;
      }
    }

    const items = parseList(block);
    if (items) {
      out.push({ kind: "list", items, cards: false });
      continue;
    }
    out.push({ kind: "para", text: block, lede: false });
  }

  /* ── Editorial treatment, decided structurally ──────────────────────────
     Both passes below fail safe: if the shape is not there, the block renders
     as ordinary prose. Nothing here changes the words. */

  // The opening paragraph carries the page, so it gets lede type — unless it
  // is long, where lede size becomes unwieldy rather than inviting.
  const firstPara = out.find((b) => b.kind === "para");
  if (firstPara?.kind === "para" && firstPara.text.length <= LEDE_MAX) {
    firstPara.lede = true;
  }

  // A short list of parallel, short items sitting directly under a heading is
  // the shape the bespoke page hand-built as numbered cards. Anything longer,
  // wordier, nested, or free-floating stays a list: seven cramped cards or one
  // lonely box both look like a mistake.
  out.forEach((block, i) => {
    if (block.kind !== "list") return;
    const underHeading = out[i - 1]?.kind === "heading";
    const { items } = block;
    block.cards =
      underHeading &&
      items.length >= CARDS_MIN &&
      items.length <= CARDS_MAX &&
      items.every(
        (it) =>
          !it.children.length &&
          visibleText(it.text).length <= CARD_TEXT_MAX
      );
  });

  /* Authors put a "---" divider above a heading, and headings now draw their own
     rule, so the two stack into a double line. The heading's rule wins. Same for
     a rule opening the document, where there is nothing above to divide from. */
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i].kind !== "rule") continue;
    if (i === 0 || out[i + 1]?.kind === "heading") out.splice(i, 1);
  }

  /* Heading ids, assigned in one pass so duplicates get a suffix and the table
     of contents always points somewhere real. */
  const seen = new Map<string, number>();
  for (const block of out) {
    if (block.kind !== "heading") continue;
    const base = slugify(block.text) || "section";
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    block.id = n === 1 ? base : `${base}-${n}`;
  }

  return dropTrailingBoilerplate(out);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** The two track names a schedule is organised by, in first-appearance order,
    or null when the copy isn't two-track.

    A day with exactly two recurring tags ("Newcomer Track", "Pod Sprint Track")
    is a two-column timetable, and pivoting it back into a real table is the one
    thing the retired bespoke page did that a linear list cannot. Anything else —
    one track, three, none — stays a stacked list, because a table with one
    content column is just a list with extra lines. */
export function scheduleColumns(slots: MdSlot[]): [string, string] | null {
  /* A track is a tag that shares a time slot with a DIFFERENT tag — that is
     what makes it a column rather than a row. "All: Lunch" is tagged and
     recurring, but it always sits alone in its slot, so it is a shared row and
     must not become a third column. Requiring two slots as well keeps a
     one-off ("Keynote:") out. */
  const slotLabels = slots.map((s) => [
    ...new Set(s.entries.flatMap((e) => (e.label ? [e.label] : []))),
  ]);
  const order: string[] = [];
  for (const labels of slotLabels) {
    for (const l of labels) if (!order.includes(l)) order.push(l);
  }
  const tracks = order.filter(
    (l) =>
      slotLabels.some((ls) => ls.includes(l) && ls.length > 1) &&
      slotLabels.filter((ls) => ls.includes(l)).length > 1
  );
  return tracks.length === 2 ? [tracks[0], tracks[1]] : null;
}

/** The headings, for an on-page "jump to" nav. Long Luma copy is a wall
    otherwise. Callers decide whether there are enough to be worth showing. */
export function markdownToc(text: string): { id: string; text: string }[] {
  return parseMarkdown(text).flatMap((b) =>
    b.kind === "heading" ? [{ id: b.id, text: b.text }] : []
  );
}

/* ── Inline rendering ───────────────────────────────────────────────────── */

/* Backslash escapes come FIRST, and every emphasis run allows `\x` inside it.

   Luma's editor escapes a literal asterisk when an author types one, so a
   footnote marker inside bold arrives as `**\*Note:**`. Without escape handling
   the `\*` read as an italic delimiter, the bold never closed, and the page
   showed `*\Note:**` (owner flag, 2026-07-31). */
const INLINE = new RegExp(
  [
    /\\([^\sA-Za-z0-9])/, //              1 escaped punctuation
    /!\[([^\]]*)\]\(([^\s)]+)\)/, //      2 alt, 3 src — before links: alt may
    //                                      be empty where a link label cannot,
    //                                      so `![](url)` must not fall through
    /\[((?:\\.|[^\]])+)\]\(([^\s)]+)\)/, // 4 label, 5 href
    /\*\*((?:\\.|[^*\n])+)\*\*/, //       6 bold
    /\*((?:\\.|[^*\n])+)\*/, //           7 italic
    /_((?:\\.|[^_\n])+)_/, //             8 italic
    /(mailto:[^\s<>()[\]]+)/, //          9
    /(https?:\/\/[^\s<>()[\]]+)/, //      10
    /(\bwww\.[^\s<>()[\]]+)/, //          11
  ]
    .map((r) => r.source)
    .join("|"),
  "g"
);

const LINK_STYLE = {
  color: "var(--teal-deep)",
  fontWeight: 600,
  textDecoration: "underline",
};

/* Root-relative hrefs stay on the site and go through next/link; everything
   else leaves and opens in a new tab. mailto: gets neither, since a new tab
   for a mail client is just an empty tab. */
function Anchor({ href, children }: { href: string; children: ReactNode }) {
  if (href.startsWith("/")) {
    return (
      <Link href={href} style={LINK_STYLE}>
        {children}
      </Link>
    );
  }
  if (href.startsWith("mailto:")) {
    return (
      <a href={href} style={LINK_STYLE}>
        {children}
      </a>
    );
  }
  return (
    <a
      href={href.startsWith("www.") ? `https://${href}` : href}
      target="_blank"
      rel="noopener noreferrer"
      style={LINK_STYLE}
    >
      {children}
    </a>
  );
}

/* Inline markup nests, so each match's content goes back through renderInline
   rather than out as literal text. Luma authors bold a whole sentence that
   happens to contain a link ("**Please [sign up here](url) if you can.**"), and
   because the `**` comes first in the string the bold alternative wins the
   match — rendering the link as raw markdown for the reader to squint at
   (owner flag, 2026-07-31, Volunteer Orientation).

   The recursion terminates by construction: every capture group excludes its
   own delimiter (`[^*\n]` for bold and italic, `[^\]]` for a link label), so an
   inner pass cannot re-match the marker it just consumed. Depth is bounded at
   link-inside-emphasis-inside-emphasis. */
function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(INLINE)) {
    const i = m.index ?? 0;
    if (i > last) out.push(text.slice(last, i));
    if (m[1]) {
      /* An escaped character is that character and nothing else. The backslash
         is syntax and must not reach the page — which is not a violation of the
         verbatim rule, since the author typed `*` and meant `*`. */
      out.push(m[1]);
    } else if (m[2] !== undefined && m[3]) {
      /* An image. The alt group participates even when empty (Luma emits
         `![](url)` for uploads), so the check is against undefined, not
         truthiness. Only web and root-relative srcs become an <img>; anything
         stranger fails safe to the alt text, per the renderer's philosophy. */
      if (/^(https?:\/\/|\/)/.test(m[3])) {
        out.push(
          // Third-party Luma CDN src; next/image would need a remotePatterns
          // allowlist and gains nothing for a one-off content image.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={key++}
            src={m[3]}
            alt={m[2]}
            loading="lazy"
            style={{
              display: "block",
              maxWidth: "min(100%, 560px)",
              height: "auto",
              margin: "8px 0",
            }}
          />
        );
      } else if (m[2]) {
        out.push(m[2]);
      }
    } else if (m[4] && m[5]) {
      out.push(
        <Anchor key={key++} href={m[5]}>
          {renderInline(m[4])}
        </Anchor>
      );
    } else if (m[6]) {
      out.push(<strong key={key++}>{renderInline(m[6])}</strong>);
    } else if (m[7] || m[8]) {
      out.push(<em key={key++}>{renderInline(m[7] || m[8])}</em>);
    } else if (m[9]) {
      out.push(
        <Anchor key={key++} href={m[9]}>
          {m[9].replace(/^mailto:/, "")}
        </Anchor>
      );
    } else if (m[10] || m[11]) {
      // Bare URL. Trailing punctuation belongs to the sentence, not the link.
      const raw = (m[10] || m[11]) as string;
      const url = raw.replace(/[.,;:!?]+$/, "");
      out.push(
        <Anchor key={key++} href={url}>
          {url}
        </Anchor>
      );
      if (url.length < raw.length) out.push(raw.slice(url.length));
    }
    last = i + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Lines within one paragraph keep their breaks (Luma uses single newlines
    inside a block for things like "Bio:" over the name). */
function renderLines(block: string): ReactNode[] {
  const out: ReactNode[] = [];
  block.split("\n").forEach((line, i) => {
    if (i > 0) out.push(<br key={`br-${i}`} />);
    out.push(...renderInline(line));
  });
  return out;
}

/* ── Block rendering ────────────────────────────────────────────────────── */

const PARA_STYLE = { color: "var(--slate)", marginBottom: 14 };

/* One time row. Deliberately the same shape as the retired bespoke hackathon
   page's mobile schedule card (time as a teal label, tagged entries beneath)
   — that presentation was already designed and reviewed, and it restacks for
   free because it was built narrow-first. */
function ScheduleSlot({ slot }: { slot: MdSlot }) {
  return (
    <div style={{ borderTop: "1px solid var(--rule)", padding: "16px 0" }}>
      <div className="lbl lbl-teal">{slot.time}</div>
      {slot.entries.map((e, i) =>
        e.label ? (
          <div key={i}>
            <p className="lbl" style={{ marginTop: 10 }}>
              {e.label}
            </p>
            <p className="t-body">{renderInline(e.text)}</p>
          </div>
        ) : (
          <p key={i} className="t-body" style={{ marginTop: 6 }}>
            {renderInline(e.text)}
          </p>
        )
      )}
    </div>
  );
}

/* The numbered-card grid, borrowed from the retired bespoke page's audience
   row: .lcard boxes with an .ed-num counter, in the .ed-cols column grid whose
   count comes from --ed-n. */
function Cards({ items }: { items: MdListItem[] }) {
  return (
    <div
      className="ed-cols"
      style={{ ["--ed-n"]: items.length, marginBottom: 14 } as CSSProperties}
    >
      {items.map((item, i) => (
        <div key={i} className="lcard" style={{ padding: 20 }}>
          <span className="ed-num">{String(i + 1).padStart(2, "0")}</span>
          <p className="t-body ed-text" style={{ color: "var(--slate)" }}>
            {renderInline(item.text)}
          </p>
        </div>
      ))}
    </div>
  );
}

/* A two-track schedule as a real timetable on wide screens, stacking to the
   ScheduleSlot cards below 768px. Both come from the same parsed slots, so they
   cannot disagree — the table is a presentation of the list, not a second copy.
   Shared rows (an untagged entry, typically "All: Lunch") span both columns. */
function ScheduleTable({
  slots,
  columns,
}: {
  slots: MdSlot[];
  columns: [string, string];
}) {
  const cell = "t-body px-4 py-3 align-top";
  const head = "lbl px-4 pb-3 text-left";
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th scope="col" className={head}>
            Time
          </th>
          <th scope="col" className={head}>
            {columns[0]}
          </th>
          <th scope="col" className={head}>
            {columns[1]}
          </th>
        </tr>
      </thead>
      <tbody>
        {slots.map((slot, i) => {
          const of = (label: string) =>
            slot.entries.filter((e) => e.label === label);
          const shared = slot.entries.filter(
            (e) => !e.label || !columns.includes(e.label)
          );
          const tagged = columns.some((c) => of(c).length > 0);
          return (
            <tr key={i} style={{ borderTop: "1px solid var(--rule)" }}>
              <th
                scope="row"
                className="lbl whitespace-nowrap px-4 py-3 text-left align-top"
              >
                {slot.time}
              </th>
              {tagged ? (
                columns.map((c) => (
                  <td key={c} className={cell}>
                    {of(c).map((e, j) => (
                      <span key={j}>{renderInline(e.text)}</span>
                    ))}
                  </td>
                ))
              ) : (
                /* An ink wash rather than var(--tint): the tint token is a cool
                   blue-grey that clashes on the warm paper (owner flag, July
                   2026). 4% ink reads as "same page, slightly raised". */
                <td
                  className={cell}
                  colSpan={2}
                  style={{ background: "rgba(0, 20, 27, 0.04)" }}
                >
                  {shared.map((e, j) => (
                    <span key={j}>{renderInline(e.text)}</span>
                  ))}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* Parallel options side by side, each with a brand colour as a 3px top rule —
   the retired bespoke page's track cards, which were the strongest thing on it.
   Two accents only, cycled: enough to tell panels apart at a glance without
   leaving the palette. */
const PANEL_ACCENTS = ["var(--teal)", "var(--forest)"];

function Panels({ items }: { items: MdPanel[] }) {
  return (
    <div
      className="ed-cols"
      style={{ ["--ed-n"]: items.length, marginBottom: 14 } as CSSProperties}
    >
      {items.map((panel, i) => (
        <div
          key={i}
          className="lcard"
          style={{
            padding: 24,
            borderTop: `3px solid ${PANEL_ACCENTS[i % PANEL_ACCENTS.length]}`,
          }}
        >
          <div className="t-h4" style={{ marginBottom: 8 }}>
            {renderInline(panel.heading)}
          </div>
          <p
            className="t-body ed-text"
            style={{ color: "var(--slate)", marginBottom: 12 }}
          >
            {renderInline(panel.text)}
          </p>
          <ul
            className="t-body ed-text"
            style={{
              color: "var(--slate)",
              paddingLeft: 20,
              listStyle: "disc",
              margin: 0,
            }}
          >
            {panel.points.map((pt, j) => (
              <li key={j} style={{ marginBottom: 6 }}>
                {renderInline(pt)}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function List({ items }: { items: MdListItem[] }) {
  return (
    <ul
      className="t-body"
      style={{ ...PARA_STYLE, paddingLeft: 20, listStyle: "disc" }}
    >
      {items.map((item, i) => (
        <li key={i} style={{ marginBottom: 6 }}>
          {renderInline(item.text)}
          {item.children.length > 0 && (
            <ul style={{ paddingLeft: 20, marginTop: 6, listStyle: "circle" }}>
              {item.children.map((c, j) => (
                <li key={j} style={{ marginBottom: 4 }}>
                  {renderInline(c)}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

export function renderMarkdown(text: string): ReactNode {
  return (
    <>
      {parseMarkdown(text).map((block, i) => {
        switch (block.kind) {
          case "rule":
            return (
              <hr
                key={i}
                style={{
                  border: 0,
                  borderTop: "1px solid var(--rule)",
                  margin: "22px 0",
                }}
              />
            );
          case "heading":
            /* A ruled heading at t-h3 (20px, 24px past 1024px). It began as the
               site's small-caps teal eyebrow, borrowed from EdSection, but an
               eyebrow is 12px and it sat above 16px body copy — so the heading
               read as SMALLER than the text it introduced (owner flag,
               2026-07-31). Eyebrows label a section from outside it; these are
               headings inside a document, and they should outrank the prose.
               The rule above stays: it is what separates the sections. */
            return (
              <div key={i} style={{ marginTop: i === 0 ? 0 : 36 }}>
                <hr
                  style={{
                    border: 0,
                    borderTop: "1px solid var(--rule)",
                    margin: "0 0 18px",
                  }}
                />
                <h3
                  id={block.id}
                  className="t-h3"
                  style={{ marginBottom: 14, scrollMarginTop: 96 }}
                >
                  {renderInline(block.text)}
                </h3>
              </div>
            );
          case "list":
            return block.cards ? (
              <Cards key={i} items={block.items} />
            ) : (
              <List key={i} items={block.items} />
            );
          case "panels":
            return <Panels key={i} items={block.items} />;
          case "schedule": {
            const columns = scheduleColumns(block.slots);
            const stacked = block.slots.map((slot, j) => (
              <ScheduleSlot key={j} slot={slot} />
            ));
            return (
              <div key={i} style={{ marginBottom: 14 }}>
                {columns ? (
                  <>
                    <div className="hidden md:block">
                      <ScheduleTable slots={block.slots} columns={columns} />
                    </div>
                    <div className="md:hidden">{stacked}</div>
                  </>
                ) : (
                  stacked
                )}
              </div>
            );
          }
          default:
            return (
              <p
                key={i}
                className={block.lede ? "t-lede ed-text" : "t-body"}
                style={block.lede ? { marginBottom: 20 } : PARA_STYLE}
              >
                {renderLines(block.text)}
              </p>
            );
        }
      })}
    </>
  );
}
