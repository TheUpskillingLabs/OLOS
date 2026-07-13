import Link from "next/link";

/* The two public footers, ported from onboarding-proto:
   - PgFoot: the compact content-page footer (chrome.js footerHTML)
   - OsFooter: the open-source footer on the landing (index.html)

   Legal, contact, and get-involved pages are now hosted on-site (app/(public)/…)
   and linked here first — Privacy/Terms/Code of Conduct point to internal routes,
   and Donate routes through the on-site /donate landing (which carries the
   external every.org give button). */

export function PgFoot() {
  return (
    <footer className="pgfoot grain">
      <div className="pgfoot-inner">
        <span>
          The Upskilling Labs · run in the open — MIT code · CC BY 4.0 content
        </span>
        <span>
          <Link href="/about">About</Link> ·{" "}
          <Link href="/events">Events</Link> ·{" "}
          <Link href="/get-involved">Get Involved</Link> ·{" "}
          <Link href="/team">The Team</Link> ·{" "}
          <Link href="/donate">Donate</Link> ·{" "}
          <Link href="/contact">Contact</Link>
        </span>
        <span>
          <Link href="/privacy">Privacy</Link> ·{" "}
          <Link href="/terms">Terms</Link> ·{" "}
          <Link href="/code-of-conduct">Code of Conduct</Link>
        </span>
      </div>
    </footer>
  );
}

export function OsFooter() {
  return (
    <footer className="osfooter grain">
      <div className="osfooter-inner">
        <div className="foot-top">
          <div className="foot-brand">
            <Link href="/" style={{ display: "inline-block" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/logo-lockup-light.png"
                alt="The Upskilling Labs"
                style={{ height: 56, width: "auto", display: "block" }}
              />
            </Link>
            <p className="t-body">
              The systems we&rsquo;ve relied on are breaking. Here you&rsquo;re
              invited to turn that disruption into resilience&mdash;rooted in
              your local library and powered by you and your neighbors.
            </p>
            <Link className="btn btn-ghost-teal btn-sm" href="/donate">
              Support The Labs
            </Link>
          </div>
          <div className="foot-col">
            <div className="lbl">Explore</div>
            <Link className="foot-link" href="/events">Workshops</Link>
          </div>
          <div className="foot-col">
            <div className="lbl">Community</div>
            <Link className="foot-link" href="/about">About</Link>
            <Link className="foot-link" href="/team">The Team</Link>
            <Link className="foot-link" href="/get-involved">Get Involved</Link>
            <Link className="foot-link" href="/contact">Contact</Link>
            <Link className="foot-link" href="/login?intent=join">Become a member</Link>
          </div>
          <div className="foot-col">
            <div className="lbl">Open source</div>
            <Link className="foot-link" href="/about">How it works</Link>
            <a
              className="foot-link"
              href="https://github.com/TheUpskillingLabs/OLOS"
              target="_blank"
              rel="noopener"
            >
              Built in the open
            </a>
            <Link className="foot-link" href="/login?intent=join">Join The Labs</Link>
          </div>
        </div>
        <div className="foot-partners">
          <span className="lbl">In partnership with</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="p-levy" src="/assets/levy-strategic-design-white.png" alt="Levy Strategic Design" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="p-superbloom" src="/assets/superbloom-white.png" alt="Superbloom Design" />
        </div>
        <p className="foot-fineprint">
          The Upskilling Labs, Inc. operates as a fiscally sponsored project of
          Superbloom Design, a registered 501(c)(3) nonprofit organization based
          in the United States. Donations are tax-deductible to the extent
          permitted by law.
        </p>
        <div className="foot-bottom">
          <span>© 2026 The Upskilling Labs, Inc.</span>
          <span className="foot-legal">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/code-of-conduct">Code of Conduct</Link>
          </span>
          <span>MIT code · CC BY 4.0 content · Built in the open</span>
        </div>
      </div>
    </footer>
  );
}
