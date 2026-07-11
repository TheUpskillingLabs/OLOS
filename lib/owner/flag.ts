// Feature flag for the generalized owner console (app/(dashboard)/admin/owner/).
//
// Default OFF: unless OWNER_CONSOLE_ENABLED is "true" (case-insensitive, whitespace
// ignored), the console route 404s and its nav link is hidden — the surface is inert.
// Exposing the console is a separate decision from merging the code (mirrors
// ENTITY_EXPLORER_ENABLED, lib/entity-explorer/flag.ts), so the code can sit dormant
// until deliberately enabled.
//
// NOTE: this gates only the generalized console UI. The per-page owner Danger Zones
// (cycle/pod/project/participant) and the /api/owner/* endpoints are NOT flag-gated —
// they are always available to owners.
//
// Server-only (not NEXT_PUBLIC): the route guard and nav link are RSCs.
export const OWNER_CONSOLE_ENABLED =
  process.env.OWNER_CONSOLE_ENABLED?.trim().toLowerCase() === "true";
