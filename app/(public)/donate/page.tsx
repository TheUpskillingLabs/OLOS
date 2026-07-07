import Link from "next/link";
import { DONATE_URL } from "@/lib/donate";
import { ProsePage } from "@/app/components/chrome/prose-page";

/* Donate — an on-site landing that gives the external every.org checkout
   context and trust. Copy adapted from the old marketing site's Donate page
   (docs/marketing-site/pages/donate.md). The give button opens DONATE_URL. */

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Donate · The Upskilling Labs",
  description:
    "By giving today, you’re helping build a new institution for the future. The Upskilling Labs is a fiscally sponsored 501(c)(3) project of Superbloom Design.",
};

const TRAIL: [string, string | null][] = [
  ["Home", "/"],
  ["Donate", null],
];

const h2 = { marginTop: 44, marginBottom: 16 } as const;
const p = { marginBottom: 16 } as const;

const QUOTES: [string, string][] = [
  [
    "Beyond training, the program opened doors to meaningful networking and authentic connections with peers who share a passion for innovation.",
    "Upskilling Alum, Brittany Chappell",
  ],
  [
    "At a time when I felt uncertain, the program gave me purpose again — it connected me with other mission-driven public servants to tackle real problems using emerging technology.",
    "Upskilling Alum, Hector Perla",
  ],
];

export default function DonatePage() {
  return (
    <ProsePage
      eyebrow="Support The Labs"
      title="Make an impact today"
      lede="By giving today, you’re helping build a new institution for the future. Your contributions directly support the work we do."
      trail={TRAIL}
    >
      <a className="btn btn-red btn-lg" href={DONATE_URL} target="_blank" rel="noopener">
        Give now
      </a>
      <p className="t-small" style={{ marginTop: 14, marginBottom: 8 }}>
        The Upskilling Labs is a fiscally sponsored project of Superbloom Design, a
        registered 501(c)(3) nonprofit organization.
      </p>

      <h2 className="t-h2" style={h2}>What people are saying</h2>
      {QUOTES.map(([quote, who]) => (
        <blockquote
          key={who}
          style={{
            borderLeft: "2px solid var(--teal)",
            paddingLeft: 20,
            margin: "0 0 20px",
          }}
        >
          <p className="t-lede" style={{ marginBottom: 6 }}>“{quote}”</p>
          <p className="t-small">— {who}</p>
        </blockquote>
      ))}

      <h2 className="t-h2" style={h2}>Frequently asked questions</h2>

      <p className="t-body" style={{ marginBottom: 6, fontWeight: 600 }}>
        Is my contribution tax-deductible?
      </p>
      <p className="t-body" style={p}>
        Yes. The Upskilling Labs operates as a fiscally sponsored project of
        Superbloom, a registered 501(c)(3) nonprofit organization.
      </p>

      <p className="t-body" style={{ marginBottom: 6, fontWeight: 600 }}>
        Where does my contribution go?
      </p>
      <p className="t-body" style={p}>
        Your contribution helps cover start-up costs for the organization — materials
        for our meetups (signs, name tags), software subscriptions that let us
        operate, and volunteer appreciation like pizza at our meetups.
      </p>

      <p className="t-body" style={{ marginBottom: 6, fontWeight: 600 }}>
        Can I volunteer or get more involved?
      </p>
      <p className="t-body" style={p}>
        Yes! Head over to the{" "}
        <Link className="see" href="/get-involved">Get Involved</Link> page.
      </p>

      <p className="t-body" style={{ marginBottom: 6, fontWeight: 600 }}>
        Do you accept in-kind donations?
      </p>
      <p className="t-body" style={p}>
        We do. Please email{" "}
        <a className="see" href="mailto:hq@theupskillinglabs.org">
          hq@theupskillinglabs.org
        </a>{" "}
        with more information about what you’re able to give.
      </p>
    </ProsePage>
  );
}
