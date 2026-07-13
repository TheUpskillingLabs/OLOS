"use client";

import { useState } from "react";
import Link from "next/link";
import Monogram from "@/app/components/content/monogram";
import { initials } from "@/lib/content/format";
import ShareStoryModal from "@/app/components/content/share-story-modal";
import type { Spotlight, SpotlightTag } from "@/lib/content/spotlights";

/* Upskiller Spotlights — the client half of /stories: filter chips, an
   on-brand gallery whose cards link to each spotlight's own page
   (/stories/[slug]), and the shared "Share your story" modal (components/content).
   The published spotlights are fetched server-side and passed in. */

const CATS: [string, string][] = [
  ["all", "All stories"],
  ["builder", "Builders"],
  ["mentor", "Mentors"],
  ["career_changer", "Career changers"],
];

const TAG_LABELS: Record<SpotlightTag, string> = {
  builder: "Builder",
  mentor: "Mentor",
  career_changer: "Career changer",
  other: "Story",
};

function imgSrc(url: string): string {
  return /^https?:\/\//.test(url) ? url : `/${url.replace(/^\//, "")}`;
}

export default function StoriesClient({ spotlights }: { spotlights: Spotlight[] }) {
  const [filter, setFilter] = useState<string>("all");
  const [shareOpen, setShareOpen] = useState(false);

  const list = spotlights.filter((s) => filter === "all" || s.tag === filter);

  return (
    <>
      {/* Share CTA + filter chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {CATS.map(([v, label]) => (
            <button
              key={v}
              type="button"
              className={`chip${filter === v ? " active" : ""}`}
              onClick={() => setFilter(v)}
              aria-pressed={filter === v}
            >
              {label}
            </button>
          ))}
        </div>
        <button className="btn btn-red" type="button" onClick={() => setShareOpen(true)}>
          Share your story
        </button>
      </div>

      {list.length ? (
        <div className="spot-grid">
          {list.map((s) => {
            const first = s.name.split(" ")[0];
            return (
              <Link
                key={s.id}
                href={s.slug ? `/stories/${s.slug}` : "/stories"}
                className="card tappable spot-card"
              >
                <div
                  className={s.image_url ? "spot-media" : `spot-media ${s.grad || "m-teal"}`}
                  aria-hidden="true"
                >
                  {s.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imgSrc(s.image_url)}
                      alt=""
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        objectPosition: "center 20%",
                      }}
                    />
                  ) : (
                    <Monogram label={initials(s.name, 2)} />
                  )}
                </div>
                <div className="card-body">
                  <span className="spot-tag">{s.tag_label || TAG_LABELS[s.tag]}</span>
                  {s.quote && (
                    <p className="t-body story-quote" style={{ margin: "12px 0 14px" }}>
                      &ldquo;{s.quote}&rdquo;
                    </p>
                  )}
                  <div className="t-h4">{s.name}</div>
                  {s.role && <div className="lbl" style={{ marginTop: 4 }}>{s.role}</div>}
                  <span className="see" style={{ display: "inline-block", marginTop: 14 }}>
                    Read {first}&rsquo;s story →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="lcard" style={{ padding: 40, textAlign: "center" }}>
          <div className="t-h3" style={{ marginBottom: 8 }}>
            {spotlights.length ? "No stories in this filter yet" : "The first spotlights are coming"}
          </div>
          <p className="t-body text-meta" style={{ maxWidth: "48ch", margin: "0 auto 18px" }}>
            {spotlights.length
              ? "Try another filter."
              : "Members are sharing what they built and what changed. Yours could be the first one here."}
          </p>
          <button className="btn btn-red" type="button" onClick={() => setShareOpen(true)}>
            Share your story
          </button>
        </div>
      )}

      {/* Closing CTA band */}
      <div className="grain" style={{ background: "var(--ink)", color: "#fff", borderRadius: "var(--r)", marginTop: 48, overflow: "hidden" }}>
        <div style={{ padding: 40, display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>Your turn</div>
            <h2 className="t-h2" style={{ marginBottom: 8 }}>Every spotlight started as a first week</h2>
            <p className="t-body" style={{ color: "var(--od2)" }}>
              Tell the community what you practiced, what broke, and what changed. The Labs
              team edits it with you before anything goes live.
            </p>
          </div>
          <button className="btn btn-red btn-lg" type="button" onClick={() => setShareOpen(true)}>
            Share your story
          </button>
        </div>
      </div>

      {shareOpen && <ShareStoryModal onClose={() => setShareOpen(false)} />}
    </>
  );
}
