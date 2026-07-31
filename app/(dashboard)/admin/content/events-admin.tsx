"use client";

import { useState } from "react";
import { fmtDate } from "@/lib/content/format";

/* The /admin/content Events surface — dress a Luma import so its detail page
   has something to say. The sync owns the facts (name, times, venue, cover);
   this edits only the editorial layer the sync never touches:

     description — the lede under the title (and the teaser line)
     body        — the numbered "What we'll cover" columns, one per paragraph
     bring       — the "Bring" row

   Upcoming events only: past pages are history, and the point of dressing an
   event is the moment before people decide to come. Mirrors LibraryAdmin /
   StoriesAdmin: parent holds the list, each row owns its edit state and
   reconciles from the API response. Body is edited as one textarea split on
   blank lines (the StoriesAdmin story[] convention). */

export interface AdminEvent {
  id: number;
  slug: string;
  name: string;
  kind: string;
  anchor: boolean;
  start_at: string;
  status: string;
  description: string | null;
  bring: string | null;
  body: string[] | null;
  synced_at: string | null;
}

const inputCls =
  "w-full rounded-card border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal";

export default function EventsAdmin({ initial }: { initial: AdminEvent[] }) {
  const [rows, setRows] = useState<AdminEvent[]>(initial);

  function upsertRow(row: AdminEvent) {
    setRows((prev) => {
      const i = prev.findIndex((r) => r.id === row.id);
      if (i === -1) return prev;
      const next = [...prev];
      next[i] = row;
      return next;
    });
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-meta">
        No upcoming events in the cache — run the sync below.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <EventRow key={r.id} row={r} onSaved={upsertRow} />
      ))}
    </div>
  );
}

function EventRow({
  row,
  onSaved,
}: {
  row: AdminEvent;
  onSaved: (r: AdminEvent) => void;
}) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState(row.description ?? "");
  const [bodyText, setBodyText] = useState(row.body?.join("\n\n") ?? "");
  const [bring, setBring] = useState(row.bring ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const undressed = !row.description && !(row.body && row.body.length > 0);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const body = bodyText
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean);
      const res = await fetch(`/api/admin/events/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim() || null,
          body: body.length ? body : null,
          bring: bring.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Save failed");
      }
      onSaved((await res.json()) as AdminEvent);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-card border border-ink/10 bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-sm font-semibold text-ink">{row.name}</span>
        <span className="text-xs text-meta tabular-nums">
          {fmtDate(row.start_at)}
        </span>
        {row.anchor && <span className="lbl lbl-teal">Anchor</span>}
        {undressed && (
          <span className="text-xs font-medium" style={{ color: "var(--red)" }}>
            No description — the page is bare
          </span>
        )}
        <button
          type="button"
          className="ml-auto text-sm font-semibold text-teal-deep hover:underline"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Close" : "Edit"}
        </button>
      </div>

      {open && (
        <div className="mt-4 grid gap-3">
          <label className="block">
            <span className="lbl mb-1 block">
              Description — the lede under the title
            </span>
            <textarea
              className={inputCls}
              rows={2}
              maxLength={600}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="One or two sentences on what this session is and who it's for."
            />
          </label>
          <label className="block">
            <span className="lbl mb-1 block">
              What we&apos;ll cover — one item per blank-line-separated
              paragraph (renders as the numbered columns)
            </span>
            <textarea
              className={inputCls}
              rows={6}
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder={
                "Pick the chart that makes the point\n\nOrder findings as a narrative\n\nBuild the one-slide summary"
              }
            />
          </label>
          <label className="block">
            <span className="lbl mb-1 block">Bring (optional)</span>
            <input
              className={inputCls}
              maxLength={255}
              value={bring}
              onChange={(e) => setBring(e.target.value)}
              placeholder="A laptop and an open mind."
            />
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="btn btn-teal px-4 py-2 text-sm"
              onClick={save}
              disabled={busy}
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <a
              className="text-sm font-semibold text-teal-deep hover:underline"
              href={`/events/${row.slug}`}
              target="_blank"
              rel="noopener"
            >
              View page →
            </a>
          </div>
          {error && (
            <p className="text-sm" style={{ color: "var(--red)" }} role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
