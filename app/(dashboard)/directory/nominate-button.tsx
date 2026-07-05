"use client";

import { useState } from "react";
import { Sheet, Button, Field, Textarea, Select } from "@/app/components/ui";

/**
 * "Nominate" — members surface talent; staff concierge, never gate (prototype:
 * FLOWS('nominate') → nominations pipeline). One reason field + a type, decoupled
 * from the pulse bundle → standalone POST /api/nominations.
 *
 * `variant="ghost"` is the directory-card affordance; `stopPropagation` keeps a
 * tap on it from following the card's link to /u/[handle].
 */

const TYPES: { value: string; label: string }[] = [
  { value: "mentor", label: "as a mentor" },
  { value: "advisor", label: "as an advisor" },
  { value: "upskiller", label: "as an upskiller" },
];

export default function NominateButton({
  nomineeName,
  className,
  variant = "ghost",
}: {
  nomineeName: string;
  className?: string;
  variant?: "ghost" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("mentor");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!reason.trim()) {
      setError("Tell us why in a sentence or two.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/nominations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nominee_name: nomineeName,
          nomination_type: type,
          reason: reason.trim(),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setError(j?.error || "Something went wrong. Try again.");
        setBusy(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setOpen(false);
    // Reset after the drawer animates out so the copy doesn't flash.
    setTimeout(() => {
      setReason("");
      setType("mentor");
      setError(null);
      setDone(false);
    }, 200);
  };

  return (
    <>
      <Button
        variant={variant}
        size="sm"
        className={className}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen(true);
        }}
      >
        Nominate
      </Button>

      <Sheet
        open={open}
        onClose={close}
        title={done ? "Thank you" : `Nominate ${nomineeName}`}
        description={
          done
            ? undefined
            : "The team reviews every nomination. Nothing is shared publicly."
        }
        footer={
          done ? (
            <Button variant="primary" className="w-full" onClick={close}>
              Done
            </Button>
          ) : (
            <div className="flex gap-3">
              <Button variant="secondary" onClick={close} disabled={busy}>
                Cancel
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={submit}
                disabled={busy}
              >
                {busy ? "Sending…" : "Send nomination"}
              </Button>
            </div>
          )
        }
      >
        <div className="px-6 py-5">
          {done ? (
            <p className="text-sm leading-relaxed text-charcoal">
              We&apos;ve got your nomination for{" "}
              <span className="font-semibold text-ink">{nomineeName}</span>. The
              team will take it from here.
            </p>
          ) : (
            <div className="space-y-5">
              <Field label="You're nominating them" htmlFor="nominate-type">
                <Select
                  id="nominate-type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Why them?"
                htmlFor="nominate-reason"
                required
                error={error}
                charCount={`${reason.length}/2000`}
              >
                <Textarea
                  id="nominate-reason"
                  rows={5}
                  maxLength={2000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="What have you seen them do that others should know about?"
                  invalid={!!error}
                />
              </Field>
            </div>
          )}
        </div>
      </Sheet>
    </>
  );
}
