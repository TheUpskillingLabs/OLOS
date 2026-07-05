import Link from "next/link";

// 404 for the signed-in app (a cycle / pod / project / member that moved or
// never existed) — renders inside the app shell, keeping the nav + tab bar.
export default function DashboardNotFound() {
  return (
    <section className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <p className="lbl lbl-teal mb-1.5">404</p>
      <h1 className="t-h2 mb-2 text-ink">We couldn&apos;t find that</h1>
      <p className="t-small mb-6 text-meta">
        This cycle, pod, project, or member may have moved or no longer exists.
      </p>
      <Link href="/dashboard" className="btn btn-teal">
        Back to your dashboard
      </Link>
    </section>
  );
}
