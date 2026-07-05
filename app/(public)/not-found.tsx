import Link from "next/link";

// 404 for the public content pages (events / library / cities) — renders inside
// the public layout, so it keeps the dark nav, footer, and upsell band.
export default function PublicNotFound() {
  return (
    <section className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <p className="lbl lbl-teal mb-1.5">404</p>
      <h1 className="t-h2 mb-2 text-ink">We couldn&apos;t find that page</h1>
      <p className="t-small mb-6 text-meta">
        The link may be broken, or the event, resource, or city may have moved.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn btn-teal">
          Back home
        </Link>
        <Link href="/events" className="btn btn-ghost">
          Browse events
        </Link>
      </div>
    </section>
  );
}
