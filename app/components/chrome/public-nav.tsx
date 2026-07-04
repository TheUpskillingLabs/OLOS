"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { DONATE_URL } from "@/lib/donate";

/* The public bar — ported from onboarding-proto chrome.js publicNavHTML
   (.sitenav): logo · destinations · quiet Log in · red Donate (owner
   decision, July 2026: Join retired from the bar — the hero and the upsell
   band carry the join ask; the bar's button raises money). Donate opens
   every.org's donation popup (button.js in the root layout intercepts the
   coded link; plain hosted checkout is the no-script fallback).
   Auth-aware: signed-in visitors get Home + their avatar. Collapses to the
   hamburger below 1024px (the public bar needs the room — deliberate
   breakpoint, distinct from the app bar's 768px).
   The Work ▾ menu and the search field arrive with their stages. */

const DESTS = [
  { key: "events", label: "Events", href: "/events" },
  { key: "library", label: "Library", href: "/library" },
  { key: "labs", label: "Cities", href: "/labs" },
];

export default function PublicNav({
  signedIn,
  initials,
  overHero = false,
}: {
  signedIn: boolean;
  initials: string | null;
  overHero?: boolean;
}) {
  const pathname = usePathname() || "";
  const [open, setOpen] = useState(false);
  const active = (href: string) =>
    pathname === href || pathname.startsWith(href + "/") ? " active" : "";

  return (
    <header className={`sitenav${overHero ? " overhero" : ""}`} id="site-nav">
      <div className="sitenav-inner">
        <Link className="sitenav-brand" href="/">
          <Image
            src="/assets/logo-lockup-light.png"
            alt="The Upskilling Labs"
            width={202}
            height={56}
            style={{ height: 56, width: "auto" }}
            priority
          />
        </Link>
        <nav className="nav-links sitenav-links">
          {DESTS.map((d) => (
            <Link key={d.key} className={`nav-link${active(d.href)}`} href={d.href}>
              {d.label}
            </Link>
          ))}
        </nav>
        {signedIn ? (
          <span className="sitenav-auth">
            <Link className="nav-link pn-login" href="/dashboard">
              Home
            </Link>
            <Link className="pg-avatar" href="/profile" aria-label="Your profile">
              {initials || "U"}
            </Link>
          </span>
        ) : (
          <span className="sitenav-auth">
            <Link className="nav-link pn-login" href="/login">
              Log in
            </Link>
            <a
              className="sitenav-cta"
              href={DONATE_URL}
              target="_blank"
              rel="noopener"
            >
              Donate
            </a>
          </span>
        )}
        <button
          className="ham-btn"
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? (
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 5L17 17M17 5L5 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="5" width="18" height="2" rx="1" fill="currentColor" />
              <rect x="2" y="10" width="18" height="2" rx="1" fill="currentColor" />
              <rect x="2" y="15" width="18" height="2" rx="1" fill="currentColor" />
            </svg>
          )}
        </button>
      </div>
      <nav className={`ham-menu${open ? " open" : ""}`} onClick={() => setOpen(false)}>
        {signedIn && (
          <>
            <Link className="nav-link" href="/dashboard">Home</Link>
            <Link className="nav-link" href="/profile">Your profile</Link>
          </>
        )}
        {DESTS.map((d) => (
          <Link key={d.key} className="nav-link" href={d.href}>
            {d.label}
          </Link>
        ))}
        <Link className="nav-link" href="/build-cycles">Build Cycles</Link>
        <Link className="nav-link" href="/about">About</Link>
        {!signedIn && (
          <Link className="nav-link" href="/login">Log in</Link>
        )}
        <a className="nav-link" href={DONATE_URL} target="_blank" rel="noopener">
          Donate
        </a>
      </nav>
    </header>
  );
}
