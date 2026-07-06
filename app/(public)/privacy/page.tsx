import { ProsePage } from "@/app/components/chrome/prose-page";

/* Privacy Policy — hosted on-site (previously only linked to GitHub markdown).
   Copy mirrors docs/legal/PRIVACY_POLICY.md (the source of truth); keep the two
   in sync when either changes. */

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Privacy Policy · The Upskilling Labs",
  description:
    "How The Upskilling Labs collects, uses, and protects your information on the OLOS platform.",
};

const TRAIL: [string, string | null][] = [
  ["Home", "/"],
  ["Privacy Policy", null],
];

const h2 = { marginTop: 44, marginBottom: 12 } as const;
const p = { marginBottom: 16 } as const;

export default function PrivacyPage() {
  return (
    <ProsePage
      eyebrow="Legal"
      title="Privacy Policy"
      lede="What we collect through OLOS, how we use it, and the choices you have."
      trail={TRAIL}
    >
      <p className="t-small" style={{ marginBottom: 28 }}>
        Effective date: July 3, 2026
      </p>

      <p className="t-body" style={p}>
        The Upskilling Labs, Inc. (“The Labs,” “we,” “us”) operates OLOS (Open Labs
        OS), a platform supporting peer-driven learning cycles and community
        programs for people navigating career transitions. This Privacy Policy
        explains what information we collect through OLOS, how we use it, and the
        choices you have.
      </p>

      <h2 className="t-h2" style={h2}>1. Information we collect</h2>
      <p className="t-body" style={p}>
        <strong>Through Google Sign-In:</strong> When you sign in with your Google
        Account, we receive your name, email address, and profile picture (basic
        profile scopes only — we do not request access to your Gmail, Drive,
        Calendar, or other Google data).
      </p>
      <p className="t-body" style={p}>
        <strong>Through registration and program forms:</strong> If you register as
        a participant, volunteer, or mentor, we may collect your name, email
        address, ZIP code, current work situation, role or program interests, and
        any consents you provide during onboarding.
      </p>
      <p className="t-body" style={p}>
        <strong>Through your use of the platform:</strong> We keep records of your
        program enrollments, role assignments (e.g., moderator, mentor), and
        participation status within cycles and pods.
      </p>

      <h2 className="t-h2" style={h2}>2. How we use your information</h2>
      <p className="t-body" style={p}>We use the information we collect to:</p>
      <div style={{ marginBottom: 16 }}>
        {[
          "Create and manage your account and participant profile",
          "Match you to relevant cycles, pods, events, or mentorship opportunities",
          "Send you programmatic communications (e.g., invitations, onboarding steps, cycle updates) via email",
          "Operate moderator and admin tools that support program delivery",
          "Improve and maintain the platform",
        ].map((t) => (
          <div className="kv" key={t}>
            <span className="t-body">{t}</span>
          </div>
        ))}
      </div>
      <p className="t-body" style={p}>
        We do not sell your personal information, and we do not use it for
        advertising.
      </p>

      <h2 className="t-h2" style={h2}>3. How we store and protect information</h2>
      <p className="t-body" style={p}>
        Your information is stored in a hosted Postgres database (via Supabase) with
        access controls limiting who on our team can view participant data.
        Authentication is handled by Google OAuth and Supabase Auth; we do not store
        your Google password.
      </p>

      <h2 className="t-h2" style={h2}>4. Third-party services</h2>
      <p className="t-body" style={p}>
        We use the following third-party services to operate OLOS:
      </p>
      <div style={{ marginBottom: 16 }}>
        {[
          ["Google", "for account sign-in (OAuth)"],
          ["Supabase", "for database hosting and authentication infrastructure"],
          ["Resend", "for transactional and invitation emails sent from theupskillinglabs.org domains"],
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

      <h2 className="t-h2" style={h2}>5. Data retention and deletion</h2>
      <p className="t-body" style={p}>
        We retain participant data for as long as your account is active or as needed
        to operate our programs. You may request deletion of your account and
        associated data at any time by contacting us at the address below.
      </p>

      <h2 className="t-h2" style={h2}>6. Children’s privacy</h2>
      <p className="t-body" style={p}>
        OLOS is not directed at children under 13, and we do not knowingly collect
        information from children under 13.
      </p>

      <h2 className="t-h2" style={h2}>7. Changes to this policy</h2>
      <p className="t-body" style={p}>
        We may update this Privacy Policy from time to time. Material changes will be
        reflected by an updated effective date above.
      </p>

      <h2 className="t-h2" style={h2}>8. Contact us</h2>
      <p className="t-body" style={p}>
        Questions about this policy or your data can be sent to{" "}
        <a className="see" href="mailto:hq@theupskillinglabs.org">
          hq@theupskillinglabs.org
        </a>
        .
      </p>
    </ProsePage>
  );
}
