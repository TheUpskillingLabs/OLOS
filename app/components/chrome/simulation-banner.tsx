import { simulationContext } from "@/lib/auth/simulation";

/**
 * The always-visible marker that you are looking at the app through someone
 * else's account (lib/auth/simulation.ts). Rendered by both the member and
 * admin shells, so it is present wherever a simulation can take you.
 *
 * Deliberately a plain `<a>` to a GET route, not a button: the read-only block
 * rejects every non-GET while simulating, the weekly Learning Log gate can pin
 * a simulated member to /dashboard, and a page that fails to hydrate still has
 * to offer a way out. No JavaScript in the escape hatch.
 *
 * Navy, not the admin EnvBanner's red/teal — "you are someone else right now"
 * is a different warning from "this is the production database", and the two
 * can stack on an admin page.
 */
export default async function SimulationBanner({
  next = "/admin/people",
}: {
  /** Where Exit returns to. Defaults to the People list it is started from. */
  next?: string;
}) {
  const sim = await simulationContext();
  if (!sim) return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-navy/40 bg-navy/10 px-4 py-2 text-center text-sm text-ink"
    >
      <span>
        <span aria-hidden>👁</span>{" "}
        Viewing as <strong className="font-semibold">{sim.target.displayName}</strong>
        <span className="text-meta"> · read-only</span>
      </span>
      <a
        href={`/api/admin/simulate/exit?next=${encodeURIComponent(next)}`}
        className="font-semibold text-teal-deep underline hover:no-underline"
      >
        Exit simulation
      </a>
    </div>
  );
}
