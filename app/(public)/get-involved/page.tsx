import Link from "next/link";
import { ProsePage } from "@/app/components/chrome/prose-page";

/* Get Involved — volunteer & mentor pathways. Copy adapted from the old
   marketing site's Volunteer + Open Roles pages
   (docs/marketing-site/pages/volunteer.md, open-roles.md). */

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Get Involved · The Upskilling Labs",
  description:
    "Everything the Labs does is made possible by volunteers. Mentor, help at an event, or help build the Labs itself.",
};

const h2 = { marginTop: 44, marginBottom: 16 } as const;

const TEAMS: [string, string][] = [
  ["Mentors", "Experienced practitioners who guide pods and participants through real problems — a single workshop or a whole build cycle, shaped by your availability."],
  ["Programs & Events", "Organize the workshops, panels, and meetups where learning happens and connections are made."],
  ["Communications", "Branding, storytelling, and PR — the voice and visual identity of everything we do."],
  ["Participant Success", "Support Upskillers throughout their journey; keep pods engaged and moving."],
  ["Research & Development", "Build and maintain the tech that powers the Labs, from the website to community infrastructure."],
  ["Governance", "Provide strategic oversight so the Labs stays true to its mission and built to last."],
];

export default function GetInvolvedPage() {
  return (
    <ProsePage
      eyebrow="Volunteer with The Labs"
      title="Everything we do is made possible by volunteers."
      lede="Whether you’re sharing your expertise, showing up to support an event, or helping build the Labs from the ground up, there’s a place for you here."
    >
      <h2 className="t-h2" style={h2}>Join us for a day — or a build cycle</h2>
      <p className="t-body" style={{ marginBottom: 16 }}>
        Mentors help Upskillers go deep on a theme with subject-matter knowledge, and
        unblock them when they’re stuck — from prompt engineering to deploying a first
        app. And volunteers for the Labs itself help us build the engine that powers
        all of it.
      </p>

      <h2 className="t-h2" style={h2}>Where you can plug in</h2>
      <div className="cards two" style={{ marginBottom: 40 }}>
        {TEAMS.map(([t, b]) => (
          <div className="lcard" style={{ padding: 22 }} key={t}>
            <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>
              {t}
            </div>
            <p className="t-small">{b}</p>
          </div>
        ))}
      </div>

      <h2 className="t-h2" style={h2}>Ready to jump in?</h2>
      <p className="t-body" style={{ marginBottom: 24 }}>
        However you want to help — mentor, organizer, or builder — it starts with the
        same account, one door for everyone. Create one to get started and tell us how
        you’d like to take part when you sign up, or reach out if you’d like to talk
        through where you might fit.
      </p>
      <Link className="btn btn-red btn-lg" href="/login?intent=join">
        Join The Labs
      </Link>
      <p style={{ marginTop: 16 }}>
        <a className="see" href="mailto:hq@theupskillinglabs.org">
          Questions? Email us →
        </a>
      </p>
    </ProsePage>
  );
}
