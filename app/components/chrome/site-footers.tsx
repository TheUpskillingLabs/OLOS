import Link from "next/link";
import { DONATE_URL } from "@/lib/donate";

/* The two public footers, ported from onboarding-proto:
   - PgFoot: the compact content-page footer (chrome.js footerHTML)
   - OsFooter: the open-source footer on the landing (index.html)
   - UpsellBand: the signed-out fixed band on content pages */

export function PgFoot() {
  return (
    <footer className="pgfoot grain">
      <div className="pgfoot-inner">
        <span>
          The Upskilling Labs · run in the open — MIT code · CC BY 4.0 content
        </span>
        <span>
          <Link href="/about">About</Link> ·{" "}
          <Link href="/build-cycles">Build Cycles</Link> ·{" "}
          <Link href="/events">Events</Link> ·{" "}
          <Link href="/library">Library</Link> ·{" "}
          <Link href="/stories">Stories</Link> ·{" "}
          <Link href="/local-labs">Cities</Link> ·{" "}
          <a href={DONATE_URL} target="_blank" rel="noopener">
            Donate
          </a>
        </span>
      </div>
    </footer>
  );
}

export function UpsellBand() {
  return (
    <div className="upsell">
      <p>Find your people. Build your edge.</p>
      <span className="t-small">Free to join · run in the open</span>
      <Link className="btn btn-red btn-sm" href="/login">
        Create account
      </Link>
    </div>
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
              A commons for upskilling — learn by doing, in the open. Projects,
              playbooks, and lessons, built like open source.
            </p>
            <a
              className="btn btn-ghost-teal btn-sm"
              href={DONATE_URL}
              target="_blank"
              rel="noopener"
            >
              Support The Labs
            </a>
          </div>
          <div className="foot-col">
            <div className="lbl">Explore</div>
            <Link className="foot-link" href="/build-cycles">Build Cycles</Link>
            <Link className="foot-link" href="/events">Workshops</Link>
            <Link className="foot-link" href="/library">Learning Library</Link>
            <Link className="foot-link" href="/stories">Upskiller Spotlights</Link>
            <Link className="foot-link" href="/local-labs">Local labs</Link>
          </div>
          <div className="foot-col">
            <div className="lbl">Community</div>
            <Link className="foot-link" href="/about">About</Link>
            <Link className="foot-link" href="/login">Become a member</Link>
            <Link className="foot-link" href="/login">Log in</Link>
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
            <Link className="foot-link" href="/login">Join The Labs</Link>
          </div>
        </div>
        <div className="foot-partners">
          <span className="lbl">In partnership with</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="p-levy" src="/assets/levy-strategic-design-white.png" alt="Levy Strategic Design" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="p-dcpl" src="/assets/dcpl-knockout-logo.png" alt="DC Public Library" />
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
            <a
              href="https://github.com/TheUpskillingLabs/OLOS/blob/main/docs/legal/PRIVACY_POLICY.md"
              target="_blank"
              rel="noopener"
            >
              Privacy
            </a>
            <a
              href="https://github.com/TheUpskillingLabs/OLOS/blob/main/docs/legal/TERMS_OF_SERVICE.md"
              target="_blank"
              rel="noopener"
            >
              Terms
            </a>
          </span>
          <span>MIT code · CC BY 4.0 content · Built in the open</span>
        </div>
      </div>
    </footer>
  );
}
