import Link from "next/link";

// Root 404 — catches unmatched URLs and any notFound() not caught by a closer
// route-group not-found. Renders inside the root layout (fonts + globals) with
// no nav, so it's self-contained and centered.
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-md p-8 text-center shadow-card">
        <p className="lbl lbl-teal mb-1.5">404</p>
        <h1 className="t-h2 mb-2 text-ink">We couldn&apos;t find that page</h1>
        <p className="t-small mb-6 text-meta">
          The link may be broken, or the page may have moved.
        </p>
        <Link href="/" className="btn btn-teal">
          Back to The Labs
        </Link>
      </div>
    </div>
  );
}
