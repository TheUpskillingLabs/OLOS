"use client";

import { useEffect, useRef, useState } from "react";

/**
 * An announcement body that clamps to 5 lines and offers a "Show more" toggle
 * when the text actually overflows. Server-rendered inside the org-news rail
 * (AnnouncementsPanel); it stays collapsed for short bodies (no toggle), and
 * only long ones grow a control — so a wall of text no longer gets silently
 * cut off with no way to read the rest.
 *
 * Overflow is measured after paint (and on resize, since the rail width shifts
 * across breakpoints): compare the clamped element's scrollHeight to its
 * clientHeight while collapsed.
 */
export default function AnnouncementBody({ body }: { body: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Only meaningful while collapsed — an expanded element never overflows.
    const measure = () => {
      if (expanded) return;
      setOverflowing(el.scrollHeight > el.clientHeight + 1);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [body, expanded]);

  return (
    <>
      <p
        ref={ref}
        className={`mt-1 whitespace-pre-line break-words text-xs leading-relaxed text-charcoal${
          expanded ? "" : " line-clamp-5"
        }`}
      >
        {body}
      </p>
      {(overflowing || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-[11px] font-semibold text-teal-deep transition-colors duration-150 hover:underline"
          aria-expanded={expanded}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </>
  );
}
