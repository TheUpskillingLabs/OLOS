"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
  displayName: string;
  isAdmin: boolean;
  isModerator: boolean;
  showPods: boolean;
  hasEnrollment: boolean;
  /** The weekly Learning Log gate is armed and unmet — Home carries the
      red pip (the ritual lives on the dashboard, not in the nav). */
  logDue: boolean;
}

export default function AppNav({
  initials,
  displayName,
  isAdmin,
  isModerator,
  showPods,
  hasEnrollment,
  logDue,
}: AppNavProps) {
  const pathname = usePathname() || "";
  const persona = pathname.startsWith("/admin")
    ? "admin"
    : pathname.startsWith("/moderator")
      ? "poderator"
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
              {persona === "admin" ? "Admin" : "Poderator"}
            </span>
            <Link className="nav-link exit-member" href="/dashboard">
              Exit to member view
            </Link>
          </>
        ) : (
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
          </nav>
        )}
        <AvatarMenu
          initials={initials}
          displayName={displayName}
          isAdmin={isAdmin}
          isModerator={isModerator}
          showPods={showPods}
          persona={persona}
        />
      </div>
    </header>
  );
}

function isActive(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

function AvatarMenu({
  initials,
  displayName,
  isAdmin,
  isModerator,
  showPods,
  persona,
}: {
  initials: string;
  displayName: string;
  isAdmin: boolean;
  isModerator: boolean;
  showPods: boolean;
  persona: "admin" | "poderator" | null;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const canViewAs = isAdmin || isModerator || showPods;

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
      >
        {initials}
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
          {canViewAs && (
            <>
              <div className="menu-rule" />
              <div className="lbl" style={{ padding: "8px 12px 4px" }}>
                View as
              </div>
              {radio(persona === null, "Upskiller", "/dashboard")}
              {(isModerator || showPods) &&
                radio(persona === "poderator", "Poderator", "/moderator")}
              {isAdmin && radio(persona === "admin", "Admin", "/admin")}
            </>
          )}
          <div className="menu-rule" />
          <button className="menu-item" role="menuitem" onClick={openFeedback}>
            Send feedback
          </button>
          <button className="menu-item" role="menuitem" onClick={signOut}>
            Sign out
          </button>
        </div>
      )}
    </span>
  );
}
