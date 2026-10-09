import type { Metadata } from "next";
import { DeckClient } from "@/app/components/ambassador/deck/deck-client";
import { upcomingAmbassadorSessions } from "@/lib/ambassador/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Present · The Upskilling Labs",
  robots: { index: false, follow: false },
};

/* The boilerplate deck, full screen with no app chrome.
     /ambassador/present            full-screen presentation
     ?short                         60-second version (slides 1, 5, 6)
     ?notes                         laptop notes view (current, next, cues, timer);
                                    drives a presentation window on the same device
     ?practice                      cues visible beneath each slide
   Flags combine (e.g. ?short&practice). */
export default async function PresentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const sessions = await upcomingAmbassadorSessions(2);
  return <DeckClient sessions={sessions} short={"short" in q} notes={"notes" in q} practice={"practice" in q} />;
}
