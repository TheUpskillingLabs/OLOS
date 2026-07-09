"use client";

import { useState } from "react";
import type { PageType, PageAdminEntry } from "@/lib/pages/authz";

/**
 * Manage a page's explicit admins — the "others can be added" list beyond the
 * page's auto-admins (its leads; a project's members). Shown only to admins.
 * Add by @handle; remove an added admin. Auto-admins aren't listed here (they
 * come from roles), so only explicit rows appear and are removable.
 */
export default function PageAdminsManager({
  pageType,
  pageId,
  initialAdmins,
}: {
  pageType: PageType;
  pageId: number;
  initialAdmins: PageAdminEntry[];
}) {
  const [admins, setAdmins] = useState<PageAdminEntry[]>(initialAdmins);
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    const h = handle.trim().replace(/^@/, "");
    if (!h || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/pages/${pageType}/${pageId}/admins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: h }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Couldn't add that member.");
      }
      const entry: PageAdminEntry = await res.json();
      setAdmins((a) =>
        a.some((x) => x.participantId === entry.participantId) ? a : [...a, entry]
      );
      setHandle("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(participantId: number) {
    const prev = admins;
    setAdmins((a) => a.filter((x) => x.participantId !== participantId));
    try {
      const res = await fetch(
        `/api/pages/${pageType}/${pageId}/admins/${participantId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error();
    } catch {
      setAdmins(prev);
    }
  }

  return (
    <details className="rounded-card border border-ink/10 bg-white p-4 shadow-card">
      <summary className="lbl cursor-pointer hover:text-charcoal">
        Page admins
      </summary>
      <p className="mt-2 text-xs text-meta">
        Admins can post as this page. Leads are admins automatically; add others
        by @handle.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {admins.length === 0 ? (
          <p className="text-sm text-meta">No added admins yet.</p>
        ) : (
          admins.map((a) => (
            <div
              key={a.participantId}
              className="flex items-center justify-between gap-3"
            >
              <span className="min-w-0 truncate text-sm text-ink">
                {a.name}
                {a.handle ? (
                  <span className="text-meta"> · @{a.handle}</span>
                ) : null}
              </span>
              <button
                type="button"
                onClick={() => remove(a.participantId)}
                className="shrink-0 text-xs text-meta transition-colors duration-150 hover:text-red"
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="@handle"
          className="min-w-0 flex-1 rounded-card border border-ink/15 bg-white px-3 py-1.5 text-sm text-ink placeholder:text-meta-soft focus:border-teal focus:outline-none focus:ring-[3px] focus:ring-teal/15"
        />
        <button
          type="button"
          onClick={add}
          disabled={busy || !handle.trim()}
          className="btn btn-teal px-3 py-1.5 text-xs"
        >
          {busy ? "Adding…" : "Add"}
        </button>
      </div>
      {error && (
        <p className="mt-1 text-xs text-red" role="alert">
          {error}
        </p>
      )}
    </details>
  );
}
