"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";

/* Distribute the field survey (SENSEMAKING_FLOW.md §2, Stage 1 "Distribute").
   A member's first-CTA card pairs "contribute" with this "share" action so the
   cohort casts the widest net for field observations. Uses the native share
   sheet on mobile, falls back to copying the link on desktop. */

export default function ShareSurveyButton({
  slug,
  title,
}: {
  slug: string;
  title: string;
}) {
  const [copied, setCopied] = useState(false);

  const onShare = async () => {
    const url = `${window.location.origin}/survey/${slug}`;
    const shareData = {
      title,
      text: "Share what you're seeing in the field — it shapes what we build.",
      url,
    };
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User dismissed the share sheet, or it failed — no fallback needed.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — nothing more we can do here.
    }
  };

  return (
    <button
      type="button"
      onClick={onShare}
      className="inline-flex items-center gap-1.5 rounded-card border border-teal/40 px-4 py-2 text-sm font-semibold tracking-tight text-teal-deep transition-colors duration-150 hover:bg-teal/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
      aria-live="polite"
    >
      {copied ? (
        <>
          <Check className="h-4 w-4" aria-hidden />
          Link copied
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4" aria-hidden />
          Share the survey
        </>
      )}
    </button>
  );
}
