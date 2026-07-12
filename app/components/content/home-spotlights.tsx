"use client";

import { useState } from "react";
import Orb from "@/app/components/chrome/orb";
import ShareStoryModal from "@/app/components/content/share-story-modal";
import type { Spotlight } from "@/lib/content/spotlights";

/* The landing's Upskiller Spotlights row. The spotlight pages themselves are
   unlisted (owner decision, July 2026): the quote cards stay but no longer
   link to /stories/[slug], and the "Share your story" card opens the
   submission modal right here instead of routing to /stories. */

export default function HomeSpotlights({ spotlights }: { spotlights: Spotlight[] }) {
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <section className="section s-white sec-after-hero" id="sec-stories">
      <div className="story-bleed">
        <div className="story-row">
          {spotlights.slice(0, 6).map((s) => (
            <div key={s.id} className="card story-card">
              <div
                className={s.image_url ? "story-media" : `story-media ${s.grad || "m-teal"}`}
                aria-hidden="true"
              >
                {s.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={/^https?:\/\//.test(s.image_url) ? s.image_url : `/${s.image_url.replace(/^\//, "")}`}
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
                  <Orb />
                )}
              </div>
              <div className="card-body">
                <p className="t-body story-quote">&ldquo;{s.quote}&rdquo;</p>
                <div className="t-h4" style={{ marginTop: "auto" }}>
                  {s.name}
                </div>
                {s.role && (
                  <div className="lbl" style={{ marginTop: 4 }}>
                    {s.role}
                  </div>
                )}
              </div>
            </div>
          ))}
          <button
            className="card tappable story-cta"
            type="button"
            onClick={() => setShareOpen(true)}
            style={{ textAlign: "left", font: "inherit" }}
          >
            <div
              className="card-body"
              style={{ display: "flex", flexDirection: "column", height: "100%" }}
            >
              <div className="lbl lbl-teal" style={{ marginBottom: 10 }}>
                Your turn
              </div>
              <div className="t-h3" style={{ marginBottom: 10 }}>
                Share your story
              </div>
              <p className="t-body" style={{ marginBottom: 18 }}>
                Spotlights are public — the Labs team edits it with you before
                anything goes live.
              </p>
              <span className="see" style={{ marginTop: "auto" }}>
                Share your story →
              </span>
            </div>
          </button>
        </div>
      </div>
      {shareOpen && <ShareStoryModal onClose={() => setShareOpen(false)} />}
    </section>
  );
}
