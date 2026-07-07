import Link from "next/link";

/* Quick links — the right-rail utility card (prototype dashboard aside
   "Quick links"). Real routes only; the every.org support link is external.
   A calm list of teal links divided by hairlines — LinkedIn's right rail in
   the light system. */

export default function QuickLinks({
  cycleId,
  logDue = false,
}: {
  cycleId?: number;
  /** While the log gate is active, in-app routes bounce to Home — don't offer
      "Your cycle" as a link that just round-trips. */
  logDue?: boolean;
}) {
  const links: { label: string; href: string; external?: boolean }[] = [
    ...(logDue
      ? []
      : [{ label: "Your cycle", href: cycleId ? `/cycles/${cycleId}` : "/cycles" }]),
    { label: "Browse events", href: "/events" },
    { label: "Browse the library", href: "/library" },
    { label: "Find your local lab", href: "/local-labs" },
    {
      label: "Support The Labs",
      href: "https://www.every.org/theupskillinglabs",
      external: true,
    },
  ];

  return (
    <div className="rounded-card border border-ink/10 bg-white p-5 shadow-card">
      <div className="lbl mb-2">Quick links</div>
      <ul className="flex flex-col">
        {links.map((l, i) =>
          l.external ? (
            <li key={l.label}>
              <a
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`block py-3 text-sm font-semibold text-teal-deep hover:underline ${
                  i > 0 ? "border-t border-ink/10" : ""
                }`}
              >
                {l.label} &rarr;
              </a>
            </li>
          ) : (
            <li key={l.label}>
              <Link
                href={l.href}
                className={`block py-3 text-sm font-semibold text-teal-deep hover:underline ${
                  i > 0 ? "border-t border-ink/10" : ""
                }`}
              >
                {l.label} &rarr;
              </Link>
            </li>
          )
        )}
      </ul>
    </div>
  );
}
