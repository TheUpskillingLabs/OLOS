"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/* The email-only public RSVP — the generator's RSVP_MODAL + openRsvp()/
   submitRsvp()/closeRsvp(), ported verbatim. Since Luma became the source
   of truth this modal serves editorial (non-Luma) events only: anonymous
   visitors on Luma-managed events register on Luma's page instead (photo
   release and all), and members use MemberRegister below. Still public,
   never account-gated. Submit POSTs to /api/events/[event_id]/rsvp; a
   rejected email gets the red-border treatment. */

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/* One-tap registration for signed-in members: no email typing — the route
   reads their identity from the session and forwards name + email to
   Luma's guest list (registration parity, owner decision: the Participant
   Agreement they signed covers what Luma's questions would have asked).
   router.refresh() re-renders the page so the sibling CTA flips too. */
export function MemberRegister({
  eventId,
  going: initialGoing,
  className,
}: {
  eventId: number;
  going: boolean;
  className: string;
}) {
  const router = useRouter();
  const [going, setGoing] = useState(initialGoing);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function register() {
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/events/${eventId}/rsvp`, {
        method: "POST",
      });
      if (!res.ok) {
        setFailed(true);
        return;
      }
      setGoing(true);
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  if (going) {
    return (
      <button className={className} disabled style={{ opacity: 1 }}>
        {"You're going ✓"}
      </button>
    );
  }
  return (
    <>
      <button className={className} onClick={register} disabled={busy}>
        {busy ? "Saving…" : "Register — save a spot"}
      </button>
      {failed && (
        <p className="t-small" role="alert" style={{ marginTop: 8, color: "var(--red)" }}>
          {"That didn't go through — try again."}
        </p>
      )}
    </>
  );
}

export default function RsvpButton({
  eventId,
  name,
  dateLabel,
  label,
  className,
}: {
  eventId: number;
  name: string;
  dateLabel: string;
  label: string;
  className: string;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Escape closes (the generator's document keydown listener).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // openRsvp() focuses the email input.
  useEffect(() => {
    if (open && !done) inputRef.current?.focus();
  }, [open, done]);

  function openModal() {
    setDone(false);
    setOpen(true);
  }

  async function submit() {
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setInvalid(true);
      inputRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/events/${eventId}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      if (!res.ok) {
        setInvalid(true);
        inputRef.current?.focus();
        return;
      }
      setDone(true);
    } catch {
      setInvalid(true);
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className={className} onClick={openModal}>
        {label}
      </button>
      <div
        className={`gate-modal${open ? " open" : ""}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
      >
        <div className="gate-sheet">
          <button
            className="gate-close"
            onClick={() => setOpen(false)}
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
          {!done ? (
            <div>
              <h3 className="t-h3" style={{ marginBottom: 6 }}>
                Save a spot
              </h3>
              <p className="t-body" style={{ marginBottom: 16 }}>
                Saving your spot for {name} — {dateLabel}.
              </p>
              <input
                ref={inputRef}
                type="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setInvalid(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
                style={{
                  width: "100%",
                  border: `1px solid ${invalid ? "var(--red)" : "var(--rule)"}`,
                  borderRadius: "var(--r)",
                  padding: 14,
                  font: "inherit",
                  fontSize: 16,
                  background: "var(--white)",
                  marginBottom: 12,
                }}
              />
              <button
                className="btn btn-teal btn-block"
                onClick={submit}
                disabled={busy}
              >
                Save my spot
              </button>
              <p
                className="t-small"
                style={{ marginTop: 12, color: "var(--meta)" }}
              >
                {"Free and first come, first served — no account needed. We'll send the details."}
              </p>
            </div>
          ) : (
            <div style={{ padding: "12px 0" }}>
              <h3 className="t-h3" style={{ marginBottom: 8 }}>
                Spot saved ✓
              </h3>
              <p className="t-body" style={{ marginBottom: 16 }}>
                Details are on their way to your inbox. See you there.
              </p>
              <button
                className="btn btn-ghost-teal btn-sm"
                onClick={() => setOpen(false)}
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
