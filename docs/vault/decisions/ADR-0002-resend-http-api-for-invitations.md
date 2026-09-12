---
title: Invitation email goes through the Resend HTTP API, not Supabase SMTP
date: 2026-05-08
status: accepted
kind: decision
tags: [auth, email]
related: ["[[auth-fastapi-jwt-to-supabase-ssr]]"]
---

# Invitation email goes through the Resend HTTP API, not Supabase SMTP

> Backfilled 2026-09-12 from `docs/OLOS-roadmap.md` §6 rows §1.7 and §1.8 as the first
> worked example in this vault. `lib/auth/CLAUDE.md` remains authoritative for the flow
> as implemented.

## Context

`TUL_MVP_Spec.md` assumed Supabase magic-link OTP for invitations. The bulk-invite
requirement (roadmap §1.8) needed to send to a full cohort in one run.

## Options considered

| Option | Why it was attractive | Why not |
|---|---|---|
| Supabase magic-link OTP | In the spec; no extra vendor | Free-tier auth-email throttle blocks a bulk fan-out |
| Supabase SMTP relay with a custom provider | Keeps auth email inside Supabase | Same throttle path; no gain over calling the provider directly |
| Resend HTTP API with a custom token flow | No auth-email throttle; full control of template and sender | A second identity surface to secure; tokens are ours to expire |

## Decision

Invitations are sent directly through the Resend HTTP API using a custom token flow, not
Supabase magic-link OTP. Ratified 2026-05-08 (issue #64).

## Why

The deciding constraint was the Supabase free-tier auth-email rate limit, which would
have made the bulk invite impossible rather than merely slow. Note the shape of this
constraint: it is a **plan tier**, so moving off the free tier would reopen the question.
It has not been reopened because the custom token flow also gave control over sender
identity and template, which the OTP path did not.

## Consequences

- Domain `enroll.theupskillinglabs.org` has to stay verified (SPF, DKIM, DMARC).
- Token issuance, expiry, and single-use are ours to enforce, not Supabase's.
- `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are required env vars in every environment that sends.
- Unblocked the bulk-invite script at `scripts/ops/send-bulk-invites.ts`.

## Links

- Spec this departs from: `TUL_MVP_Spec.md`, invitation flow
- Divergence note: [[auth-fastapi-jwt-to-supabase-ssr]]
- Authoritative implementation doc: [`lib/auth/CLAUDE.md`](../../../lib/auth/CLAUDE.md)
- Issues #45, #64; PRs #60, #68, #70
