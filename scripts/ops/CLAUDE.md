# scripts/ops/ — operational scripts

Scope: this file applies to anything under [scripts/ops/](.) — one-shot or
ad-hoc Node/TypeScript scripts that run against a live Supabase project.
Distinct from [scripts/migration/](../migration/) (Python, legacy spreadsheet
→ Postgres) and [supabase/migrations/](../../supabase/migrations/) (DDL).

Roadmap anchor: [§1.8](../../docs/OLOS-roadmap.md). The first script in this
folder — `send-bulk-invites.ts` — closes Issue #46.

---

## Stack: Node + TypeScript via tsx

These scripts call the same Resend HTTP API and the same `invitations` /
`cycle_enrollments` shapes as the Next.js app, so they share the app's
TypeScript code and dependencies. Reusing the app's
[`lib/email/invitation-template.ts`](../../lib/email/invitation-template.ts)
keeps the bulk path and the per-row admin send (POST
`/api/invitations/{id}/send`) from drifting on subject line, layout, or
copy.

Run with [`tsx`](https://tsx.is) — no compile step, respects the repo
`tsconfig.json` paths (`@/*`), and forwards Node's `--env-file` flag so
`.env.local` loads without a bespoke parser.

```bash
npx tsx --env-file=.env.local scripts/ops/send-bulk-invites.ts --help
```

`tsx` is not in `package.json` — `npx` fetches it on first run. That's
intentional: ops scripts are infrequent operator runs, not part of CI.

---

## Safety contract

Mirrors [scripts/migration/CLAUDE.md §"Looking ahead: ISSUE-W1-004"](../migration/CLAUDE.md).
Items marked **[required]** are non-negotiable; everything else is style
guidance for future scripts in this folder.

### [required] Dry-run by default

Default mode prints the plan with no side effects. `--commit` is required to
write or send. The flag asymmetry is deliberate — accidentally typing
`--commit` is harder than accidentally omitting `--dry-run`.

### [required] Connection-string guard

Inspect `NEXT_PUBLIC_SUPABASE_URL` before any work. If the host contains the
production project ref (`cethihabtddiujzayaxe`), require `--prod` to proceed
*and* — for `--commit` — a typed cycle-name confirmation read from stdin.
The interactive prompt is the last line of defence against a misfired batch
on prod. Do not delegate this to operator discipline.

The reverse also holds: passing `--prod` against a non-prod URL aborts. The
two flags must agree.

### [required] Never log PII

Logs go to terminals, terminals go to screenshots, screenshots leak. Log
indices (`[3/19]`), IDs (`participant_id=14 invitation_id=22`), counts, and
outcomes. **Never** log full email addresses, names, free-text fields, or
row dumps. The participant join is needed to *do* the work; the log is for
operators to follow progress, not for auditing identities.

If you genuinely need a per-recipient debug trail, write it to a file with
explicit operator opt-in (e.g. `--debug-log path.jsonl`) — never to stdout.

### [required] Idempotency

Re-running with the same arguments must not double-send. For the invitation
flow, the duplicate key follows `app/api/invitations/route.ts:54-81` —
`(email, cycle_id, role_preset=null)` for non-expired pending invites. The
bulk script defaults to skipping rows that match; `--include-pending`
overrides for the rare re-send case.

Idempotency is keyed on **pending bulk invites only**. Already-accepted
invites do not block a new bulk send — accepting an extra bulk invite for an
already-enrolled participant is materially a no-op (`fulfillInvitation()`
with all NULL grant fields just marks the invitation accepted).

### [required] Fail-loud, log-soft

Per-row failures append to an outcomes array and the run continues. The
final summary names every failed row by `participant_id` + phase
(`insert` / `send` / `update`) + error message. Process exits non-zero if
any failure occurred so CI / shell pipelines notice.

### Rate limit awareness

Resend free tier: 100 emails/day, 3000/month, 1 verified domain. For the
~30-row Wave 1 cohort, no throttle is needed; the script still inserts a
200ms per-row delay so a future 500-row batch stays polite. If the cohort
grows past the daily cap, the script needs to learn `--resume-from`; for
now, that's deferred (operator can re-run with `--limit` + an offset).

---

## Stack reality vs. roadmap wording

[Issue #46](https://github.com/TheUpskillingLabs/OLOS/issues/46) says
"script at `/scripts/ops/send_magic_links.py`" — Python, snake_case. The
shipped script is `send-bulk-invites.ts` — Node/TypeScript, kebab-case. Two
reasons:

1. **Reusing the email template.** The Resend dispatch path is in
   TypeScript at [`lib/email/`](../../lib/email/). A Python script would
   either re-implement the template (drift risk on subject + body) or shell
   out to Node (worse). TypeScript here keeps the bulk path and the admin
   per-row path on one template.
2. **Python in this repo is a one-shot escape hatch.** The
   [scripts/migration/CLAUDE.md](../migration/CLAUDE.md) folder uses
   Python because `pandas` + `openpyxl` read `.xlsx`; ops work against
   Postgres + Resend HTTP is exactly what the app stack does.

The issue's other architectural pointer — "Supabase Admin API: POST
`/auth/v1/admin/generate_link`" — is also wrong. That's the Supabase
magic-link OTP path that [#64](https://github.com/TheUpskillingLabs/OLOS/issues/64)
ratified the codebase off (free-tier auth-email throttle would block bulk
fan-out). The bulk script reuses the custom-invitation flow described in
[`lib/auth/CLAUDE.md §Invitation flow`](../../lib/auth/CLAUDE.md).

---

## Active script: `send-bulk-invites.ts` (#46)

### Behavior summary

1. Validate args + env. Detect prod via the `NEXT_PUBLIC_SUPABASE_URL`
   host; require `--prod` if it's prod.
2. Verify the cycle exists. Print the plan (PII-free).
3. Fetch active `cycle_enrollments` for the cycle, joined with
   `participants`. Filter by `--only-email` if set.
4. Annotate each row with `has_auth_user`, `has_live_pending_invite`,
   `has_accepted_invite` for that cycle.
5. Apply `--limit`.
6. Print plan summary by `participant_id` (no emails).
7. If `--commit`: prompt for cycle-name confirmation on prod; then per row:
   insert `invitations` row (bulk shape — `cycle_id` set, everything else
   NULL/empty), dispatch via Resend, update `email_sent_at`, append to
   outcomes. 200ms delay between sends.
8. Print run summary. Exit non-zero on any failure.

The "bulk shape" — `pod_id` / `permissions` / `role_preset` NULL/empty —
matters because `fulfillInvitation()` in
[`/api/auth/callback`](../../app/api/auth/callback/route.ts) will upsert
*nothing material* for those fields. The bulk invite is a click-tracked
"sign in" entry point, not a permission grant. Participants are already
enrolled.

### CLI

| Flag | Default | Notes |
|---|---|---|
| `--cycle-id <n>` | required | positive integer; must exist in `cycles` |
| `--dry-run` | on | no DB writes, no emails |
| `--commit` | off | required to fire |
| `--prod` | off | required when SUPABASE_URL is prod |
| `--limit <n>` | none | cap rows processed (after `--only-email` filter) |
| `--only-email <addr>` | none | restrict to one address (sanity tests) |
| `--include-pending` | off | do not skip rows with live pending bulk invite |
| `--app-url <url>` | env / `https://olos.theupskillinglabs.org` | magic-link host |

### Test plan (executed for #46)

1. **Dry-run on prod** — `--cycle-id 1 --dry-run --prod`. Verify counts
   match `select count(*) from cycle_enrollments where cycle_id = 1 and
   status = 'active'`.
2. **Single-recipient sanity send** — `--cycle-id 1 --commit --prod
   --only-email <addr>`. Confirm: invitation row inserted, `email_sent_at`
   populated, email arrives in inbox, link works, `fulfillInvitation()`
   no-ops gracefully (participant already enrolled).
3. **Re-run idempotency** — same command. Should be skipped as "live
   pending bulk invite already exists".
4. **Full run** — held pending operator decision (see Open question below).

### Open question: full-cohort fan-out timing

The 19 active enrollments on `cycle_id=1` ("Spring 2026 Build Cycle") are
pre-existing rows (early adopters + manual seeds), not the migrated cohort
the issue text assumes. `§1.5` (production migration) hasn't run yet, so
the "migrated participant list" doesn't exist. Three options:

- (a) Run the full batch against the 19 rows now and treat #46 as done.
- (b) Hold the full batch until `§1.5` finishes and the real cohort lands.
- (c) Ship the script + dry-run verification; defer the full batch to a
  separate operator-triggered run.

**Status:** (c) — script shipped + verified via prod dry-run + single-recipient
sanity send. Full cohort fan-out is deferred until the §1.5 migration
produces the real population. Re-run against `cycle_id=1` (or whichever
cycle holds the migrated cohort) when that lands.

---

## Looking ahead

Other ops scripts that may grow this folder. Linked here so future sessions
can plan ahead, not act ahead.

- **Bulk pod assignment** (post-§2.x): assign participants to pods based on
  ranked-choice resolution (pending D1).
- **Pulse-check reminder send**: re-engage participants who haven't filed
  the current cycle's pulse. Same Resend path, different template.
- **Data export to operator dashboards**: CSV / Sheets dumps of cycle
  activity — read-only, but PII-heavy, so the same `[required] Never log
  PII` rule applies (write to file, never stdout).

If any of these grow past a one-off, consider whether they belong as a
worker / cron route in [`app/api/`](../../app/api/) instead. The folder is
for *operator-triggered* scripts, not background jobs.
