import { ProsePage } from "@/app/components/chrome/prose-page";

/* Our Board — the board of directors of The Upskilling Labs, Inc. Copy from
   the old marketing site's team page (docs/marketing-site/pages/the-team.md). */

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Our Board · The Upskilling Labs",
  description:
    "The board of directors of The Upskilling Labs, Inc.",
};

// [name, role, headshot filename in /assets/board-headshots]
const BOARD: [string, string, string][] = [
  ["Sandra Moscoso", "President", "Sandra.webp"],
  ["Ann Marie Guzzi", "Treasurer", "AMG.webp"],
  ["Jenna Schmidt", "Secretary", "Jenna.webp"],
  ["Dr. Tati Warren", "At-Large Member", "tati.webp"],
];

export default function BoardPage() {
  return (
    <ProsePage
      eyebrow="The Upskilling Labs, Inc."
      title="Our board"
      lede="The board of directors guiding our work — building in the open, alongside a community of volunteers."
    >
      <div className="cards two" style={{ marginBottom: 8 }}>
        {BOARD.map(([name, role, img]) => (
          <div
            className="lcard"
            style={{ padding: 22, display: "flex", alignItems: "center", gap: 18 }}
            key={role}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/assets/board-headshots/${img}`}
              alt={name}
              width={88}
              height={88}
              style={{
                width: 88,
                height: 88,
                borderRadius: "50%",
                objectFit: "cover",
                objectPosition: "center 20%",
                flexShrink: 0,
                border: "1px solid var(--rule)",
                background: "var(--paper-edge)",
              }}
            />
            <div>
              <div className="t-body" style={{ fontWeight: 600 }}>
                {name}
              </div>
              <div className="lbl lbl-teal" style={{ marginTop: 6 }}>
                {role}
              </div>
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
