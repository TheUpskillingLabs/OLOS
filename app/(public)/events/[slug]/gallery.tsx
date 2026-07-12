"use client";

import { useState } from "react";
import { MediaFrame } from "@/app/components/content/teasers";

/* The event-detail gallery — the generator's #ev-gallery/#ev-dots pair:
   a horizontal scroll-snap track of up to 3 slides (the photo first when
   the event has one, then gradient orb slides), with scroll-synced dots
   (the generator's pageJS: dot index = round(scrollLeft / clientWidth)). */
export default function Gallery({
  img,
  gallery,
}: {
  img: string | null;
  gallery: string[] | null;
}) {
  const slides = (img ? ["IMG"] : [])
    .concat(gallery ?? ["m-teal", "m-forest", "m-navy"])
    .slice(0, 3);
  const [active, setActive] = useState(0);

  return (
    <div className="gallery">
      <div
        className="gallery-track"
        onScroll={(ev) => {
          const t = ev.currentTarget;
          setActive(Math.round(t.scrollLeft / t.clientWidth));
        }}
      >
        {slides.map((g, i) =>
          g === "IMG" ? (
            <MediaFrame key={i} img={img} />
          ) : (
            <MediaFrame key={i} grad={g} />
          )
        )}
      </div>
      <div className="gallery-dots">
        {slides.map((_, i) => (
          <i key={i} className={i === active ? "on" : ""} />
        ))}
      </div>
    </div>
  );
}
