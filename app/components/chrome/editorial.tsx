/* Shared editorial "standards-manual" chrome (ref: 1976 NASA Graphics Standards
   Manual). The whole public content surface composes from these so every page
   shares one grid: a dark header whose eyebrow + heading own the head row
   (standfirst drops beneath), and body sections whose content flows in rows of
   equal same-hierarchy columns. See the .ed-* system in globals.css. */

// The dark editorial header — eyebrow + heading on the head row, the standfirst
// (and any extra rows) beneath. `title` may wrap (text-wrap: balance).
export function EditorialHeader({
  eyebrow,
  title,
  standfirst,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  standfirst?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="grain on-dark" style={{ background: "var(--ink)" }}>
      <div className="container" style={{ paddingTop: 96, paddingBottom: 96 }}>
        <div className="ed-sec">
          <div className="ed-eyebrow">
            <div className="lbl lbl-teal">{eyebrow}</div>
          </div>
          <h1 className="ed-heading t-h1">{title}</h1>
          {standfirst && (
            <div className="ed-cols">
              <p className="t-lede ed-text" style={{ color: "var(--od2)" }}>
                {standfirst}
              </p>
            </div>
          )}
          {children}
        </div>
      </div>
    </section>
  );
}

// A body section — an optional eyebrow + heading on the head row; the caller
// supplies the content rows (`.ed-cols` / `.ed-cols-2` / `.ed-cols-4`).
export function EdSection({
  eyebrow,
  heading,
  children,
}: {
  eyebrow?: string;
  heading?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="ed-sec">
      <hr className="ed-rule" />
      {eyebrow && (
        <div className="ed-eyebrow">
          <div className="lbl lbl-teal">{eyebrow}</div>
        </div>
      )}
      {heading && <h2 className="ed-heading t-h2">{heading}</h2>}
      {children}
    </section>
  );
}

// A single content row (cols 2–5, N equal same-hierarchy columns).
export function EdRow({
  cols,
  children,
}: {
  cols?: 2 | 4;
  children: React.ReactNode;
}) {
  return (
    <div className={cols === 2 ? "ed-cols ed-cols-2" : cols === 4 ? "ed-cols ed-cols-4" : "ed-cols"}>
      {children}
    </div>
  );
}

// A quote pulled to its own row (never beside the heading).
export function Pull({ children }: { children: React.ReactNode }) {
  return (
    <div className="ed-cols">
      <p className="ed-pull">{children}</p>
    </div>
  );
}
