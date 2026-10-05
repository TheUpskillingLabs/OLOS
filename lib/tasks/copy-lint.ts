/* The shared copy lint (handoff brief §6.3: "one shared copy-lint — M ships
   it; every lane imports the same word list"). The voice rules from
   DESIGN_SYSTEM.md §11 and the brief §3/§4.3, as data, so any lane's tests
   can assert their member-facing strings against one list.

   Word-bounded and case-insensitive: "username" and "Leadership" pass;
   "user", "lead", "class" do not. Pure module. */

export const BANNED_COPY: ReadonlyArray<{ pattern: RegExp; why: string }> = [
  { pattern: /\bTUL\b/, why: 'say "The Labs"' },
  { pattern: /\bcourses?\b/i, why: "OLOS is not an LMS" },
  { pattern: /\bclass(es)?\b/i, why: "OLOS is not an LMS" },
  { pattern: /\bstudents?\b/i, why: 'say "Upskiller" or "member"' },
  { pattern: /\blessons?\b/i, why: "OLOS is not an LMS" },
  { pattern: /\bmodules?\b/i, why: "OLOS is not an LMS" },
  { pattern: /\busers?\b/i, why: 'say "member" or "you"' },
  { pattern: /\bleads?\b/i, why: "never the sales voice" },
  { pattern: /\bregistrants?\b/i, why: 'say "pre-registered" or "you"' },
  { pattern: /\bstay tuned\b/i, why: "always one concrete next step" },
  { pattern: /\bsoon\b/i, why: "a time promise the platform cannot keep" },
  { pattern: /\boverdue\b/i, why: "never shame a member who is behind" },
  { pattern: /\bstreaks?\b/i, why: "no engagement machinery" },
];

/** The rule each banned phrase in `text` breaks (empty = clean). */
export function copyViolations(text: string): string[] {
  return BANNED_COPY.filter((b) => b.pattern.test(text)).map(
    (b) => `${b.pattern.source} — ${b.why}`
  );
}

/** Every string reachable in a copy object, functions sampled with a
    placeholder argument so templated copy is linted too. */
export function collectCopyStrings(value: unknown, sample = "Cycle"): string[] {
  if (typeof value === "string") return [value];
  if (typeof value === "function") {
    const out = (value as (...a: unknown[]) => unknown)(sample, 3);
    return collectCopyStrings(out, sample);
  }
  if (Array.isArray(value)) return value.flatMap((v) => collectCopyStrings(v, sample));
  if (value && typeof value === "object") {
    return Object.values(value).flatMap((v) => collectCopyStrings(v, sample));
  }
  return [];
}
