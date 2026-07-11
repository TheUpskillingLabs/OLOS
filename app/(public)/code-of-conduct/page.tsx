import { ProsePage } from "@/app/components/chrome/prose-page";

/* Code of Conduct — hosted on-site. Copy mirrors docs/legal/CODE_OF_CONDUCT.md
   (the source of truth); keep the two in sync when either changes. */

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Code of Conduct · The Upskilling Labs",
  description:
    "The expectations for everyone who takes part in The Upskilling Labs community.",
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

export default function CodeOfConductPage() {
  return (
    <ProsePage
      eyebrow="Community"
      title="Code of Conduct"
      lede="The expectations for everyone who takes part — so the Labs stays a place where anyone can show up, contribute, and belong."
    >
      <p className="t-small" style={{ marginBottom: 28 }}>
        Effective date: July 6, 2026
      </p>

      <p className="t-body" style={p}>
        The Upskilling Labs is a community built on learning together — openly, in
        person, and with respect. This Code of Conduct sets the expectations for
        everyone who takes part. It is part of the Participant Agreement every member
        accepts at registration, and it applies to all members equally, regardless of
        role.
      </p>

      <h2 className="t-h2" style={h2}>Who this applies to</h2>
      <p className="t-body" style={p}>
        This Code applies to every participant, volunteer, mentor, moderator, staff
        member, and guest, across every Labs space: pods and build cycles, workshops
        and events, the OLOS platform, our online channels, and any in-person meetup
        or venue where the Labs gathers.
      </p>

      <h2 className="t-h2" style={h2}>Our pledge</h2>
      <p className="t-body" style={p}>
        We are committed to making participation in the Labs a welcoming,
        harassment-free experience for everyone — regardless of age, background,
        disability, ethnicity, gender identity or expression, level of experience,
        national origin, personal appearance, race, religion, or sexual orientation.
      </p>

      <h2 className="t-h2" style={h2}>Expected behavior</h2>
      <List
        items={[
          "Be welcoming. Assume good faith, make room for newcomers, and remember everyone is here to learn.",
          "Be respectful. Disagree with ideas without attacking people.",
          "Be generous. Share what you know, credit others’ contributions, and help people who are stuck.",
          "Be collaborative. Communicate openly, follow through on commitments to your pod, and give and accept feedback gracefully.",
          "Look out for each other. If someone seems unsure or excluded, help them find their footing.",
        ]}
      />

      <h2 className="t-h2" style={h2}>Unacceptable behavior</h2>
      <List
        items={[
          "Harassment, intimidation, or discrimination in any form.",
          "Offensive, derogatory, or demeaning comments related to any of the characteristics above.",
          "Unwelcome sexual attention or advances, and any sexualized language or imagery in community spaces.",
          "Personal attacks, insults, trolling, or sustained disruption of events, talks, or discussions.",
          "Publishing others’ private information without their explicit permission.",
          "Any conduct that would be inappropriate in a professional or public community setting.",
        ]}
      />

      <h2 className="t-h2" style={h2}>Reporting a concern</h2>
      <p className="t-body" style={p}>
        If you experience or witness behavior that violates this Code — or have any
        concern about someone’s safety or conduct — please report it. Contact the
        Labs at{" "}
        <a className="see" href="mailto:hq@theupskillinglabs.org">
          hq@theupskillinglabs.org
        </a>
        . At in-person events, you can also raise it with any event organizer,
        moderator, or team lead. Reports are handled with discretion.
      </p>

      <h2 className="t-h2" style={h2}>Enforcement</h2>
      <p className="t-body" style={p}>
        Community organizers are responsible for upholding this Code. They may take
        any action they deem appropriate, including a private warning, removal from
        an event or channel, or suspension or termination of access to the Labs and
        the OLOS platform (consistent with our{" "}
        <a className="see" href="/terms">Terms of Service</a>).
      </p>

      <h2 className="t-h2" style={h2}>Scope beyond our spaces</h2>
      <p className="t-body" style={p}>
        This Code applies within Labs spaces and also when an individual is
        representing the Labs in public — for example, using an official channel or
        acting as an appointed representative at an event.
      </p>

      <h2 className="t-h2" style={h2}>Questions</h2>
      <p className="t-body" style={p}>
        Questions about this Code of Conduct can be sent to{" "}
        <a className="see" href="mailto:hq@theupskillinglabs.org">
          hq@theupskillinglabs.org
        </a>
        .
      </p>
      <p className="t-small" style={{ marginTop: 20 }}>
        Adapted in part from the Contributor Covenant, version 2.1.
      </p>
    </ProsePage>
  );
}
