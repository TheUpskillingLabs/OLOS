import { ProsePage } from "@/app/components/chrome/prose-page";

/* Our Board — the board of directors of The Upskilling Labs, Inc. Copy from
   the old marketing site's team page (docs/marketing-site/pages/the-team.md). */

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Our Board · The Upskilling Labs",
  description:
    "The board of directors of The Upskilling Labs, Inc.",
};

// [name, role]
const BOARD: [string, string][] = [
  ["Sandra Moscoso", "President"],
  ["Ann Marie Guzzi", "Treasurer"],
  ["Jenna Schmidt", "Secretary"],
  ["Dr. Tati Warren", "At-Large Member"],
];

export default function BoardPage() {
  return (
    <ProsePage
      eyebrow="The Upskilling Labs, Inc."
      title="Our board"
      lede="The board of directors guiding our work — building in the open, alongside a community of volunteers."
    >
      <div className="cards two" style={{ marginBottom: 8 }}>
        {BOARD.map(([name, role]) => (
          <div className="lcard" style={{ padding: 22 }} key={role}>
            <div className="t-body" style={{ fontWeight: 600 }}>
              {name}
            </div>
            <div className="lbl lbl-teal" style={{ marginTop: 6 }}>
              {role}
            </div>
          </div>
        ))}
      </div>

      <p className="t-body" style={{ marginTop: 40 }}>
        This is a working board. In our founding chapter, our directors are
        hands-on &mdash; laying the governance, financial, and programmatic
        foundations that everything ahead is built on.
      </p>
      <p className="t-body" style={{ marginTop: 16 }}>
        Today, The Upskilling Labs runs entirely on volunteer time. We&rsquo;re
        building groundwork strong enough to grow on &mdash; and working toward
        the fully staffed organization this mission deserves.
      </p>
    </ProsePage>
  );
}
