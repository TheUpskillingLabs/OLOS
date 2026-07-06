import Link from "next/link";
import { ProsePage } from "@/app/components/chrome/prose-page";

/* The Team — leadership, board, and advisors. Copy from the old marketing
   site's team page (docs/marketing-site/pages/the-team.md). Vacant roles are
   shown as open positions linking to Get Involved. */

export const dynamic = "force-dynamic";

export const metadata = {
  title: "The Team · The Upskilling Labs",
  description:
    "The people behind The Upskilling Labs — the National Capital Region leadership team, board, and advisors.",
};

const TRAIL: [string, string | null][] = [
  ["Home", "/"],
  ["The Team", null],
];

// [name | null-if-open, role]
const LEADERSHIP: [string | null, string][] = [
  ["Madhu Jalan", "Programs & Events Co-Lead"],
  ["Aaron McKeever", "Programs & Events Co-Lead"],
  ["Jen Kemp", "Upskilling Experience Lead"],
  [null, "Communications & Marketing Lead"],
  [null, "Volunteer Coordination Lead"],
];

const BOARD: [string | null, string][] = [
  ["Sandra Moscoso", "President"],
  ["Ann Marie Guzzi", "Treasurer"],
  ["Jenna Schmidt", "Secretary"],
  ["Dr. Tati Warren", "At-Large Member"],
];

const ADVISORS: [string | null, string][] = [
  ["Ashwin Jaiprakash", "Advisor"],
  ["Elisabeth Pate", "Advisor"],
  ["Brendan Whitaker", "Advisor"],
];

function Group({ title, members }: { title: string; members: [string | null, string][] }) {
  return (
    <>
      <h2 className="t-h2" style={{ marginTop: 44, marginBottom: 16 }}>
        {title}
      </h2>
      <div className="cards two" style={{ marginBottom: 8 }}>
        {members.map(([name, role], i) => (
          <div className="lcard" style={{ padding: 22 }} key={`${role}-${i}`}>
            <div className="t-body" style={{ fontWeight: 600 }}>
              {name ?? (
                <Link className="see" href="/get-involved">
                  Open role →
                </Link>
              )}
            </div>
            <div className="lbl lbl-teal" style={{ marginTop: 6 }}>
              {role}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default function TeamPage() {
  return (
    <ProsePage
      eyebrow="National Capital Region"
      title="Meet the team"
      lede="The people building The Upskilling Labs — in the open, alongside a community of volunteers."
      trail={TRAIL}
    >
      <Group title="Leadership team" members={LEADERSHIP} />
      <Group title="Our board" members={BOARD} />
      <Group title="Advisors" members={ADVISORS} />

      <p className="t-body" style={{ marginTop: 40 }}>
        Want to join us? See the{" "}
        <Link className="see" href="/get-involved">ways to get involved</Link>.
      </p>
    </ProsePage>
  );
}
