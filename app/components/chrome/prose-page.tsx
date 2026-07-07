/* Shared shell for the simple public prose pages (legal, contact, team,
   get-involved, donate): the same dark hero + 760px reading column the About
   page uses, factored out so each page only supplies its body. Server
   component — inherits the (public) nav/footer/upsell chrome from the layout. */
export function ProsePage({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: string;
  title: string;
  lede?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      {/* ── Editorial header ── */}
      <section className="grain on-dark" style={{ background: "var(--ink)" }}>
        <div className="container" style={{ paddingTop: 88, paddingBottom: 88 }}>
          <div className="ed-grid">
            <div className="ed-index">
              <div className="lbl lbl-teal">{eyebrow}</div>
            </div>
            <div className="ed-main">
              <h1 className="t-h1">{title}</h1>
            </div>
            {lede && (
              <div className="ed-aside ed-drop">
                <p className="t-lede" style={{ color: "var(--od2)" }}>
                  {lede}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Body — a readable column set on the grid's content zone (col 4+),
          aligned under the header's headline. */}
      <div className="container" style={{ paddingTop: 72, paddingBottom: 40 }}>
        <div className="ed-grid">
          <div className="ed-main ed-text">{children}</div>
        </div>
      </div>
    </>
  );
}
