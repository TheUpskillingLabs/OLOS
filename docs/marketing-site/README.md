# Marketing Site Content Corpus

A clean, structured extract of the legacy public marketing site
**[theupskillinglabs.org](https://theupskillinglabs.org)** (a Squarespace site), captured
from its WordPress WXR export on 2026-07-06 (export snapshot dated 2026-02-18).

**This is a reference corpus, not final copy.** It exists so the content can be reviewed,
rewritten, and republished on the OLOS app as part of sunsetting the separate marketing
site. The exact pages here are not expected to ship verbatim — new images will be produced
at publish time, and the copy will be refined.

## Layout

```
docs/marketing-site/
  README.md              # this file
  pages/*.md             # 11 site pages (Home, About, Join, …), named by slug
  blog/*.md              # 28 blog posts + role/program cards, named by slug
```

## Frontmatter

Each file carries YAML frontmatter whose keys mirror the OLOS public-content DB columns
(`resources` / `events` in [`supabase/migrations/00033_public_content.sql`](../../supabase/migrations/00033_public_content.sql)),
so a future markdown → DB import is a direct field mapping:

| Field | Source in the WXR export | Maps to |
|---|---|---|
| `slug` | derived from the title (readable; original URLs are being retired) | `resources.slug` |
| `title` | `<title>` | `resources.title` / `events.name` |
| `type` | `page` or `post` | — |
| `status` | `<wp:status>` (`publish`→`published`) | `resources.status` |
| `date` | `<wp:post_date>` (posts only) | `created_at` |
| `author` | `<dc:creator>`, resolved to display name | `resources.author` |
| `summary` | `<excerpt:encoded>` or first paragraph | `resources.summary` |
| `tags` | `<category domain="post_tag">` | `resources.tags` |
| `source_url` | original `<link>` (provenance only) | — |

The body follows as clean Markdown: `#`/`##`/`###` headings, lists, and links preserved.

## How it was cleaned

The Squarespace export wraps every page body in fluid-engine layout CSS and image markup.
The extractor ([`scripts` note below](#regenerating)) strips all `<style>`/`<script>`
blocks, converts headings/lists/links to Markdown, and drops the Squarespace chrome.

**Images are intentionally excluded** — new visuals are created at publish time. Decorative
images are removed; where an image had a **caption**, the caption text is kept as an italic
line so the writer knows a visual belonged there (e.g. *"Photo credit: …"*).

## What was excluded

From the 99 export items, cruft was dropped and **11 pages + 28 posts** kept:

- **Empty page stubs:** Community Guidelines, Terms of Use, Upskiller's Agreement (0 words),
  and a leftover `test` page.
- **Squarespace demo drafts:** ~13 duplicate placeholder posts dated `2019-05-28`
  ("Redefine Success", "Small Steps Create Big Shifts", "Turn Intention Into Action", …).
- **Empty drafts:** 0-word draft posts with no content.
- **Media attachments:** 31 image files (out of scope — see above).

Two legitimate drafts were **kept** (marked `status: draft`): *Building Your First AI
Agents* and *Prompt Engineering for Deep Research*.

## Notes for the migration

- Author bylines use display names only; the export's personal email addresses are omitted.
- The `climate-and-energy-hackathon` page is a near-empty hero (heading only) in the source.
- This corpus is decoupled from any loader. Wiring refined Markdown → DB rows (or → rendered
  pages) is a separate step once the content has been rewritten.

## Regenerating

The extract was produced by a one-shot Python (stdlib-only) script run against the WXR
export. It is not committed as part of the app; the corpus here is the artifact. If the
source export is refreshed, re-run the extractor against the new XML to regenerate.
