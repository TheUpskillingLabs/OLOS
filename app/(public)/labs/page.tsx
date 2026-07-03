import Link from "next/link";
import { Crumbs, LabTeaser } from "@/app/components/content/teasers";
import { getMetros } from "@/lib/content/queries";

/* The Local labs (cities) directory — the prototype generator's
   directoryPage('labs'): active lab first, waitlists by list size, then the
   "Don't see your city?" strip pointing at the landing's metro search. */


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
          <div className="cards dense all">
            {metros.map((m) => (
              <LabTeaser key={m.slug} metro={m} />
            ))}
          </div>
          <div
            className="lcard"
            style={{
              padding: 24,
              marginTop: 32,
              display: "flex",
              gap: 16,
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div className="t-h4" style={{ marginBottom: 4 }}>
                Don’t see your city?
              </div>
              <p className="t-small">
                Search any city — or be the first name on its list.
              </p>
            </div>
            <Link className="btn btn-ghost-teal btn-sm" href="/#sec-labs">
              Search your city
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
