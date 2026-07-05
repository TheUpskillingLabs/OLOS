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
const LEARNING_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);
const DIRECTORY_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export default function TabBar({
  initials,
  avatarUrl,
  hasEnrollment,
}: {
  initials: string;
  avatarUrl: string | null;
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
      <Link
        className={`tab${active("/learning")}`}
        id="tab-learning"
        href="/learning"
      >
        {LEARNING_SVG}
        <span>Learning</span>
      </Link>
      <Link
        className={`tab${active("/directory")}`}
        id="tab-directory"
        href="/directory"
      >
        {DIRECTORY_SVG}
        <span>Directory</span>
      </Link>
      <Link className={`tab${active("/profile")}`} id="tab-me" href="/profile">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="tab-avatar object-cover"
            style={{ padding: 0 }}
          />
        ) : (
          <span className="tab-avatar">{initials}</span>
        )}
        <span>Me</span>
      </Link>
    </nav>
  );
}
