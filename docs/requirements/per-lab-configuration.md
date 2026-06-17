# Requirements — Per-Lab Configuration Management (LATER)

| | |
|---|---|
| **Status** | **Deferred — not scheduled.** Pick up when a **second** lab needs values that differ from DC's. |
| **Author** | (you) |
| **Last updated** | 2026-06-17 |
| **Related docs** | [`local-labs.md`](./local-labs.md) (active — builds the `labs` entity; defers this config work as L-2), [`permissions-redesign.md`](./permissions-redesign.md) |

> **Why this is separate and deferred.** [`local-labs.md`](./local-labs.md)
> puts the **lab concept** in the data model now (the `labs` table, `lab_id` on
> cycles/participants, the lab-admin tier). What it intentionally leaves out is
> letting each lab **configure its own** option lists, integrations, and brand —
> because there is only one lab (DC), so there is nothing to differentiate.
> This doc captures that config work for when a real second lab arrives.

## Trigger to pick this up

A second lab is being onboarded **and** it needs at least one of: different form
options, its own Slack/Drive/GitHub, or its own branding. Until then, everything
below stays global and this doc is reference only.

## Current state (until then)

All of the following are **global** — one shared value across the (single) lab:

- `option_lists` — registration dropdowns (sectors, work situations,
  neighborhoods, etc.) are one shared set.
- Provisioning targets — pods/projects create Slack channels, Drive folders, and
  GitHub repos under one shared workspace/org/drive.
- Branding — one name, logo, color set, and email sender (The Upskilling Labs).

## Config dimensions to make per-lab (when triggered)

Each is independent — adopt only the ones a new lab actually needs.

### 1. Per-lab option lists
- **Why:** chapters in different cities have different valid values (e.g.
  neighborhoods, local sectors).
- **Change:** add `option_lists.lab_id` (nullable → `NULL` means "global
  default", set means "this lab overrides"). Resolution: a lab's effective list
  = its own rows, falling back to global where it has none. Admin UI under the
  lab to edit its lists.
- **Migration:** existing rows stay `lab_id = NULL` (remain global); no data
  moves.

### 2. Per-lab integration / provisioning targets
- **Why:** each chapter may have its own Slack workspace, Google Drive, and
  GitHub org.
- **Change:** a `lab_integrations` config (per lab: Slack workspace/token, Drive
  root folder, GitHub org). Provisioning code reads the *cycle's lab* to decide
  where to create channels/folders/repos. Secrets handled like existing
  integration credentials (not in the table in plaintext).
- **Risk:** this is the heaviest item — touches every provisioning path and the
  credential model. Scope carefully when it lands.

### 3. Per-lab branding
- **Why:** chapters may present as distinct brands in UI and email.
- **Change:** per-lab `name`, `logo_url`, theme colors, and email sender/from
  address. UI and `lib/email/` read the active lab's branding. Sender domains
  must still be verified in Resend (SPF/DKIM) per lab.

## Out of scope even then

- Cross-lab sharing of option lists/templates (each lab is independent).
- Self-serve lab creation/branding by lab admins — lab creation stays
  super-admin-only (see `local-labs.md` L-5).

## Open decisions (revisit at trigger time)

- **Override vs. replace** for option lists — does a lab's list *extend/override*
  the global defaults (recommended: `lab_id NULL` = fallback) or fully replace
  them?
- **Credential storage** for per-lab Slack/Drive/GitHub — env-based per lab vs. a
  secrets manager; do not store tokens in plaintext columns.
- **Branding granularity** — just logo + sender, or full theming?
