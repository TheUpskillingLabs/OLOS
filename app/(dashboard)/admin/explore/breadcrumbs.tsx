// Shared breadcrumb trail for the explorer pages, so every page can walk back up
// to Admin (and any intermediate level), not just to the previous page.

import Link from "next/link";

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-cloud/60"
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={`${item.label}-${i}`} className="inline-flex items-center gap-1.5">
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="transition-colors duration-150 hover:text-aqua focus-visible:text-aqua focus-visible:outline-none"
              >
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "text-cloud/85" : undefined}>{item.label}</span>
            )}
            {!isLast && (
              <span aria-hidden className="text-cloud/30">
                ›
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
