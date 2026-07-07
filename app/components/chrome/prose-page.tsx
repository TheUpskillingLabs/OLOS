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
      <div className="container">
        <Crumbs trail={trail} />
      </div>

      <section className="grain" style={{ background: "var(--ink)", color: "#fff" }}>
        <div className="reading" style={{ paddingTop: 56, paddingBottom: 56 }}>
          <div className="lbl lbl-teal" style={{ marginBottom: 16 }}>
            {eyebrow}
          </div>
          <h1 className="t-h1" style={{ maxWidth: "28ch" }}>
            {title}
          </h1>
          {lede && (
            <p
              className="t-lede"
              style={{ marginTop: 18, maxWidth: "56ch", color: "var(--od2)" }}
            >
              {lede}
            </p>
          )}
        </div>
      </section>

      <div className="reading" style={{ paddingTop: 56, paddingBottom: 40 }}>
        {children}
      </div>
    </>
  );
}
