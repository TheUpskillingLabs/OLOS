import { Crumbs } from "@/app/components/content/teasers";
import MetroSearch from "@/app/components/content/metro-search";
import { getMetros } from "@/lib/content/queries";

/* The Local labs (cities) directory — the prototype generator's
   directoryPage('labs'): the search bar leads (owner ask, July 2026),
   with every city — active lab first, waitlists by list size — shown
   until typing starts. */


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
      <div className="container">
        <Crumbs trail={[["Home", "/"], ["Local labs", null]]} />
      </div>
      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>
                Local labs · library-hosted
              </div>
              <h1 className="t-h2">Find your city</h1>
            </div>
          </div>
          <p className="t-lede" style={{ marginBottom: 28 }}>
            One lab is live. Every other city starts as a list of names. Find
            yours — or start it.
          </p>
          <MetroSearch metros={metros} initial={metros} />
        </div>
      </section>
    </>
  );
}
