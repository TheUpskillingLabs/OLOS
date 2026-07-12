# Requirements — Per-Metro Configuration Management (LATER)

| | |
|---|---|
| **Status** | **Deferred — not scheduled.** Pick up when a second **active metro sub-cohort** needs values that differ from the HQ defaults. |
| **Last updated** | 2026-07-12 (re-baselined on the shipped metros model; original 2026-06-17) |
| **Related code** | `metros` (`00033`, `00038`, `00062`), `option_lists` (`00012`), `lib/email/` |
| **Related docs** | [`local-labs.md`](./local-labs.md) (superseded record of the shipped metros/sub-cohort model), [`permissions-redesign.md`](./permissions-redesign.md) |

> **Why this is separate and deferred.** The multi-tenancy that shipped
> (`metros` as lab anchor; labs as sub-cohorts of the single HQ open cycle —
> see [`local-labs.md`](./local-labs.md)) intentionally leaves configuration
> **global**: one set of option lists, integrations, and branding. With one
> effective tenant there is nothing to differentiate. This doc captures the
> config work for when a real second active metro arrives.

## Trigger to pick this up

A second metro sub-cohort is being onboarded **and** it needs at least one of:
different form options, its own Slack/Drive/GitHub, or its own branding. Until
then, everything below stays global and this doc is reference only.

## Current state (until then)

All of the following are **global** — one shared value across metros:

- `option_lists` — registration dropdowns (sectors, work situations,
  neighborhoods, etc.) are one shared set.
- Provisioning targets — pods/projects create Slack channels, Drive folders, and
  GitHub repos under one shared workspace/org/drive.
- Branding — one name, logo, color set, and email sender (The Upskilling Labs).
- (Once `metros.timezone` lands per [`cycle-timeline.md`](./cycle-timeline.md),
  timezone becomes the first genuinely per-metro config value.)

## Config dimensions to make per-metro (when triggered)

Each is independent — adopt only the ones a new metro actually needs.

### 1. Per-metro option lists
- **Why:** chapters in different cities have different valid values (e.g.
  neighborhoods, local sectors).
- **Change:** add `option_lists.metro_id` (nullable → `NULL` means "global
  default", set means "this metro overrides"). Resolution: a metro's effective
  list = its own rows, falling back to global where it has none. Admin UI under
  the metro to edit its lists.
- **Migration:** existing rows stay `metro_id = NULL` (remain global); no data
  moves.

### 2. Per-metro integration / provisioning targets
- **Why:** each chapter may have its own Slack workspace, Google Drive, and
  GitHub org.
- **Change:** a `metro_integrations` config (per metro: Slack workspace/token,
  Drive root folder, GitHub org). Provisioning code reads the **pod's metro**
  (`pods.lab_id`, per `00067`/`00068` — a live open cycle has no lab of its
  own) to decide where to create channels/folders/repos. Secrets handled like
  existing integration credentials (not in the table in plaintext).
- **Risk:** this is the heaviest item — touches every provisioning path and the
  credential model. Scope carefully when it lands.

### 3. Per-metro branding
- **Why:** chapters may present as distinct brands in UI and email.
- **Change:** per-metro `name`, `logo_url`, theme colors, and email sender/from
  address. UI and `lib/email/` read the active metro's branding. Sender domains
  must still be verified in Resend (SPF/DKIM) per metro.

## Out of scope even then

- Cross-metro sharing of option lists/templates (each metro is independent).
- Self-serve metro creation/branding by lab leads — metro creation stays
  admin/owner-only.

## Open decisions (revisit at trigger time)

- **Override vs. replace** for option lists — does a metro's list *extend/
  override* the global defaults (recommended: `metro_id NULL` = fallback) or
  fully replace them?
- **Credential storage** for per-metro Slack/Drive/GitHub — env-based per metro
  vs. a secrets manager; do not store tokens in plaintext columns.
- **Branding granularity** — just logo + sender, or full theming?
