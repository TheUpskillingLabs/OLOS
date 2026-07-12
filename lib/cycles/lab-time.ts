/* Lab-local time handling for the cycle window columns.
 *
 * The twelve cycle_config.*_open/_close columns (+ phase_2/3_start) are
 * TIMESTAMP WITHOUT TIME ZONE. The storage convention is: **the stored
 * wall-clock is the instant in UTC** (decided 2026-07-12; S5.1 in
 * docs/requirements/cycle3-testing-plan.md). Admins THINK in the lab's
 * local time — DC's America/New_York — so the admin form and every
 * member-facing "Opens …" hint convert at the boundary:
 *
 *   entry  : lab wall-clock (datetime-local) ──fromLabInput──▶ naive UTC
 *   gates  : naive UTC ──parseWindow──▶ Date (explicit Z, so a dev laptop
 *            in ET computes the same instant Vercel's UTC runtime does)
 *   display: naive UTC ──fmtLab*──▶ lab wall-clock, labeled "ET"
 *
 * DST is handled by real timezone math (Intl), not a fixed offset — the
 * EDT→EST flip on Nov 1, 2026 needs no code or data change.
 *
 * LAB_TZ is a constant until metros.timezone ships with the Stage 1
 * calendar overhaul (docs/requirements/cycle-timeline.md); the resolver
 * that replaces this module reads the cycle's lab timezone from data.
 */

export const LAB_TZ = "America/New_York";

/** Short label shown next to lab-local times. Correct for both EDT and EST. */
export const LAB_TZ_LABEL = "ET";

/**
 * Parse a stored window timestamp into a Date. Naive values ("2026-07-25
 * 13:00:00" or "2026-07-25T13:00:00") are the-instant-in-UTC by convention;
 * values that already carry a zone (Z or ±hh[:mm]) parse as themselves.
 */
export function parseWindow(value: string | null | undefined): Date | null {
  if (!value) return null;
  const s = value.trim().replace(" ", "T");
  const zoned = /(?:Z|[+-]\d{2}:?\d{2})$/.test(s);
  const d = new Date(zoned ? s : `${s}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** True when now ∈ [open, close]. False when either bound is missing. */
export function windowOpen(
  open: string | null | undefined,
  close: string | null | undefined,
  now: Date = new Date()
): boolean {
  const o = parseWindow(open);
  const c = parseWindow(close);
  return !!o && !!c && now >= o && now <= c;
}

/* ── Intl plumbing ─────────────────────────────────────────────────────── */

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: LAB_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function labParts(instant: Date): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of partsFmt.formatToParts(instant)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  if (out.hour === 24) out.hour = 0; // hourCycle quirk guard
  return out;
}

/** LAB_TZ's UTC offset (ms) at a given instant — 4h in EDT, 5h in EST. */
function labOffsetMs(instant: Date): number {
  const p = labParts(instant);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - instant.getTime();
}

const pad = (n: number) => String(n).padStart(2, "0");

/* ── Admin form boundary ───────────────────────────────────────────────── */

/**
 * Stored naive-UTC timestamp → the "YYYY-MM-DDTHH:mm" value a
 * datetime-local input needs, expressed in the lab's wall-clock.
 */
export function toLabInput(value: string | null): string {
  const d = parseWindow(value);
  if (!d) return "";
  const p = labParts(d);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * datetime-local input ("YYYY-MM-DDTHH:mm", lab wall-clock) → the naive
 * UTC string to store. Two-pass offset lookup handles DST: the second
 * pass corrects a first guess that landed on the wrong side of a
 * transition (spring-forward gaps and fall-back ambiguities resolve to
 * the post-transition offset).
 */
export function fromLabInput(val: string): string | null {
  if (!val) return null;
  const m = val.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, hh, mm] = m.map(Number) as unknown as number[];
  const guess = Date.UTC(y, mo - 1, d, hh, mm);
  let utc = guess - labOffsetMs(new Date(guess));
  const second = guess - labOffsetMs(new Date(utc));
  if (second !== utc) utc = second;
  const out = new Date(utc);
  return (
    `${out.getUTCFullYear()}-${pad(out.getUTCMonth() + 1)}-${pad(out.getUTCDate())}` +
    `T${pad(out.getUTCHours())}:${pad(out.getUTCMinutes())}:00`
  );
}

/* ── Member-facing display ─────────────────────────────────────────────── */

/** "Jul 25, 9:00 AM ET" — a stored window timestamp in lab wall-clock. */
export function fmtLabDateTime(value: string | null | undefined): string {
  const d = parseWindow(value);
  if (!d) return "";
  const s = new Intl.DateTimeFormat("en-US", {
    timeZone: LAB_TZ,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
  return `${s} ${LAB_TZ_LABEL}`;
}

/** "Jul 25" — date-only, in lab wall-clock (no tz label; dates read as-is). */
export function fmtLabDate(value: string | null | undefined): string {
  const d = parseWindow(value);
  if (!d) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: LAB_TZ,
    month: "short",
    day: "numeric",
  }).format(d);
}
