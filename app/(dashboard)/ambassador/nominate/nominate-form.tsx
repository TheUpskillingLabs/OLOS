"use client";

import { useState } from "react";
import { invite } from "@/lib/ambassador/content";

const copy = invite.nominate;

export default function NominateForm() {
  const [name, setName] = useState("");
  const [how, setHow] = useState("");
  const [why, setWhy] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError(copy.errors.name);
    if (!why.trim()) return setError(copy.errors.why);
    setBusy(true);
    setError(null);
    const res = await fetch("/api/ambassadors/nominations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nominee_name: name.trim(),
        how_known: how.trim() || undefined,
        reason: why.trim(),
        nominee_contact: contact.trim() || undefined,
      }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const json = res ? await res.json().catch(() => null) : null;
      return setError(json?.error ?? "Couldn't send that. Try again.");
    }
    setSent(name.trim());
    setName("");
    setHow("");
    setWhy("");
    setContact("");
  };

  return (
    <form className="amb-stack" style={{ marginTop: 22 }} onSubmit={onSubmit} noValidate>
      {sent && <p className="amb-ok" role="status">Sent. Your coordinator will take it from here.</p>}
      <div className="field">
        <label htmlFor="nm-name">{copy.name}</label>
        <input id="nm-name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="nm-how">{copy.how}</label>
        <input id="nm-how" maxLength={300} value={how} onChange={(e) => setHow(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="nm-why">{copy.why}</label>
        <textarea id="nm-why" maxLength={1000} value={why} onChange={(e) => setWhy(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="nm-contact">{copy.contact}</label>
        <input id="nm-contact" maxLength={320} value={contact} onChange={(e) => setContact(e.target.value)} aria-describedby="nm-contact-hint" />
        <p className="t-small" id="nm-contact-hint">{copy.contactHint}</p>
      </div>
      {error && <p className="amb-error" role="alert">{error}</p>}
      <button type="submit" className="btn btn-teal" disabled={busy}>{copy.send} →</button>
    </form>
  );
}
