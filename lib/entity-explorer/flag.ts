// The single feature flag for the entire Entity Explorer (DESIGN.md §4).
//
// Default OFF: unless ENTITY_EXPLORER_ENABLED is exactly "true", the route 404s
// and the nav link is hidden — the feature is invisible and inert. Flipping this
// to expose the explorer is a separate decision from merging the code to dev
// (DESIGN.md §12), so the merged code can sit dormant until deliberately enabled.
//
// Server-only (not NEXT_PUBLIC): the route guards and the nav link are all RSCs,
// so the flag never needs to reach the client.
//
// Removal: drop this env var (DESIGN.md §4 removal checklist, step 3).
export const ENTITY_EXPLORER_ENABLED =
  process.env.ENTITY_EXPLORER_ENABLED === "true";
