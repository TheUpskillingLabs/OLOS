import Link from "next/link";
import type { ReactNode } from "react";
import Orb from "@/app/components/chrome/orb";
import { fmtDate, CONTENT_TYPE_LABEL } from "@/lib/content/format";
import type { EventRow, ResourceRow, MetroRow } from "@/lib/content/queries";

/* Teaser cards — every card is the metadata for its real page (owner
   decision: cards are teasers; no accordion expansion on browse cards).
   Ported from onboarding-proto's eventTeaser/resourceTeaser/labTeaser.

   `corner` is an optional overlay slot on the media frame (top-right) — the
   authed /learning page slots a SaveButton there. It's rendered inside the
   card's <Link>, so an interactive corner must stop its own click from
   navigating (SaveButton does). Public pages pass nothing → no overlay. */

export function MediaFrame({
  img,
  grad,
  tag,
  square,
  corner,
}: {
  img?: string | null;
  grad?: string | null;
  tag?: string | null;
  square?: boolean;
  corner?: ReactNode;
}) {
  const sq = square ? " sq" : "";
  if (img) {
    return (
      <div className={`media${sq}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={/^https?:\/\//.test(img) ? img : `/${img.replace(/^\//, "")}`}
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
        {tag && <div className="m-tag">{tag}</div>}
        {corner}
      </div>
    );
  }
  return (
    <div className={`media${sq} ${grad || "m-teal"}`}>
      <Orb />
      {tag && <div className="m-tag">{tag}</div>}
      {corner}
    </div>
  );
}

export function EventTeaser({
  event: e,
  corner,
}: {
  event: EventRow;
  corner?: ReactNode;
}) {
  return (
    <Link className="card tappable" href={`/events/${e.slug}`}>
      <MediaFrame
        img={e.img}
        grad={e.grad}
        tag={e.kind || (e.location_type === "virtual" ? "Virtual" : "In person")}
        square
        corner={corner}
      />
      <div className="card-body">
        <div className="lbl lbl-teal">{fmtDate(e.start_at)}</div>
        <div className="t-h4" style={{ margin: "6px 0 4px" }}>
          {e.anchor ? "✦ " : ""}
          {e.name}
        </div>
        <p className="t-small">{e.location_name}</p>
      </div>
    </Link>
  );
}

export function ResourceTeaser({
  resource: r,
  corner,
}: {
  resource: ResourceRow;
  corner?: ReactNode;
}) {
  const typeLabel = CONTENT_TYPE_LABEL[r.content_type] || "Guide";
  return (
    <Link className="card tappable" href={`/library/${r.slug}`}>
      <MediaFrame img={r.img} grad={r.grad} tag={typeLabel} square corner={corner} />
      <div className="card-body">
        <div className="lbl lbl-teal">{r.meta || ""}</div>
        <div className="t-h4" style={{ margin: "6px 0 4px" }}>
          {r.title}
        </div>
        <p className="t-small">{r.summary || ""}</p>
      </div>
    </Link>
  );
}

export function LabTeaser({ metro: m }: { metro: MetroRow }) {
  const sub =
    m.status === "active"
      ? `${m.partner ?? ""} · ${m.members ?? 0} members`
      : `${m.waiting} ${m.waiting === 1 ? "person" : "people"} waiting`;
  return (
    <Link className="card tappable" href={`/local-labs/${m.slug}`}>
      <MediaFrame grad={m.slug === "dc" ? "m-navy" : "m-forest"} tag={m.slug === "dc" ? "Flagship" : ""} />
      <div className="card-body">
        <div className="card-row" style={{ marginBottom: 6 }}>
          {m.status === "active" ? (
            <span className="status active">Active</span>
          ) : (
            <span className="status forming">Waitlist open</span>
          )}
        </div>
        <div className="t-h4" style={{ marginBottom: 4 }}>
          {m.name}
          {m.st && m.slug !== "dc" ? `, ${m.st}` : ""}
        </div>
        <p className="t-small">{sub}</p>
      </div>
    </Link>
  );
}

export function Crumbs({ trail }: { trail: [string, string | null][] }) {
  return (
    <div className="crumbs">
      {trail.map(([label, href], i) => (
        <span key={label} style={{ display: "contents" }}>
          {i > 0 && <span className="sep">/</span>}
          {href ? <Link href={href}>{label}</Link> : <span>{label}</span>}
        </span>
      ))}
    </div>
  );
}
