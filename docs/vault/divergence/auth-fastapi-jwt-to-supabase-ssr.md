---
title: Auth: FastAPI JWT in the spec, @supabase/ssr cookies in the build
date: 2026-05-09
status: accepted
kind: divergence
tags: [spec-divergence, auth]
related: ["[[ADR-0002-resend-http-api-for-invitations]]"]
---

# Auth: FastAPI JWT in the spec, `@supabase/ssr` cookies in the build

> Backfilled 2026-09-12 from `docs/OLOS-roadmap.md` §6 rows §1.6 and §1.7 as the first
> worked example in this vault.

## What the spec says

`TUL_MVP_Spec.md` describes a separate FastAPI backend issuing and validating JWTs, and
Supabase magic-link OTP for invitation email.

## What the build does instead

There is no separate backend service. Server logic lives in Next.js route handlers under
`app/api/**` and in server components, with auth as a `@supabase/ssr` session cookie plus
per-request role resolution, gated by the edge middleware in `proxy.ts`. Invitations go
out through the Resend HTTP API on a custom token flow.

A related deviation: a signed-in user with no `participants` row is redirected to
`/register` rather than 404'd (issue #63, ratified 2026-05-08), kept for UX and privacy
reasons.

## Why it moved

The stack pivoted from FastAPI to Next.js, which removed the service that would have
issued the JWTs. The email half is recorded separately in
[[ADR-0002-resend-http-api-for-invitations]].

## Is the spec now wrong, or is the build?

**The spec is wrong and stays as historical intent.** `TUL_MVP_Spec.md` is not being
amended; [`lib/auth/CLAUDE.md`](../../../lib/auth/CLAUDE.md) is authoritative for auth,
and `docs/OLOS-roadmap.md` §6 already carries a staleness warning pointing readers at
`docs/audit/` instead.

## Downstream effects

Every part of the spec that assumed a FastAPI service is off by the same pivot, not just
auth. Treat spec references to backend endpoints as describing intent, not routes.
