import MetroSearch from "@/app/components/content/metro-search";
import { EditorialHeader } from "@/app/components/chrome/editorial";
import { getMetros } from "@/lib/content/queries";

/* The Local labs (cities) directory — the prototype generator's
   directoryPage('labs'), recomposed on the editorial "standards-manual" grid:
   the document bar, the dark header (eyebrow + headline own the head row,
   standfirst beneath), then the metro search + city grid full-width. The
   search bar leads (owner ask, July 2026), with every city — active lab first,
   waitlists by list size — shown until typing starts. */


// The (public) layout reads request cookies for the auth-aware nav —
// always rendered per request, never prerendered at build.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Local labs · The Upskilling Labs",
  description:
    "One lab is live. Every other city starts as a list of names — find yours, or start it.",
};

export default async function LabsPage() {
  const metros = await getMetros(); // already sorted active-first, then waiting desc

  return (
    <>
      {/* ── Header: eyebrow + headline (head row), standfirst (row beneath) ── */}
      <EditorialHeader
        eyebrow="Local labs · library-hosted"
        title="Find your city"
        standfirst="One lab is live. Every other city starts as a list of names. Find yours — or start it."
      />

      {/* ── Browse: the metro search + city grid, full-width ── */}
      <section className="section">
        <div className="container">
          <MetroSearch metros={metros} initial={metros} />
        </div>
      </section>
    </>
  );
}
