import { ProsePage } from "@/app/components/chrome/prose-page";

/* Privacy Policy — hosted on-site (previously only linked to GitHub markdown).
   Copy mirrors docs/legal/PRIVACY_POLICY.md (the source of truth); keep the two
   in sync when either changes. Covers the unified site + platform now that the
   marketing site folds into this app. */

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Privacy Policy · The Upskilling Labs",
  description:
    "How The Upskilling Labs collects, uses, and protects your information across theupskillinglabs.org and the OLOS platform.",
};

const h2 = { marginTop: 44, marginBottom: 12 } as const;
const p = { marginBottom: 16 } as const;

function List({ items }: { items: string[] }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {items.map((t) => (
        <div className="kv" key={t}>
          <span className="t-body">{t}</span>
        </div>
      ))}
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <ProsePage
      eyebrow="Legal"
      title="Privacy Policy"
      lede="What we collect across our website and the OLOS platform, how we use it, and the choices you have."
    >
      <p className="t-small" style={{ marginBottom: 28 }}>
        Effective date: July 9, 2026
      </p>

      <p className="t-body" style={p}>
        The Upskilling Labs, Inc. (“The Labs,” “we,” “us”) operates
        theupskillinglabs.org and OLOS (Open Labs OS), the platform behind it —
        supporting peer-driven learning cycles and community programs for people
        navigating career transitions. This Privacy Policy explains what
        information we collect, how we use it, and the choices you have. It
        covers both our public website and the OLOS platform.
      </p>
      <p className="t-body" style={p}>
        This Privacy Policy is part of the Participant Agreement every member accepts
        at registration, and it applies to all members equally, regardless of role.
      </p>

      <h2 className="t-h2" style={h2}>1. Information we collect</h2>
      <p className="t-body" style={p}>
        <strong>Through Google Sign-In:</strong> When you sign in with your Google
        Account, we receive your name, email address, and profile picture (basic
        profile scopes only — we do not request access to your Gmail, Drive,
        Calendar, or other Google data).
      </p>
      <p className="t-body" style={p}>
        <strong>Through forms on our site:</strong> When you fill out a form — to
        register, join a program, volunteer, mentor, partner, donate, subscribe to
        updates, or contact us — we may collect your name, email address, phone
        number (if you provide it), ZIP code, current work situation, role or
        program interests, responses to interest and background questions, and any
        consents you provide.
      </p>
      <p className="t-body" style={p}>
        <strong>Through your use of the platform:</strong> We keep records of your
        program enrollments, role assignments (e.g., moderator, mentor), and
        participation status within cycles and pods.
      </p>
      <p className="t-body" style={p}>
        <strong>Cookies:</strong> We use a strictly necessary cookie to keep you
        signed in (set by Supabase Auth). We do not use advertising or third-party
        tracking cookies.
      </p>

      <h2 className="t-h2" style={h2}>2. How we use your information</h2>
      <p className="t-body" style={p}>We use the information we collect to:</p>
      <List
        items={[
          "Create and manage your account and participant profile",
          "Match you to relevant cycles, pods, events, or mentorship opportunities",
          "Send you communications — invitations, onboarding steps, cycle updates, newsletters, and program announcements — via email",
          "Coordinate programming and events with collaborating organizations",
          "Operate moderator and admin tools that support program delivery",
          "Report to our funders and fiscal sponsor for grant administration and compliance",
          "Improve and maintain the platform",
        ]}
      />
      <p className="t-body" style={p}>
        We do not sell your personal information, and we do not use it for
        advertising.
      </p>

      <h2 className="t-h2" style={h2}>3. How we share your information</h2>
      <p className="t-body" style={p}>
        We share personal information only as needed to run our programs:
      </p>
      <div style={{ marginBottom: 16 }}>
        {[
          ["Our fiscal sponsor (Superbloom)", "for administrative and grant-management purposes"],
          ["Funders", "for reporting and compliance"],
          ["Collaborating organizations", "to coordinate programming and events"],
          ["Service providers", "the vendors listed below, who process data on our behalf"],
        ].map(([name, use]) => (
          <div className="kv" key={name}>
            <span className="t-body">
              <strong>{name}</strong> — {use}
            </span>
          </div>
        ))}
      </div>
      <p className="t-body" style={p}>We do not sell your personal information.</p>

      <h2 className="t-h2" style={h2}>4. How we store and protect information</h2>
      <p className="t-body" style={p}>
        Your information is stored in a hosted Postgres database (via Supabase) with
        access controls limiting who on our team can view participant data.
        Authentication is handled by Google OAuth and Supabase Auth; we do not store
        your Google password.
      </p>

      <h2 className="t-h2" style={h2}>5. Third-party services</h2>
      <p className="t-body" style={p}>
        We use the following third-party services to operate The Upskilling Labs:
      </p>
      <div style={{ marginBottom: 16 }}>
        {[
          ["Google", "for account sign-in (OAuth)"],
          ["Supabase", "for database hosting and authentication infrastructure"],
          ["Resend", "for transactional, invitation, and program emails sent from theupskillinglabs.org domains"],
          ["Slack", "for community coordination"],
        ].map(([name, use]) => (
          <div className="kv" key={name}>
            <span className="t-body">
              <strong>{name}</strong> — {use}
            </span>
          </div>
        ))}
      </div>
      <p className="t-body" style={p}>
        These providers process data on our behalf and are not authorized to use it
        for their own purposes.
      </p>

      <h2 className="t-h2" style={h2}>6. Data retention and deletion</h2>
      <p className="t-body" style={p}>
        We retain personal data for as long as your account is active or as needed
        to operate our programs and meet legal and reporting obligations. You may
        request deletion of your account and associated data at any time by
        contacting us at the address below.
      </p>

      <h2 className="t-h2" style={h2}>7. Your choices</h2>
      <p className="t-body" style={p}>You may:</p>
      <List
        items={[
          "Opt out of newsletter and program emails at any time using the “unsubscribe” link in any such email (we will still send essential account and program messages)",
          "Request access to, correction of, or deletion of your personal information by contacting us",
        ]}
      />

      <h2 className="t-h2" style={h2}>8. Children’s privacy</h2>
      <p className="t-body" style={p}>
        The Upskilling Labs is not directed to children under 13, and we do not
        knowingly collect personal information from children under 13.
      </p>

      <h2 className="t-h2" style={h2}>9. Changes to this policy</h2>
      <p className="t-body" style={p}>
        We may update this Privacy Policy from time to time. Material changes will be
        reflected by an updated effective date above.
      </p>

      <h2 className="t-h2" style={h2}>10. Contact us</h2>
      <p className="t-body" style={p}>
        Questions about this policy or your data can be sent to{" "}
        <a className="see" href="mailto:hq@theupskillinglabs.org">
          hq@theupskillinglabs.org
        </a>
        , or by mail to:
      </p>
      <p className="t-body" style={p}>
        The Upskilling Labs
        <br />
        712 H St NE PMB 143
        <br />
        Washington, DC 20002
      </p>
    </ProsePage>
  );
}
