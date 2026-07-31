// The current cycle's public-facing facts — the prototype's CYCLE_PUBLIC
// (onboarding-proto cycles/data.js). One shared constant so /build-cycles and
// the /events hero describe the same cycle with the same words; both retire
// together when the public cycle API lands (docs/OLOS_BACKEND_CHANGES.md
// §2/§8) and this reads from the `cycles` table instead.
export const CYCLE_PUBLIC = {
  name: "Summer 2026",
  theme: "Civic & Elections",
  city: "Washington, DC",
  kickoff: "2026-07-14T18:00",
  weeks: 12,
};
