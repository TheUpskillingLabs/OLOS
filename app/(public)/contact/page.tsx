import Link from "next/link";
import { ProsePage } from "@/app/components/chrome/prose-page";

/* Contact / Partner — copy adapted from the old marketing site's Partner page
   (docs/marketing-site/pages/partner.md), plus a general contact line. */

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Contact · The Upskilling Labs",
  description:
    "Get in touch with The Upskilling Labs — partnerships, sponsorship, venues, and general questions.",
};

const h2 = { marginTop: 44, marginBottom: 12 } as const;
const p = { marginBottom: 16 } as const;

const WAYS: [string, string][] = [
  ["Sponsors", "Help fund the work and grow what the Labs can do."],
  ["Community partners", "Help us spread the word and build stronger programs together."],
  ["Venue partners", "Host our meetups, workshops, and build-cycle sessions."],
];

export default function ContactPage() {
  return (
    <ProsePage
      eyebrow="Get in touch"
      title="Partner with us"
      lede="Interested in supporting our mission? We’re always looking for people and organizations to build with."
    >
      <p className="t-body" style={p}>
        The Upskilling Labs runs in the open and grows through partnership. Whether
        you want to fund the work, help more people find us, or host a session,
        there’s a way to get involved.
      </p>

      <div className="cards two" style={{ margin: "28px 0 40px" }}>
        {WAYS.map(([t, b]) => (
          <div className="lcard" style={{ padding: 22 }} key={t}>
            <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>
              {t}
            </div>
            <p className="t-small">{b}</p>
          </div>
        ))}
      </div>

      <h2 className="t-h2" style={h2}>Partnerships & sponsorship</h2>
      <p className="t-body" style={p}>
        Reach out to{" "}
        <a className="see" href="mailto:partnerships@theupskillinglabs.org">
          partnerships@theupskillinglabs.org
        </a>{" "}
        and tell us a little about what you have in mind.
      </p>

      <h2 className="t-h2" style={h2}>General questions</h2>
      <p className="t-body" style={p}>
        For anything else, email{" "}
        <a className="see" href="mailto:hq@theupskillinglabs.org">
          hq@theupskillinglabs.org
        </a>
        .
      </p>

      <h2 className="t-h2" style={h2}>Want to pitch in?</h2>
      <p className="t-body" style={p}>
        If you’d rather roll up your sleeves, see the{" "}
        <Link className="see" href="/get-involved">ways to volunteer</Link> or{" "}
        <Link className="see" href="/login">join The Labs</Link>.
      </p>
    </ProsePage>
  );
}
