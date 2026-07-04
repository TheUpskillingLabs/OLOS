"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/* The login popup shell — hosts the intercepted /login card over whatever
   page launched it (app/@authmodal). Same .gate-modal vocabulary as the
   event RSVP modal: ink scrim, bottom sheet on mobile, centered at 1024px.
   Closing goes router.back() so the URL returns to the launching page;
   browser back closes it the same way. */

export default function AuthModal({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sheetRef.current?.focus();
    // The page behind stays put while the popup is up.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.back();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [router]);

  return (
    <div
      className="gate-modal open"
      onClick={(e) => {
        if (e.target === e.currentTarget) router.back();
      }}
    >
      <div
        ref={sheetRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Sign in to The Upskilling Labs"
        className="gate-sheet"
        style={{ outline: "none" }}
      >
        <button
          className="gate-close"
          onClick={() => router.back()}
          aria-label="Close"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 22 22"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M5 5L17 17M17 5L5 17"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
        {children}
      </div>
    </div>
  );
}
