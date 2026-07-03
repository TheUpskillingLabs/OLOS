"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/* The app bottom tab bar (phone furniture, <768px) — ported from
   onboarding-proto chrome.js appTabbarHTML. Real links; the Me tab carries
   the avatar. Hidden on persona surfaces (they get the pill + exit link). */

const HOME_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
  </svg>
);
const CYCLE_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <polyline points="21 3 21 9 15 9" />
  </svg>
);
const PULSE_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

export default function TabBar({
  initials,
  hasEnrollment,
}: {
  initials: string;
  hasEnrollment: boolean;
}) {
  const pathname = usePathname() || "";
  if (pathname.startsWith("/admin") || pathname.startsWith("/moderator")) {
    return null;
  }
  const active = (prefix: string) =>
    pathname === prefix || pathname.startsWith(prefix + "/") ? " active" : "";

  return (
    <nav className="tabbar">
      <Link className={`tab${active("/dashboard")}`} id="tab-home" href="/dashboard">
        {HOME_SVG}
        <span>Home</span>
      </Link>
      {hasEnrollment && (
        <Link className={`tab${active("/cycles")}`} id="tab-cycle" href="/cycles">
          {CYCLE_SVG}
          <span>Cycle</span>
        </Link>
      )}
      {hasEnrollment && (
        <Link className={`tab${active("/pulse-check")}`} id="tab-pulse" href="/pulse-check">
          {PULSE_SVG}
          <span>Pulse</span>
        </Link>
      )}
      <Link className={`tab${active("/profile")}`} id="tab-me" href="/profile">
        <span className="tab-avatar">{initials}</span>
        <span>Me</span>
      </Link>
    </nav>
  );
}
