---
slug: ship-fast-break-nothing-how-to-build-with-claude-code-responsibly
title: "Ship Fast, Break Nothing: How to Build with Claude Code Responsibly"
type: post
status: published
date: 2026-03-31
author: Lilah Schaeffer
summary: Claude Code is an extremely capable tool. It will build features, pass tests, and if you ask, run a security audit and tell you the app is production-ready.
source_url: https://theupskillinglabs.org/blog/ship-fast-break-nothing-how-to-build-with-claude-code-responsibly
---

# Ship Fast, Break Nothing: How to Build with Claude Code Responsibly

### The Zero Guardrails Problem

Claude Code is an extremely capable tool. It will build features, pass tests, and if you ask, run a security audit and tell you the app is production-ready.

The problem is that AI executes on what you specify rather than reasoning about what you left out. If you didn't ask for rate limiting, there's no rate limiting. If you didn't specify where API keys should live, they might end up hardcoded in the codebase. If you didn't define how user data should be isolated, one authenticated user might be able to query another's records just by changing an ID in the request. The AI won't flag any of this even though no one would ever want this - not because it can't, but because you didn't ask.

For builders who already know what production-readiness actually requires, Claude Code is extraordinarily powerful. For builders who don't know what to ask for, it will confidently help them build a house of toothpicks.

After 14 months, dozens of apps, and countless production failures, I gave a workshop at The Upskilling Labs on this gap: what AI omits by default, and the explicit instructions and guardrails required to close it. Here's what I shared:

### The Lessons That Stung

Early on, I pushed code to GitHub with API keys sitting right in the codebase. Plain text, publicly visible, committed and live. The AI never said a word because I never said it was a problem.

A few builds later, I hit a different wall. I was testing my own app and suddenly couldn't run another analysis. The free tier had a usage limit. I was the first user. I hit the cap in minutes and locked myself out of my own QA session.

The app was working exactly as designed. I just couldn't use it.

That second one took me longer to figure out, because the problem wasn't a bug, it was a configuration gap. What's correct for a real user in production is actively hostile to you during development. Those two environments need to be set up differently from day one.

Both of these failures share the same root cause: AI will build exactly what you ask for. It won't build what you forgot to ask for.

### What AI Ignores (Unless You Ask)

When I audit a fresh build, I'm not checking whether the features work. The AI already did that. I'm checking the things that get skipped by default:

Cost traps. Without guidance, AI will pick the most capable model regardless of whether your margins can support it. It'll skip caching, meaning every scheduled job re-requests identical data. It won't add rate limits, which leaves you exposed to runaway bills from bots or a single heavy user.

Security gaps. API keys in the codebase. Admin routes with no authentication. Queries without parameterization. These aren't edge cases when you're moving fast, they're defaults.

Infrastructure assumptions. Left to its own devices, AI will scaffold your app with Docker and self-hosted Redis instead of serverless tools with generous free tiers. It'll roll custom authorization instead of using Supabase. These choices cost you unnecessary money and require maintenance that you simply don’t need to be bothered with.

None of this is the AI's fault. It's optimizing for what you specified. The problem is what you didn't specify.

### The Framework I Use on Every Build

I developed a checklist I run twice: at the start of every build as guardrails, and at the end as a final audit. Here's the structure:

#### 1. Lock In Your Stack Before You Build Anything

Tell Claude Code your stack explicitly before you write a single line of feature code. Don't let it assume.

The stack I use for new SaaS apps:

- Supabase for database and authorization
- Vercel for deployment
- Upstash Redis for caching and rate limiting
- Stripe for payments
- Sentry for error monitoring
- Resend for transactional email
Every one of these has a generous free tier and integrates cleanly with the others.

If you don't specify what you want, you'll wind up with a much more cumbersome infrastructure stack that adds complexity without adding value.

#### 2. Run the Security and Cost Audit

Three categories, no exceptions:

Cost: Is the cheapest viable model selected? Is caching implemented? Are rate limits tied to user tiers? Is there a global spend cap that disables AI features if monthly costs hit a threshold?

Security: Are all API keys in environment variables, never in code? Are admin routes protected? Are user operations isolated? Is all input validated?

Reliability: Is there a caching strategy with defined expiration times? Are there fallbacks if an external API goes down? Is error logging active?

#### 3. Separate Your Testing Environment from Production

This is the one most builders skip until they get burned by it.

Your production configuration, ie. usage limits, rate limits, tier checks, is designed to protect your business from real users. It will also block you from testing your own app.

The fix is straightforward: add a TESTING_MODE=true environment variable that bypasses tier checks in development. Whitelist your test account. Disable rate limits locally. Make this separation explicit before you start QA, not after you've already hit your own limits.

And check third-party integrations early. If your email service isn't configured, your authentication flow won't work, and you won't know why until you've lost an hour chasing the wrong problem.

#### 4. The Pre-Launch Non-Negotiables

Before opening to real users, four things need to be in place:

- Disability accessibility (WCAG compliance) — required by law in many jurisdictions; Claude Code can audit and help with this
- Legal pages — Terms & Conditions, Privacy Policy, and any disclaimers specific to your app's domain
- Lighthouse CI — monitors Core Web Vitals and prevents performance regressions that hurt SEO
- Schema markup — ask Claude to implement structured data before launch

### The Real Insight

Fourteen months in, here's what I know: simple English prompts produce prototype code. Deliberate, structured prompting produces a profitable business.

The non-technical builder who specifies their stack, runs the checklist, and prompts with intention will ship something more secure and more cost-efficient than the engineer who trusts AI defaults.

The constraint isn't whether you can build anymore. It's whether you know what to ask for.
