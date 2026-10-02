# `docs/legal/` — the Code of Conduct, Privacy Policy, and Terms

| | |
|---|---|
| **What this is** | The source text of the three legal documents a member accepts at registration. Content, not engineering docs. |
| **Zone / owner** | The Markdown is the `docs` zone; the pages that render it are the `frontend` zone ([`../agent-teams.md`](../agent-teams.md) "File-ownership map"). A change to the text is a content change reviewed by the owner. |
| **Conventions** | No `CLAUDE.md`. Each file carries an **Effective date** line. The public page that renders each one is hand-written and mirrors the Markdown; there is no loader, so a change is two edits (below). Never published to the knowledge repo (`neverPublish` in [`../publish.manifest.json`](../publish.manifest.json)); excluded from the doc-map rule in [`.github/workflows/docs-check.yml`](../../.github/workflows/docs-check.yml) and from steward checks ([`../roadmap/documentation-framework.md`](../roadmap/documentation-framework.md) §3.3). |
| **Last verified** | 2026-10-02 |

## What is here

| File | Effective date | Rendered by | Notes |
|---|---|---|---|
| [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) | July 6, 2026 | `/code-of-conduct` — [`app/(public)/code-of-conduct/page.tsx`](../../app/(public)/code-of-conduct/page.tsx) | Part of the Participant Agreement accepted at registration. |
| [`PRIVACY_POLICY.md`](PRIVACY_POLICY.md) | July 9, 2026 | `/privacy` — [`app/(public)/privacy/page.tsx`](../../app/(public)/privacy/page.tsx) | Covers the public site and the platform; states what Google Sign-In provides (basic profile only). |
| [`TERMS_OF_SERVICE.md`](TERMS_OF_SERVICE.md) | July 3, 2026 | `/terms` — [`app/(public)/terms/page.tsx`](../../app/(public)/terms/page.tsx) | |

## How it fits

Each page under `app/(public)/` is a React page whose JSX carries the copy. Its header comment
names the Markdown here as the source of truth and says to keep the two in sync. Nothing reads
these `.md` files at build or run time (verified 2026-10-02: the only references to them in
`app/` and `lib/` are those comments). The pages are linked from the site footers
([`app/components/chrome/site-footers.tsx`](../../app/components/chrome/site-footers.tsx)),
the registration funnel's agreement step
([`app/(auth)/register/funnel.tsx`](../../app/(auth)/register/funnel.tsx), all three), the
login card (Terms and Privacy), and the landing page (Privacy).

Review: [`.github/CODEOWNERS`](../../.github/CODEOWNERS) routes every PR to the maintainers and
has no separate rule for this folder, so ask for the owner's review explicitly on the PR; the
owner signs off on legal text. The Privacy Policy makes promises the code has to keep (what is
collected, who can see what, how a member leaves), so a product change that touches those (the
erasure path, bans, messaging consent) may be a policy change too, and the reverse.

## Open issues in this area (snapshot 2026-10-02)

Live view: [all open issues](https://github.com/TheUpskillingLabs/OLOS/issues).

- [#384](https://github.com/TheUpskillingLabs/OLOS/issues/384) — Platform bans / blacklist: prevent re-registration after removal (design + policy scoping)
- [#383](https://github.com/TheUpskillingLabs/OLOS/issues/383) — Participant erasure: owner-gated Danger Zone is silently hidden; path undiscoverable and partially defective

This list is a snapshot; the live view above is the truth. Refreshed at each sprint boundary
([`../roadmap/documentation-framework.md`](../roadmap/documentation-framework.md) §9.1).

## Before you change something

- Edit the Markdown **and** the matching `page.tsx` in the same PR, and move the Effective
  date in both. The page change touches `app/`, so the PR needs a `CHANGELOG.md` line.
- There are no tests on these pages. Run `npm run dev`, open the three routes, and read the
  rendered text against the Markdown.
- `npm run check:docs` runs the link check on changed Markdown here.
- Copy rules: "The Labs" (never "TUL"), "Upskiller", "Poderator"; never course / class /
  student / lesson / module. No names of real participants.
- The constitution (no in-app LLM, no activity telemetry, consent-gated messaging) is what the
  Privacy Policy promises. Do not promise less here, and do not ship code that breaks it.
- Branch and PR workflow: [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md).
