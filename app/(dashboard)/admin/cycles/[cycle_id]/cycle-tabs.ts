/* Tab vocabulary for the per-cycle admin workspace. Server-safe on purpose:
   the page (a Server Component) normalizes ?tab= with resolveInitialTab, and
   in this Next.js version calling a function imported from a "use client"
   module on the server throws at request time ("Attempted to call
   resolveInitialTab() from the server") — so the pure logic lives here,
   outside the client bundle boundary. */

export type CycleTab =
  | "overview"
  | "configuration"
  | "formation"
  | "people"
  | "dev";

const VALID_TABS: CycleTab[] = [
  "overview",
  "configuration",
  "formation",
  "people",
  "dev",
];

/** Normalize an untrusted ?tab= value, honoring the dev-tab permission gate. */
export function resolveInitialTab(
  raw: string | undefined,
  showDev: boolean,
): CycleTab {
  const tab = VALID_TABS.includes(raw as CycleTab) ? (raw as CycleTab) : "overview";
  return tab === "dev" && !showDev ? "overview" : tab;
}
