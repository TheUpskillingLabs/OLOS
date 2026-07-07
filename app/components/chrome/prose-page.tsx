import { Crumbs } from "@/app/components/content/teasers";

/* Shared shell for the simple public prose pages (legal, contact, team,
   get-involved, donate): the same dark hero + 760px reading column the About
   page uses, factored out so each page only supplies its body. Server
   component — inherits the (public) nav/footer/upsell chrome from the layout. */
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
      {/* Document bar — crumbs left, identifier right, rule under */}
      <div className="container" style={{ paddingTop: 22 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 16,
            paddingBottom: 12,
          }}
        >
          <Crumbs trail={trail} />
          <span className="lbl">The Upskilling Labs</span>
        </div>
        <hr className="ed-rule" style={{ marginBottom: 0 }} />
      </div>

      {/* ── Editorial header: eyebrow + title on the head row, standfirst in
          the row beneath (never beside the heading) ── */}
      <section className="grain on-dark" style={{ background: "var(--ink)" }}>
        <div className="container" style={{ paddingTop: 96, paddingBottom: 96 }}>
          <div className="ed-sec">
            <div className="ed-eyebrow">
              <div className="lbl lbl-teal">{eyebrow}</div>
            </div>
            <h1 className="ed-heading t-h1">{title}</h1>
            {lede && (
              <div className="ed-cols">
                <p className="t-lede ed-text" style={{ color: "var(--od2)" }}>
                  {lede}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Body — a readable column set in the content zone (cols 2–5), aligned
          under the header's headline. */}
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
