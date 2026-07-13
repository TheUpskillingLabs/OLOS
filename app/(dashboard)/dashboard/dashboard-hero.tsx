"use client";

import { useEffect, useState } from "react";

/* The dashboard hero — the signed-in identity band (prototype panel-dashboard
   ".app-cover"): a warm dark gradient cover carrying the member's avatar, a
   greeting, a one-line status, and (when engaged) an at-a-glance stat strip.
   LinkedIn's identity header married to Airbnb's rounded cover.

   Dismissible (July 2026 feedback: "make the big blue hero dismissible") —
   the choice persists in localStorage like the other member-local dashboard
   preferences, so it's a client component now. The "view your full profile"
   CTA was struck from the header in the same feedback pass (the avatar menu
   covers it). */

export interface HeroStat {
  value: string | number;
  label: string;
}

const KEY = "olos.heroDismissed.v1";

export default function DashboardHero({
  initials,
  avatarUrl,
  eyebrow,
  greeting,
  lede,
  stats,
}: {
  initials: string;
  avatarUrl?: string | null;
  eyebrow: string;
  greeting: string;
  lede: string;
  stats?: HeroStat[];
}) {
  const [state, setState] = useState<"pending" | "shown" | "dismissed">(
    "pending"
  );

  useEffect(() => {
    // Deferred past the effect body (repo pattern — see up-next.tsx) so the
    // localStorage read isn't a synchronous setState-in-effect.
    queueMicrotask(() => {
      try {
        setState(localStorage.getItem(KEY) === "1" ? "dismissed" : "shown");
      } catch {
        setState("shown");
      }
    });
  }, []);

  const dismiss = () => {
    setState("dismissed");
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* best effort */
    }
  };

  // Render nothing until the store is read, so a dismissed hero never flashes.
  if (state !== "shown") return null;

  return (
    <section className="app-cover s-cover grain on-dark relative mb-8 rounded-card shadow-card">
      <button
        type="button"
        aria-label="Hide the welcome banner"
        onClick={dismiss}
        className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-xl leading-none text-white/70 transition-colors duration-150 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        ×
      </button>
      <div className="app-cover-inner px-6 sm:px-10">
        <div className="flex flex-wrap items-center gap-5 sm:gap-7">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              aria-hidden
              referrerPolicy="no-referrer"
              className="avatar-lg object-cover"
            />
          ) : (
            <div className="avatar-lg" aria-hidden>
              {initials}
            </div>
          )}
          {/* min-w only from sm: — on a 360-390px phone a hard 220px floor
              can't fit beside the avatar and forces an awkward avatar-only
              wrap line. */}
          <div className="min-w-0 flex-1 sm:min-w-[220px]">
            <div className="lbl lbl-teal mb-2">{eyebrow}</div>
            <h1 className="t-h1">{greeting}</h1>
            <p className="t-lede mt-2">{lede}</p>
          </div>
          {stats && stats.length > 0 && (
            <div className="flex gap-7 sm:gap-9">
              {stats.map((s) => (
                <div key={s.label}>
                  <div
                    className="text-3xl font-bold leading-none tracking-tight tabular-nums"
                    style={{ color: "var(--teal)" }}
                  >
                    {s.value}
                  </div>
                  <div className="lbl mt-2">{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
