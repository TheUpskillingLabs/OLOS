import { DocBar, EditorialHeader } from "@/app/components/chrome/editorial";

/* Shared shell for the simple public prose pages (legal, contact, team,
   get-involved, donate): the standards-manual document bar + editorial header,
   then a readable body column set in the content zone. Server component —
   inherits the (public) nav/footer chrome from the layout. */
export function ProsePage({
  eyebrow,
  title,
  lede,
  trail,
  children,
}: {
  eyebrow: string;
  title: string;
  lede?: React.ReactNode;
  trail: [string, string | null][];
  children: React.ReactNode;
}) {
  return (
    <>
      <DocBar trail={trail} tag="The Upskilling Labs" />
      <EditorialHeader eyebrow={eyebrow} title={title} standfirst={lede} />

      {/* Body — a readable column in the content zone (cols 2–5), aligned under
          the header's headline. */}
      <div className="container" style={{ paddingTop: 72, paddingBottom: 40 }}>
        <div className="ed-sec">
          <div className="ed-cols">
            <div className="ed-text">{children}</div>
          </div>
        </div>
      </div>
    </>
  );
}
