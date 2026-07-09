"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import NavSearch from "./nav-search";

/* Destination icons for the mobile top strip (< 768px), ported from the retired
   bottom tab bar. LinkedIn-mobile-web posture: navigation rides the top bar. */
const HOME_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
  </svg>
);
const CYCLE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <polyline points="21 3 21 9 15 9" />
  </svg>
);
const LEARNING_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);
const DIRECTORY_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

/* The signed-in app bar — ported from onboarding-proto chrome.js (.sitenav.appnav).
   Design rules carried over (owner decisions):
   - the logo only ever sits on dark navy;
   - destinations left of the avatar; the avatar IS "Me" — not a link, a menu
     whose first item is a filled Profile button;
   - persona surfaces (/moderator, /admin) swap the destinations for the
     persona pill + "Exit to member view";
   - View as (Upskiller / Poderator / Admin) lives in the avatar menu with
     menuitemradio semantics — real gating stays server-side.
   Prototype destinations (Home · My Cycle · Learning · Directory) map onto
   OLOS's live routes; Learning/Directory join when those stages land. */

export interface AppNavProps {
  initials: string;
  /** The member's profile photo (uploaded or Google); initials when null. */
  avatarUrl: string | null;
  displayName: string;
  isAdmin: boolean;
  isModerator: boolean;
  showPods: boolean;
  hasEnrollment: boolean;
  /** The weekly Learning Log gate is armed and unmet — Home carries the
      red pip (the ritual lives on the dashboard, not in the nav). */
  logDue: boolean;
  /** Tester account — the avatar menu carries a "Reset Test Account" item. */
  isTest: boolean;
  /** The label for the Poderator persona — "Co-lead" when every pod this
      member moderates is an org workstream run, "Poderator" otherwise
      (B-2). Persona derivation from the pathname is unchanged; this only
      swaps the copy. */
  moderatorPersonaLabel?: string;
  /** Local Labs (docs/LOCAL_LABS.md): the /lab/[slug] workspace of the
      first lab this member leads; null when they lead none. Adds a "Lab
      lead" entry to the View-as switcher. */
  labLeadHref?: string | null;
}

export default function AppNav({
  initials,
  avatarUrl,
  displayName,
  isAdmin,
  isModerator,
  showPods,
  hasEnrollment,
  logDue,
  isTest,
  moderatorPersonaLabel = "Poderator",
  labLeadHref = null,
}: AppNavProps) {
  const pathname = usePathname() || "";
  const persona = pathname.startsWith("/admin")
    ? "admin"
    : pathname.startsWith("/moderator")
      ? "poderator"
      : pathname.startsWith("/lab/")
        ? "lablead"
        : null;

  return (
    <header className="sitenav appnav" id="site-nav">
      <div className="sitenav-inner">
        <Link className="sitenav-brand" href="/dashboard">
          <Image
            src="/assets/logo-lockup-light.png"
            alt="The Upskilling Labs"
            width={202}
            height={56}
            style={{ height: 56, width: "auto" }}
            priority
          />
        </Link>
        {persona ? (
          <>
            <span className="persona-lbl">
              {persona === "admin"
                ? "Admin"
                : persona === "lablead"
                  ? "Lab lead"
                  : moderatorPersonaLabel}
            </span>
            <Link className="nav-link exit-member" href="/dashboard">
              Exit to member view
            </Link>
          </>
        ) : (
          <>
            {/* LinkedIn-style global search — logo, then search (owner rule:
                the logo only ever sits on dark navy; the input matches). */}
            <NavSearch />
            <nav className="nav-links appnav-links">
            <Link
              className={`nav-link${isActive(pathname, "/dashboard") ? " active" : ""}`}
              id="nav-home"
              href="/dashboard"
            >
              {logDue && (
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-block",
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    marginRight: 7,
                    verticalAlign: 2,
                    background: "var(--red)",
                  }}
                />
              )}
              Home{logDue ? " · Log due" : ""}
            </Link>
            {hasEnrollment && (
              <Link
                className={`nav-link${isActive(pathname, "/cycles") ? " active" : ""}`}
                id="nav-cycle"
                href="/cycles"
              >
                My Cycle
              </Link>
            )}
            <Link
              className={`nav-link${isActive(pathname, "/learning") ? " active" : ""}`}
              id="nav-learning"
              href="/learning"
            >
              Learning
            </Link>
            <Link
              className={`nav-link${isActive(pathname, "/directory") ? " active" : ""}`}
              id="nav-directory"
              href="/directory"
            >
              Directory
            </Link>
            </nav>
          </>
        )}
        <AvatarMenu
          initials={initials}
          avatarUrl={avatarUrl}
          displayName={displayName}
          isAdmin={isAdmin}
          isModerator={isModerator}
          showPods={showPods}
          persona={persona}
          isTest={isTest}
          moderatorPersonaLabel={moderatorPersonaLabel}
          labLeadHref={labLeadHref}
        />
      </div>
      {/* Mobile destination strip (< 768px) — the top-bar nav that replaces the
          old fixed bottom tab bar. Hidden on persona surfaces (admin/moderator)
          and on desktop, where the text nav-links above take over. */}
      {!persona && (
        <nav className="appnav-mobile" aria-label="Sections">
          <Link
            className={`am-tab${isActive(pathname, "/dashboard") ? " active" : ""}`}
            href="/dashboard"
          >
            <span className="am-icon">
              {HOME_ICON}
              {logDue && <span className="am-pip" aria-hidden />}
            </span>
            <span>Home</span>
          </Link>
          {hasEnrollment && (
            <Link
              className={`am-tab${isActive(pathname, "/cycles") ? " active" : ""}`}
              href="/cycles"
            >
              <span className="am-icon">{CYCLE_ICON}</span>
              <span>Cycle</span>
            </Link>
          )}
          <Link
            className={`am-tab${isActive(pathname, "/learning") ? " active" : ""}`}
            href="/learning"
          >
            <span className="am-icon">{LEARNING_ICON}</span>
            <span>Learning</span>
          </Link>
          <Link
            className={`am-tab${isActive(pathname, "/directory") ? " active" : ""}`}
            href="/directory"
          >
            <span className="am-icon">{DIRECTORY_ICON}</span>
            <span>Directory</span>
          </Link>
        </nav>
      )}
    </header>
  );
}

function isActive(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

function AvatarMenu({
  initials,
  avatarUrl,
  displayName,
  isAdmin,
  isModerator,
  showPods,
  persona,
  isTest,
  moderatorPersonaLabel,
  labLeadHref,
}: {
  initials: string;
  avatarUrl: string | null;
  displayName: string;
  isAdmin: boolean;
  isModerator: boolean;
  showPods: boolean;
  persona: "admin" | "poderator" | "lablead" | null;
  isTest: boolean;
  moderatorPersonaLabel: string;
  labLeadHref: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const canViewAs = isAdmin || isModerator || showPods || !!labLeadHref;

  // Esc / outside-click close + ArrowUp/Down cycling — the shared.js contract.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      const menu = wrapRef.current?.querySelector("#avatar-menu");
      if (!menu) return;
      if (e.key === "Escape") {
        setOpen(false);
        (wrapRef.current?.querySelector(".appbar-avatar") as HTMLElement)?.focus();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const items = Array.from(
          menu.querySelectorAll<HTMLElement>("a.menu-item, button.menu-item")
        );
        const i = items.indexOf(document.activeElement as HTMLElement);
        items[
          (e.key === "ArrowDown" ? i + 1 : i - 1 + items.length) % items.length
        ]?.focus();
      }
    };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Full navigation to the public home page (not router.push) so the
    // server re-renders with the cleared session — the signed-out landing,
    // not the login screen.
    window.location.href = "/";
  };

  // Tester-only self-reset (testing pathway, migration 00042). Two taps to
  // confirm — the item stays in the open menu — then wipe, sign out, and
  // land on the public home page so the whole flow restarts from the front
  // door. The email-keyed grant survives, so the flag returns on re-signup.
  const resetTestAccount = async () => {
    if (!resetConfirm) {
      setResetConfirm(true);
      return;
    }
    setResetBusy(true);
    try {
      const res = await fetch("/api/testing/reset", { method: "POST" });
      if (!res.ok) {
        setResetBusy(false);
        setResetConfirm(false);
        return;
      }
      await createClient().auth.signOut();
      window.location.href = "/";
    } catch {
      setResetBusy(false);
      setResetConfirm(false);
    }
  };

  const openFeedback = () => {
    setOpen(false);
    // The feedback widget (mounted by the layout) listens for this event.
    window.dispatchEvent(new CustomEvent("olos:open-feedback"));
  };

  const radio = (checked: boolean, label: string, href: string) => (
    <Link
      className="menu-item"
      role="menuitemradio"
      aria-checked={checked}
      href={href}
      onClick={() => setOpen(false)}
    >
      <span
        className="dot"
        style={{
          width: 16,
          height: 16,
          border: `2px solid ${checked ? "var(--teal)" : "var(--meta-soft)"}`,
          background: checked
            ? "radial-gradient(circle at center, var(--teal) 0 4px, transparent 5px)"
            : "none",
          opacity: 1,
        }}
      />
      {label}
    </Link>
  );

  return (
    <span className="avatar-wrap" ref={wrapRef}>
      <button
        className="appbar-avatar"
        id="header-avatar"
        title="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={avatarUrl ? { padding: 0, overflow: "hidden" } : undefined}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="block h-full w-full rounded-full object-cover"
          />
        ) : (
          initials
        )}
      </button>
      {open && (
        <div id="avatar-menu" role="menu" aria-label="Account menu">
          <div
            className="t-small"
            style={{ padding: "4px 12px 8px", color: "var(--meta)" }}
          >
            {displayName}
          </div>
          <Link
            className="menu-item menu-profile-btn"
            role="menuitem"
            href="/profile"
            onClick={() => setOpen(false)}
          >
            Profile
          </Link>
          <Link
            className="menu-item"
            role="menuitem"
            href="/profile/edit"
            onClick={() => setOpen(false)}
          >
            Edit profile
          </Link>
          {canViewAs && (
            <>
              <div className="menu-rule" />
              <div className="lbl" style={{ padding: "8px 12px 4px" }}>
                View as
              </div>
              {radio(persona === null, "Upskiller", "/dashboard")}
              {(isModerator || showPods) &&
                radio(
                  persona === "poderator",
                  moderatorPersonaLabel,
                  "/moderator"
                )}
              {labLeadHref &&
                radio(persona === "lablead", "Lab lead", labLeadHref)}
              {isAdmin && radio(persona === "admin", "Admin", "/admin")}
            </>
          )}
          <div className="menu-rule" />
          <button className="menu-item" role="menuitem" onClick={openFeedback}>
            Send feedback
          </button>
          {isTest && (
            <button
              className="menu-item"
              role="menuitem"
              onClick={resetTestAccount}
              disabled={resetBusy}
              style={{ color: "var(--red)" }}
            >
              {resetBusy
                ? "Resetting…"
                : resetConfirm
                  ? "Tap again to wipe & restart"
                  : "Reset Test Account"}
            </button>
          )}
          <button className="menu-item" role="menuitem" onClick={signOut}>
            Sign out
          </button>
        </div>
      )}
    </span>
  );
}
