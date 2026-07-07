import { ResourceTeaser } from "@/app/components/content/teasers";
import { DocBar, EditorialHeader } from "@/app/components/chrome/editorial";
import { getResources } from "@/lib/content/queries";

/* The Learning Library directory — the prototype generator's
   directoryPage('library'), recomposed on the editorial "standards-manual"
   grid: the document bar, the dark header (count eyebrow + headline own the head
   row, standfirst beneath), then the full teaser grid full-width. */


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
      <DocBar trail={[["Home", "/"], ["Library", null]]} tag="The Upskilling Labs · Library" />

      {/* ── Header: count eyebrow + headline (head row), standfirst (beneath) ── */}
      <EditorialHeader
        eyebrow={resources.length ? `Learning Library · ${resources.length}` : "Learning Library"}
        title="Learn by doing"
        standfirst="Everything here is free and open — including what cycle teams returned to the commons."
      />

      {/* ── Browse: the full teaser grid, full-width ── */}
      <section className="section">
        <div className="container">
          {resources.length ? (
            <div className="cards dense all">
              {resources.map((r) => (
                <ResourceTeaser key={r.slug} resource={r} />
              ))}
            </div>
          ) : (
            <div className="lcard" style={{ padding: 48 }}>
              <div className="t-h3">Coming Soon</div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
