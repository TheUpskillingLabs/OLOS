import { Crumbs, ResourceTeaser } from "@/app/components/content/teasers";
import { getResources } from "@/lib/content/queries";

/* The Learning Library directory — the prototype generator's
   directoryPage('library'): section-head + the full teaser grid. */


// The (public) layout reads request cookies for the auth-aware nav —
// always rendered per request, never prerendered at build.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Learning Library · The Upskilling Labs",
  description:
    "Guides, recordings, templates, and playbooks — including work returned to the commons by cycle teams.",
};

export default async function LibraryPage() {
  const resources = await getResources();

  return (
    <>
      <div className="container">
        <Crumbs trail={[["Home", "/"], ["Library", null]]} />
      </div>
      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>
                {resources.length
                  ? `Learning Library · ${resources.length}`
                  : "Learning Library"}
              </div>
              <h1 className="t-h2">Learn by doing</h1>
            </div>
          </div>
          <p className="t-lede" style={{ marginBottom: 28 }}>
            Everything here is free and open — including what cycle teams
            returned to the commons.
          </p>
          {resources.length ? (
            <div className="cards dense all">
              {resources.map((r) => (
                <ResourceTeaser key={r.slug} resource={r} />
              ))}
            </div>
          ) : (
            <div className="lcard" style={{ padding: 48, textAlign: "center" }}>
              <div className="t-h3">Coming Soon</div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
