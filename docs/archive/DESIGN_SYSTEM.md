> **📁 ARCHIVED — historical record.** OLOS design system v1.0 (May 2026) — the dark theme, retired 2026-07-03 when the light "warm-paper" system landed. The live design system is the token layer in `app/globals.css` plus `app/components/ui/*`. See [docs/EVOLUTION.md](../EVOLUTION.md) for the full story of how the app got here.

# OLOS Design System

> **⚠ Superseded (July 2026):** the design source of truth is now the
> `onboarding-proto` repo (light-first, warm paper, Geologica, one 14px
> radius). Its tokens and component layer live in `app/globals.css`, and
> every surface has been reskinned to it — the dark theme described below
> no longer exists in the app. The staged translation is tracked in
> `docs/PROTO_TRANSLATION_PLAN.md`. This document is pending a full rewrite
> from the shipped system; until then everything under this note is
> historical reference only.

**Product:** OLOS — operating system for The Upskilling Labs
**Stack:** Next.js 16 (App Router) · Tailwind CSS v4 · Supabase · Vercel
**Design language:** The Upskilling Labs brand × iOS Human Interface Guidelines
**Theme:** Dark, immersive, professional
**Last updated:** April 2026

---

## 1. Design philosophy

OLOS is the coordination layer for a 13-week Build Cycle that turns career-changers into people who have shipped real projects. The interface should feel like a tool a serious person would be proud to use — closer to a well-designed dev tool or fintech dashboard than a learning management system.

Three principles guide every decision:

**Clarity over decoration.** Every element earns its space. If it doesn't help a participant submit a proposal, vote, complete a pulse check, or run their pod — it gets cut. Information density is fine; visual noise is not.

**One primary action per screen.** Each surface has a single most-important thing the user might do. The CTA's color, weight, and position make that obvious. Secondary actions step back visually.

**Native feel.** OLOS should feel native — not like a website. iOS-quality motion, spring animations, drag gestures where appropriate, haptic-style press feedback, SF Symbols–style iconography. The fact that it runs in a browser should be invisible.

---

## 2. Brand foundation

OLOS inherits The Upskilling Labs' brand system from `[brandkit.theupskillinglabs.org](http://brandkit.theupskillinglabs.org)` and extends it with dark-UI–specific tokens.

### Brand colors

| Name | Hex / value | Role |
|---|---|---|
| **Midnight** | `#0b1016` | Primary dark surface, app background |
| **Ink** | `#0e1520` | Slightly elevated dark surface (modals, sticky header occlusion) |
| **Primary teal** | `#0094a0` | Primary brand color, primary CTAs, active states |
| **Aqua** | `#4dbbc2` | Accent, foreground on teal-tinted surfaces, highlights |
| **Shadow teal** | `#006b73` | Pressed states on teal, dark teal accents |
| **Brand red** | `#ee1c25` | Destructive only — delete, revoke, error |
| **Crimson** | `#7a0f14` | Pressed state for destructive buttons |
| **Cloud** | `#e6e6e6` | Primary text |
| **Ghost** | `#ffffff` | High-emphasis text, page titles, key numbers |

Defined as Tailwind tokens in `app/globals.css` via `@theme inline`. Use the names directly: `bg-teal`, `text-aqua`, `border-whisper`.

### Surfaces (layered transparency)

The load-bearing pattern of the dark UI. Surfaces aren't custom dark colors — they're stacked rgba whites at low opacity over the midnight base. This is what makes the UI feel like depth rather than flatness.

| Token | Class | Use |
|---|---|---|
| Base | (none — body bg) | App background |
| Surface 1 | `bg-white/[0.02]` | Default card |
| Surface 2 | `bg-white/[0.04]` | Card hover, table header, input bg |
| Surface 3 | `bg-white/[0.06]` | Active row, future-week timeline boxes |
| Surface 4 | `bg-white/[0.08]` | Pressed state on plain surfaces |

**Rule:** never use a custom dark hex where a layered transparency works. The body has a radial teal gradient that shifts perceived background color across the viewport — solid color bands will be visible. Transparency lets the gradient through.

Exceptions:
- Modals use `bg-ink` (#0e1520) so they feel above the page
- Sticky header uses `bg-[rgba(11,16,22,0.97)]` for opacity to occlude scrolling content

### Borders & hairlines

| Token | Class | Use |
|---|---|---|
| Whisper | `border-whisper` (rgba 0.07) | Default card borders, table dividers |
| Subtle | `border-white/[0.10]` | Form input borders |
| Visible | `border-white/[0.12]` | Card hover state, decorative dividers |
| Strong | `border-white/[0.18]` | Rarely — focused emphasis |
| Hairline | `border-white/[0.06]` (used as 0.5px equivalent) | iOS-style table dividers |

Borders strengthen on hover, not at rest. This is what creates the lift sensation.

### Text hierarchy

| Token | Class | Use |
|---|---|---|
| High emphasis | `text-white` / `text-ghost` | Page titles, key numbers, important values |
| Body | `text-cloud` | Default body text, list items, button labels |
| Secondary | `text-cloud/60` | Helper text, descriptions, metadata |
| Muted | `text-cloud/50` or `text-cloud/40` | Timestamps, low-priority labels |
| Tertiary | `text-cloud/30` | Disabled states, decorative |
| Placeholder | `placeholder:text-cloud/40` | Form input placeholders |

**Accessibility floor:** never use `text-cloud/40` or below for actionable text. Buttons, links, errors, validation must use `text-cloud` or stronger.

### Tinted surfaces (state coloring)

For non-neutral states, use brand colors at low opacity over the dark base. The pattern repeats: tinted bg + brighter shade as foreground text.

```
bg-teal/[0.04]    → active/selected card background
bg-teal/10        → success banner, info banner
bg-teal/20        → primary action badge, "active" status — text-aqua
bg-red/[0.04]     → subtle error outline
bg-red/10         → error banner
bg-red/20         → revoked status — text-red-300
bg-yellow-500/[0.06] → warning banner
bg-yellow-500/10  → pulse check pending
bg-yellow-500/20  → draft/pending — text-yellow-300
```

When introducing a new tinted surface, follow the same pattern: 15–20% opacity bg with the brighter `-300` shade as foreground text.

### Color application rules

**Brand red is sacred.** Reserved for destruction (delete, revoke) and error states. Never use red for "remove" if the action is reversible — that's a secondary outline button. Red implies the action ends in data loss or access removal.

**Teal is the system color.** Used for primary CTAs, active states, success, and the accent rhythm throughout the product. Aqua is the brighter foreground variant used as text on teal-tinted surfaces and for hover highlights on links.

**Yellow is rare on purpose.** Reserved for warnings, pending states, and the Owner role badge. Overuse devalues the signal.

**Purple and blue** appear only in admin role badges (Developer, Moderator). Don't introduce them anywhere else.

---

## 3. Typography

### Font

**Geologica** (Google Fonts), weights 300, 400, 600, 700. Loaded with `font-display: swap`.

**Fallback stack:** `'Geologica', -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif`

The fallback to SF Pro ensures the app feels native on macOS Safari and iOS even if Geologica fails to load.

### Type scale

| Element | Class pattern | Weight | Tracking |
|---|---|---|---|
| Hero headline | `text-[clamp(2.25rem,5vw,4.5rem)] leading-[1.08] text-white` | 700 | `tracking-tight` |
| Page title | `text-2xl text-white` | 700 | `tracking-tight` |
| Section heading | `text-lg text-white` | 600 | default |
| Subsection | `text-sm text-cloud` | 600 | default |
| Eyebrow / overline | `text-sm uppercase tracking-widest text-cloud/40` | 500 | `tracking-widest` |
| Brand label | `text-xs uppercase tracking-[0.25em] text-teal` | 600 | extra-wide |
| Body | `text-sm text-cloud` (line-height 1.6) | 400 | default |
| Helper | `text-sm text-cloud/60` | 400 | default |
| Caption | `text-xs text-cloud/50` | 400 | default |
| Button label | `text-sm` | 600 | `tracking-tight` |
| Stat number | `text-3xl text-white` or `text-4xl text-white` | 700 | `tracking-tight` |
| Code / monospace | `font-mono text-sm` | 400 | default |

### Typography rules

- **Tight tracking on display text.** All display sizes (`text-2xl` and above) use `tracking-tight`. Mimics SF Pro Display's compressed feel.
- **Tabular numerals everywhere numbers move.** `tabular-nums` on metric displays, vote counts, week numbers, dates, timer countdowns. Prevents layout shift.
- **Line-height 1.6 on body.** Tighter (1.2–1.4) on display headings.
- **Antialiasing always:** `-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale`.
- **Sentence case dominates.** Uppercase tracking reserved for small eyebrow labels and brand marks.
- **No bold body text.** Use color contrast or surface differentiation. Bold belongs to headings and key metric values.
- **Italic** reserved for tagline use (e.g., "fork + foray") and inline emphasis within scripts.

---

## 4. Spacing & layout

### Container widths

| Pattern | Max width | Use |
|---|---|---|
| Form-centric | `max-w-2xl` (672px) | Single-column proposal forms, settings |
| Standard page | `max-w-5xl` (1024px) | Dashboard, cycle detail, pod detail |
| Wide page | `max-w-7xl` (1280px) | Admin tables, dense data views |
| Full bleed | `w-full` | Login hero, timeline component |

All centered with `mx-auto`. Responsive horizontal padding: `px-4 sm:px-6 lg:px-8`.

### Vertical rhythm

Built on a 4px / `0.25rem` grid.

| Use | Class |
|---|---|
| Tight inline gap | `gap-1` (4px) or `gap-2` (8px) |
| Component internal | `p-3` or `p-4` (12–16px) |
| Card default | `p-4` (16px) |
| Card spacious | `p-6` (24px) |
| Section spacing | `space-y-6` or `space-y-8` (24–32px) |
| Major breaks | `space-y-12` (48px) |
| Page top padding | `pt-8` or `pt-12` |

### Border radius

iOS-style continuous corner system. Default everywhere is `rounded-md`.

| Token | Class | Use |
|---|---|---|
| Small | `rounded` (4px) | Tags, small badges, table cells |
| Default | `rounded-md` (6px) | Cards, inputs, buttons |
| Larger | `rounded-lg` (8px) | Modals, prominent cards |
| Pill | `rounded-full` | Status pills, avatar wrappers, hero CTAs |

### Touch & hit targets

- **Minimum:** 44×44px on touch devices (Apple HIG)
- **Default button:** ~36px height with `px-4 py-2 text-sm`
- **Small action buttons** in tables: ~28px tall — bump padding on mobile to hit 44px
- **Spacing between tappable elements:** at least 8px to prevent mis-taps

### Grid patterns

```
Stat card row:           grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4
Two-column dashboard:    grid grid-cols-1 lg:grid-cols-3 gap-6
Side-by-side form fields: grid grid-cols-1 sm:grid-cols-2 gap-4
```

Two-column dashboards typically use `lg:col-span-2` for main content and `lg:col-span-1` for sidebar.

### Responsive breakpoints

OLOS is desktop-first but must work on mobile.

| Token | Min width | Use |
|---|---|---|
| `sm` | 640px | Two-column form fields, simple grids |
| `md` | 768px | Side-by-side cards, condensed nav |
| `lg` | 1024px | Two-column dashboard, full nav, dense tables |
| `xl` | 1280px | Wide admin tables, multi-column dashboards |

Mobile patterns:
- Tables → stacked cards below `md`
- Multi-column grids → single column below `sm`
- Sticky header collapses to hamburger below `md`
- Bottom action bar for mobile forms (fixed-position primary CTA)
- Timeline scrolls horizontally rather than truncating

---

## 5. Elevation & shadows

In dark UI, shadows are mostly invisible. **Use border opacity and surface opacity to create elevation**, not shadows.

Reserved exceptions where shadows are appropriate:
- Login hero CTA glow (decorative)
- Modals (subtle outer shadow + elevated surface color)
- Current week box on the timeline (teal glow)
- Active/running primary CTA (subtle teal glow)

Shadow tokens for these cases:

```css
/* Card / button rest — usually none */

/* Hover lift on interactive cards — via border + bg, not transform */
hover:border-white/[0.12] hover:bg-white/[0.04]

/* Modal */
shadow-2xl + bg-ink

/* Hero CTA glow on hover */
hover:shadow-[0_0_24px_rgba(77,187,194,0.18)]

/* Primary teal CTA */
shadow-[0_1px_4px_rgba(0,148,160,0.2)]

/* Primary red CTA (rare) */
shadow-[0_2px_8px_rgba(238,28,37,0.18),0_8px_24px_rgba(238,28,37,0.18)]

/* Active week / "live now" indicator */
shadow-[0_0_24px_rgba(77,187,194,0.4)]
```

**Don't use `transform: translateY` lifts on hover.** They feel cheap on dark UI. Surface elevation through opacity is more refined.

---

## 6. Motion & animation

OLOS motion follows iOS spring physics — overshoot, settle, crisp deceleration. Defined as Tailwind extensions:

```ts
// tailwind.config.ts
extend: {
  transitionTimingFunction: {
    'spring': 'cubic-bezier(0.32, 0.72, 0, 1)',
    'out': 'cubic-bezier(0.25, 0.1, 0.25, 1)',
  }
}
```

Then use `ease-spring` or `ease-out` directly in classes.

### Duration tokens

| Action | Duration class | Use |
|---|---|---|
| Hover color/bg | `duration-150` | All button and card hovers |
| Default state change | `duration-300` | Most expansions, drawer open/close |
| Sheet slide | `duration-500` | Modal/drawer slide-in (with `ease-spring`) |
| Progress fills | `duration-500` | Wizard progress bar |
| Pulse cycle | 1.4s loop | Live indicators (`animate-pulse` or custom) |

### Press states

Every interactive element implements iOS-correct press feedback:

```css
/* Default button */
.btn:active { transform: scale(0.96); }

/* Large buttons */
.btn-lg:active { transform: scale(0.985); }
```

Smaller buttons compress more, larger ones less — matches how iOS scales proportionally.

In Tailwind:
```
active:scale-[0.96] transition-transform duration-150 ease-spring
```

### Tap highlight reset

Apply globally:
```css
* {
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
}
button { touch-action: manipulation; }
```

This eliminates the default mobile blue flash and the 300ms tap delay.

### Animated patterns

**Pulse dot** for live indicators (used in nav active state, "voting open now," timeline current week):
```html
<span class="relative flex h-2 w-2">
  <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-75"></span>
  <span class="relative inline-flex h-2 w-2 rounded-full bg-aqua"></span>
</span>
```

**Spinner:**
```html
<div class="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-teal"></div>
```

**Skeleton** (preferred over spinner for known-shape content):
```
animate-pulse rounded-md bg-white/[0.04]
```
Set explicit `h-*` and `w-*` matching final content shape.

**Drawer / accordion expand:**
Use CSS `grid-template-rows: 0fr → 1fr` transition, or `transition-[max-height]` with a known max.

### Reduced motion

Always respect:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### What to avoid

- **No bouncing entrances.** This isn't a marketing site.
- **No scroll-triggered fade-ins.** They make the app feel slow.
- **No parallax.**
- **No emoji decoration.** Use icons or color, never 🎉.

---

## 7. Iconography

Use **Lucide React** (`lucide-react`). MIT-licensed, tree-shakeable, line-weight matches the rest of the system.

### Style guidelines

- **Stroke-based**, not filled (matches SF Symbols aesthetic)
- **Stroke caps:** `round`
- **Stroke joins:** `round`
- **Default weight:** Lucide's stock weight is fine — don't override per-icon

### Sizing

| Context | Class |
|---|---|
| Inline with text | `h-4 w-4` (16px) |
| Button leading icon | `h-4 w-4` |
| Card / banner icon | `h-5 w-5` (20px) |
| Empty state | `h-12 w-12` |
| Hero / decorative | `h-16 w-16` or larger |

### Color

Icons inherit `currentColor`. Set color on the parent text element.

When an icon needs explicit color (e.g., warning icon in a banner):
```html
<AlertTriangle class="h-5 w-5 text-yellow-300 flex-shrink-0" />
```

Always include `flex-shrink-0` on icons inside flex containers.

### Common icon mappings

| Concept | Lucide icon |
|---|---|
| Add / new | `Plus` |
| Edit | `Pencil` |
| Delete / revoke | `Trash2` |
| External link | `ExternalLink` |
| Back / previous | `ChevronLeft` |
| Next / forward | `ChevronRight` |
| Expand | `ChevronDown` |
| Close | `X` |
| Warning | `AlertTriangle` |
| Success | `CheckCircle2` |
| Error | `XCircle` |
| Info | `Info` |
| Calendar / cycle | `Calendar` |
| Pulse check | `Activity` |
| Pod / team | `Users` |
| User | `User` |
| Search | `Search` |
| Settings | `Settings` |
| Menu | `Menu` |

---

## 8. Component library

### Buttons

**Primary (main CTA):**
```
bg-teal px-4 py-2 text-sm font-medium text-white rounded-md
hover:bg-teal/80
active:scale-[0.97]
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight
disabled:cursor-not-allowed disabled:opacity-50
transition-all duration-150 ease-spring
```

**Primary on dark glow surfaces (login, hero):**
```
bg-aqua text-midnight hover:bg-teal
```

**Secondary / outline:**
```
text-cloud/60 ring-1 ring-whisper px-4 py-2 text-sm font-medium rounded-md
hover:bg-white/[0.04] hover:text-cloud hover:ring-white/[0.12]
active:scale-[0.97]
transition-all duration-150 ease-spring
```

**Destructive:**
```
bg-red text-white px-4 py-2 text-sm font-medium rounded-md
hover:bg-crimson
active:scale-[0.97]
transition-all duration-150 ease-spring
```

**Small action (inline within tables, cards):**
```
rounded bg-teal/20 px-3 py-1 text-xs font-medium text-aqua
hover:bg-teal/30
active:scale-[0.96]
transition-all duration-150
```

**Ghost (lowest emphasis):**
```
text-cloud/60 px-3 py-2 text-sm font-medium rounded-md
hover:bg-white/[0.04] hover:text-cloud
transition-colors duration-150
```

**Hero CTA (login page only):**
```
rounded-full border border-white/[0.12] bg-white/[0.04] px-8 py-4 text-base font-medium text-white
hover:shadow-[0_0_24px_rgba(77,187,194,0.18)]
active:scale-[0.98]
transition-all duration-300 ease-spring
```

**Sizing variants:**
- Default: `px-4 py-2 text-sm` (~36px tall)
- Small: `px-3 py-1.5 text-xs` (~28px tall)
- Large: `px-6 py-3 text-base` (~48px tall, sparingly)

### Form inputs

**Text input / textarea / select:**
```
w-full rounded-md border border-white/[0.10] bg-white/[0.04]
px-3 py-2 text-sm text-white placeholder:text-cloud/40
focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal
disabled:cursor-not-allowed disabled:opacity-50
transition-colors duration-150
```

**Textarea:** add `resize-none` and explicit `rows={N}`.

**Select:** wrap with custom chevron icon positioned absolutely (`appearance-none` on the select).

**Field anatomy:**
```html
<div class="space-y-1.5">
  <label class="block text-sm font-medium text-cloud">
    Field name <span class="text-red">*</span>
  </label>
  <input class="..." />
  <p class="text-xs text-cloud/60">Helper text.</p>
</div>
```

When in error state, replace helper with:
```html
<p class="text-xs text-red-300">Specific error message.</p>
```

And add to the input:
```
border-red/50 focus:border-red focus:ring-red
```

**Checkbox / radio:**
```
h-4 w-4 rounded border-white/[0.20] bg-white/[0.04]
text-teal focus:ring-teal focus:ring-offset-0 focus:ring-offset-midnight
```

Radio uses `rounded-full` instead of `rounded`.

**Field grouping:** wrap each label + input + helper/error in `space-y-1.5`. Stack fields with `space-y-4` or `space-y-5`. Pair side-by-side fields with `grid grid-cols-1 sm:grid-cols-2 gap-4`.

### Cards

**Default card:**
```
rounded-md border border-whisper bg-white/[0.02] p-4
```

**Interactive card (hoverable):**
```
rounded-md border border-whisper bg-white/[0.02] p-4
hover:border-white/[0.12] hover:bg-white/[0.04]
transition-colors duration-150 cursor-pointer
```

**Active / selected card:**
```
rounded-md border border-teal/30 bg-teal/[0.04] p-4
```

**Stat card:**
```html
<div class="rounded-md border border-whisper bg-white/[0.02] p-6">
  <div class="text-xs uppercase tracking-widest text-cloud/40 mb-2">
    Active pods
  </div>
  <div class="text-3xl font-bold text-white tabular-nums">12</div>
  <div class="mt-2 text-xs text-cloud/60">+2 this week</div>
</div>
```

### Status badges

| State | Pattern |
|---|---|
| Active | `bg-teal/20 text-aqua` |
| Forming | `bg-teal/10 text-teal` |
| Inactive / closed | `bg-white/10 text-cloud/60` |
| Draft / pending | `bg-yellow-500/20 text-yellow-300` |
| Revoked / error | `bg-red/20 text-red-300` |
| Success | `bg-teal/20 text-aqua` |

**Base:**
```
inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium
```

For badges with a status dot, prepend:
```html
<span class="h-1.5 w-1.5 rounded-full bg-[matching color]"></span>
```

### Role badges (admin only)

| Role | Pattern |
|---|---|
| Owner | `bg-yellow-500/15 text-yellow-300` |
| Admin | `bg-teal/15 text-aqua` |
| Developer | `bg-purple-500/15 text-purple-300` |
| Moderator | `bg-blue-500/15 text-blue-300` |
| Observer | `bg-white/10 text-cloud/60` |

These are the only places purple and blue appear. Don't introduce them elsewhere.

### Tables

**Container:**
```
overflow-hidden rounded-md border border-whisper
```

**Table:** `w-full text-sm`
**Thead:** `bg-white/[0.04]`
**Th cells:** `px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-cloud/60`
**Tbody:** `divide-y divide-whisper`
**Tr (interactive):** `hover:bg-white/[0.02] transition-colors duration-150`
**Td cells:** `px-4 py-3 text-sm text-cloud`

**Alternate teal-themed table** (used for "active set" views like pod detail):
```
thead: bg-teal/[0.08]
th: text-aqua (instead of text-cloud/60)
```

Use only when the table represents the currently active context, not for general data.

**Mobile fallback:** below `md`, transform to stacked cards. Each row becomes a card with label/value pairs.

### Banners / alerts

**Base banner:**
```
flex items-start gap-3 rounded-md border p-4
```

| Type | Border + bg |
|---|---|
| Warning | `border-yellow-500/30 bg-yellow-500/[0.06]` |
| Success | `border-teal/20 bg-teal/10` |
| Error | `border-red/20 bg-red/10` |
| Info / active | `border-teal/20 bg-teal/[0.04]` |

**Inside the banner:**
- Icon at top-left in matching color, `h-5 w-5 flex-shrink-0`
- Title in matching color, weight 600, text-sm
- Body in `text-cloud/80` text-sm
- Optional dismiss button at top-right (ghost style)

### Loading states

**Spinner:**
```
animate-spin rounded-full border-2 border-white/10 border-t-teal
```

Sizes: `h-4 w-4` (inline), `h-6 w-6` (button), `h-8 w-8` (page-level), `h-12 w-12` (centered).

**Skeleton:**
```
animate-pulse rounded-md bg-white/[0.04]
```

**Button loading:** replace text with spinner; add `min-w-[N]` to maintain width.

### Empty states

```
flex flex-col items-center justify-center rounded-md border border-dashed border-whisper bg-white/[0.01] p-12 text-center
```

Inside:
- Optional icon at `h-12 w-12 text-cloud/30 mb-4`
- Title: `text-lg font-semibold text-cloud mb-2`
- Description: `text-sm text-cloud/60 max-w-md mb-6`
- Optional action button

### Modals

Use native `<dialog>`. No Radix/Portal complexity.

**Dialog:**
```
mx-auto my-auto rounded-lg border border-whisper bg-ink p-6 max-w-md w-full
shadow-2xl
```

**Backdrop:**
```css
::backdrop {
  background: rgba(11, 16, 22, 0.8);
  backdrop-filter: blur(8px) saturate(140%);
  -webkit-backdrop-filter: blur(8px) saturate(140%);
}
```

**Close button:** top-right, ghost style, `aria-label="Close"`.

### Bottom sheet (mobile)

For focused tasks on mobile (filter sheets, mobile-only modals):

```
rounded-t-xl bg-ink px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3
shadow-2xl
transition-transform duration-500 ease-spring
[transform: translateY(100%)]  → [transform: translateY(0)] when open
```

Top: 36px × 5px drag handle in `bg-white/[0.18]` rounded-full, centered.
Backdrop: `bg-midnight/40 backdrop-blur-sm`.
Drag handle area should support drag-to-dismiss.

### Navigation header

**Sticky:**
```
sticky top-0 z-50 border-b border-whisper bg-[rgba(11,16,22,0.97)]
backdrop-blur-sm
h-[60px]
```

**Inner:**
```
mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8
```

**Brand (left):** `text-sm font-semibold tracking-wide text-white`
**Nav links:** `text-sm text-cloud hover:text-aqua transition-colors duration-150`
Active link: `text-white` plus optional bottom indicator.

**Pulse check active indicator:**
```
inline-flex items-center gap-2 rounded-full bg-yellow-500/10 px-3 py-1
text-sm font-medium text-yellow-300
```
With animated pulse dot.

### Breadcrumbs & back links

**Breadcrumbs:**
```
flex items-center gap-2 text-sm text-cloud/60
```
Separator: `<span class="text-cloud/30">/</span>`
Current: `text-cloud font-medium` (no link)
Parent links: `hover:text-aqua transition-colors`

**Back link:**
```
inline-flex items-center gap-1.5 text-sm text-cloud/60 hover:text-aqua transition-colors duration-150 mb-6
```
With `<ChevronLeft class="h-4 w-4" />`.

---

## 9. Form patterns

### Multi-step wizard

The problem proposal form is a 6-step wizard. Pattern:

**Step indicator at top:**
```html
<div class="mb-8">
  <div class="flex items-center justify-between text-xs text-cloud/60 mb-2">
    <span>Step {n} of 6</span>
    <span>{stepName}</span>
  </div>
  <div class="h-1 rounded-full bg-white/[0.08] overflow-hidden">
    <div class="h-full bg-teal transition-all duration-500 ease-spring" style="width: {pct}%"></div>
  </div>
</div>
```

**Navigation footer:**
```html
<div class="flex items-center justify-between border-t border-whisper pt-6 mt-8">
  <button class="[secondary]">Back</button>
  <button class="[primary]">Continue</button>
</div>
```

**Auto-save:**
Save draft to Supabase on step change. Show a subtle "Saved" indicator with checkmark for ~2 seconds in the bottom-left after each save.

### Validation timing

- **On blur** for individual field validation (e.g., email format)
- **On submit** for required field checks
- **As-you-type** only for character counts and password strength

Don't validate every keystroke — it creates a hostile feel.

### Submit feedback

**Success:** redirect to confirmation or show success banner at top of same page. Don't replace the form inline — disorienting.

**Failure:** show error banner above form, scroll to top, leave all field values intact.

---

## 10. The 13-week timeline component

The product's signature visual element. Located at `app/(dashboard)/cycles/cycle-phase-indicator.tsx`. Sets the tone for design ambition in the rest of the product.

### Anatomy

- **Three month phase labels** above the rail (Discovery / Exploration / Build & Ship)
- **13 numbered week boxes** on a horizontal rail
- **Active window chips** below the timeline showing what's currently open

### Week box states

| State | Treatment |
|---|---|
| Past | `bg-teal/40` filled |
| Current | `bg-aqua` + `shadow-[0_0_24px_rgba(77,187,194,0.4)]` glow + `animate-pulse` |
| Future | `bg-white/[0.06]` |

Square boxes, ~32–40px on desktop, smaller on mobile.

### Phase labels above

Span their week range (1–4, 5–8, 9–13) with a thin top border in teal:
```
border-t-2 border-teal/30 pt-2 text-xs font-medium uppercase tracking-widest text-cloud/60
```

Active phase:
```
border-teal text-aqua
```

### Week labels

Stagger week labels above and below the rail (odd above, even below) to prevent crowding on mobile.

### Active window chips

Below the timeline, pill-shaped chips for any currently open window:
```
inline-flex items-center gap-2 rounded-full border border-teal/30 bg-teal/[0.06] px-3 py-1.5
text-xs font-medium text-aqua
```

Include the live pulse dot when something is "open now."

### Responsive

Below `lg`, the timeline scrolls horizontally with `overflow-x-auto -mx-4 px-4`. On the smallest screens, consider collapsing to a vertical stack with the current week prominently displayed.

---

## 11. Voice & writing

The interface is written in **second person, plain language**, ~14-year-old reading level, no metaphors.

### Voice rules

- "You" not "the participant"
- "Tap" / "click" — match the platform vocabulary, not "select" or "press"
- Active voice always: "We revoke access" not "Access is revoked"
- Plain language. The audience includes career-changers from non-technical backgrounds.
- Confident but not bossy. "This week's voting is open" not "PLEASE VOTE NOW."
- Encouraging, not effusive. "Submitted." not "Awesome! 🎉"

### Microcopy patterns

| Context | Pattern | Example |
|---|---|---|
| Page titles | Sentence case, no period | "Active cycles" |
| Section headings | Sentence case, no period | "Your pods" |
| Button labels | One or two words, sentence case | "Submit", "Save changes", "Revoke access" |
| Empty states | Direct, friendly | "No proposals yet. Submit yours →" |
| Form helper | One sentence, ends with period | |
| Validation errors | Specific, actionable | "Email must include @" not "Invalid input" |
| Success | Past tense, brief | "Proposal submitted." |
| Destructive confirmations | Name the consequence | "This will revoke their access immediately." |
| Time / dates | Relative when recent, absolute otherwise | "Today", "Tomorrow", "Mar 14" |
| Loading | Specific when possible | "Submitting your proposal..." |

### Status terminology

Be consistent across the app:

| Concept | Term |
|---|---|
| The 13-week container | **Cycle** |
| 5–10 person group | **Pod** |
| 3–5 person sub-team | **Project team** |
| Participant | **Upskiller** (in copy), **Participant** (in admin/code) |
| Pod facilitator | **Moderator** |
| Weekly check-in | **Pulse check** |
| M1 idea | **Problem proposal** |
| M2 idea | **Solution proposal** |
| Period when something is open | **Window** (voting window, registration window) |

Don't use "course," "class," "student," "lesson," or "module." OLOS is not an LMS.

---

## 12. Accessibility

### Contrast

The dark theme passes WCAG AA at body level:
- `text-cloud` (#e6e6e6) on `#0b1016`: 14.4:1 (AAA)
- `text-cloud/60` on `#0b1016`: ~7:1 (AA Large, body OK in shorter passages)
- `text-cloud/40` is below AA — decorative use only

**Floor:** never use `text-cloud/40` or below for actionable text. Buttons, links, errors, validation must use `text-cloud` or stronger (or their colored equivalents).

### Focus states

Every interactive element needs a visible focus state. Inputs already use teal ring. Buttons need:
```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight
```

Use `focus-visible` (not `focus`) so the ring only appears on keyboard focus, not click.

### Touch targets

Minimum 44×44px on touch devices. Most buttons hit this with default padding. Verify small inline action buttons in tables — they may need padding bumped on mobile.

### Semantic HTML

- `<button>` for actions, `<a>` for navigation. Never `<div onClick>`.
- `<form>` with proper labels for all form inputs.
- Heading levels in order: `h1` per page, then `h2`, `h3`.
- `<table>` with proper `<thead>`/`<tbody>`/`<th scope>` for tabular data.
- `<dialog>` for modals.

### Screen readers

- Icons that convey meaning need `aria-label` or sr-only text
- Pure decorative icons get `aria-hidden="true"`
- Loading states: `aria-busy="true"` on the container
- Form errors: link via `aria-describedby` to the error message id

### Reduced motion

Respect `prefers-reduced-motion`. Pulse animations should disable. Make sure underlying meaning is conveyed by color/position alone.

---

## 13. Hierarchy of design effort

Where to spend polish budget, in order:

1. **Login / hero page.** First impression. Headline, gradient, CTA must feel premium.
2. **Pulse check flow.** Most-used surface. Friction here loses people.
3. **Problem and solution proposal forms.** Multi-step, high-stakes for participants.
4. **Voting flows.** Decisive and consequential.
5. **Cycle timeline component.** Signature visual.
6. **Pod and project detail pages.** Where most cycle work lives.
7. **Dashboards.** Information density over beauty.
8. **Admin tables and config.** Function first. Visual system applies but don't over-style.
9. **Empty / error / loading states.** Cover every surface but don't overdesign.

---

## 14. Anti-patterns

Things that look like they might fit OLOS but don't:

- **Gradient buttons.** Solid colors only.
- **Drop shadows on cards at rest.** Use border opacity instead.
- **Glass morphism.** No `backdrop-blur-xl` on every panel. Reserved for sticky header and modal backdrop only.
- **Animated entrances on page load.** Page just renders. Snappy is better than fancy.
- **Toast notifications stacked in the corner.** Use inline banners at top of relevant section.
- **Modal-on-modal.** If a flow needs a second modal, redesign the flow.
- **Custom scrollbars.** Native is fine.
- **Loading skeletons that don't match final content shape.** A generic skeleton box is worse than brief "Loading..." text.
- **Confetti, celebration animations, "great job!" messaging.** This is a tool. Acknowledge completion ("Submitted.") and move on.
- **Light mode toggle.** OLOS is dark-only. Don't build a toggle that doesn't work.
- **Bouncy spring entrances on routine UI.** Springs are for sheets and modal entrances, not card hovers.

---

## 15. File structure

Design tokens live in:

```
app/globals.css
└── @theme inline { ...color tokens... }
```

Component patterns are not extracted into a component library — they're applied inline via Tailwind utility classes wherever needed. This keeps the system flexible and the codebase grep-able.

When a pattern is repeated 3+ times across the app, consider extracting into a small server or client component. Examples that have earned extraction:
- `<StatusBadge variant="active|forming|revoked|...">`
- `<StatCard label number sublabel>`
- `<AlertBanner variant="warning|success|error|info">`
- `<EmptyState icon title description action>`

Don't extract until the pattern is stable. Premature extraction makes the system rigid.

---

## 16. Change log

**v1.0 — April 2026**
Initial design system. Inherits visual language from The Upskilling Labs brand and motion/interaction language from the Pod Sprint Run Mode iOS HIG audit. Captures all current implemented patterns. Establishes layered transparency conventions, the 13-week timeline as signature component, spring motion curves, and the participant-first hierarchy of design effort.

---

*The Upskilling Labs · OLOS · Design system v1.0*
