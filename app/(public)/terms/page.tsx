import { ProsePage } from "@/app/components/chrome/prose-page";

/* Terms of Service — hosted on-site (previously only linked to GitHub markdown).
   Copy mirrors docs/legal/TERMS_OF_SERVICE.md (the source of truth); keep the two
   in sync when either changes. */

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Terms of Service · The Upskilling Labs",
  description:
    "The terms that govern your use of the OLOS platform operated by The Upskilling Labs.",
};

const TRAIL: [string, string | null][] = [
  ["Home", "/"],
  ["Terms of Service", null],
];

const h2 = { marginTop: 44, marginBottom: 12 } as const;
const p = { marginBottom: 16 } as const;

export default function TermsPage() {
  return (
    <ProsePage
      eyebrow="Legal"
      title="Terms of Service"
      lede="The terms you agree to when you create an account or use OLOS."
      trail={TRAIL}
    >
      <p className="t-small" style={{ marginBottom: 28 }}>
        Effective date: July 3, 2026
      </p>

      <p className="t-body" style={p}>
        Welcome to OLOS (Open Labs OS), operated by The Upskilling Labs, Inc. (“The
        Labs,” “we,” “us”). By creating an account or otherwise using OLOS, you agree
        to these Terms of Service (“Terms”).
      </p>

      <h2 className="t-h2" style={h2}>1. Description of service</h2>
      <p className="t-body" style={p}>
        OLOS supports peer-driven learning cycles, volunteer and mentor coordination,
        and community programming for people navigating career transitions in a
        changing labor market. Features include registration, cycle enrollment,
        mentor matching, event listings, and program dashboards.
      </p>

      <h2 className="t-h2" style={h2}>2. Eligibility and accounts</h2>
      <p className="t-body" style={p}>
        You must have a valid Google Account to sign in. You are responsible for
        maintaining the confidentiality of your account and for all activity that
        occurs under it. You agree to provide accurate information during
        registration.
      </p>

      <h2 className="t-h2" style={h2}>3. One agreement for every role</h2>
      <p className="t-body" style={p}>
        Everyone joins The Upskilling Labs through the same registration and accepts
        the same Participant Agreement — whether you take part as a learner, mentor,
        organizer, or builder. That agreement incorporates these Terms, our{" "}
        <a className="see" href="/privacy">Privacy Policy</a>, and our{" "}
        <a className="see" href="/code-of-conduct">Code of Conduct</a>, and they apply
        to all members equally, regardless of role. The only additional agreement is
        the Build Cycle agreement you accept if and when you join a specific cycle.
      </p>

      <h2 className="t-h2" style={h2}>4. Acceptable use</h2>
      <p className="t-body" style={p}>You agree not to:</p>
      <div style={{ marginBottom: 16 }}>
        {[
          "Use OLOS for any unlawful purpose or in violation of these Terms",
          "Attempt to gain unauthorized access to other users’ accounts or data",
          "Interfere with or disrupt the platform’s operation",
          "Misrepresent your identity or affiliation",
        ].map((t) => (
          <div className="kv" key={t}>
            <span className="t-body">{t}</span>
          </div>
        ))}
      </div>
      <p className="t-body" style={p}>
        You are also expected to follow our{" "}
        <a className="see" href="/code-of-conduct">Code of Conduct</a> in all Labs
        spaces.
      </p>

      <h2 className="t-h2" style={h2}>5. Content</h2>
      <p className="t-body" style={p}>
        Any content you submit through OLOS (e.g., profile information, forum posts,
        program submissions) remains yours, but you grant The Labs a license to use
        it as necessary to operate the platform and deliver our programs.
      </p>

      <h2 className="t-h2" style={h2}>6. No warranty</h2>
      <p className="t-body" style={p}>
        OLOS is provided “as is” without warranties of any kind, express or implied.
        We do not guarantee the platform will be uninterrupted, error-free, or
        secure.
      </p>

      <h2 className="t-h2" style={h2}>7. Limitation of liability</h2>
      <p className="t-body" style={p}>
        To the fullest extent permitted by law, The Upskilling Labs, Inc. is not
        liable for any indirect, incidental, or consequential damages arising from
        your use of OLOS.
      </p>

      <h2 className="t-h2" style={h2}>8. Termination</h2>
      <p className="t-body" style={p}>
        We may suspend or terminate your access to OLOS at any time, with or without
        notice, for conduct that violates these Terms or that we believe is harmful
        to other users or the platform.
      </p>

      <h2 className="t-h2" style={h2}>9. Changes to these terms</h2>
      <p className="t-body" style={p}>
        We may update these Terms from time to time. Continued use of OLOS after
        changes take effect constitutes acceptance of the revised Terms.
      </p>

      <h2 className="t-h2" style={h2}>10. Contact us</h2>
      <p className="t-body" style={p}>
        Questions about these Terms can be sent to{" "}
        <a className="see" href="mailto:hq@theupskillinglabs.org">
          hq@theupskillinglabs.org
        </a>
        .
      </p>
    </ProsePage>
  );
}
