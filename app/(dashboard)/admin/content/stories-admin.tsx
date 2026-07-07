"use client";

import { useState } from "react";

/* The /admin/stories review client — group by status, edit editorial fields,
   publish/hide/delete. Each row owns its edit state; the parent holds the list
   and reconciles after each API call. */

export interface AdminSpotlight {
  id: number;
  slug: string | null;
  name: string;
  role: string | null;
  tag: "builder" | "mentor" | "career_changer" | "other";
  tag_label: string | null;
  quote: string | null;
  story: string[];
  grad: string;
  submitter_email: string | null;
  status: "submitted" | "published" | "hidden";
  sort_order: number;
  created_at: string;
}

const TAGS: [AdminSpotlight["tag"], string][] = [
  ["builder", "Builder"],
  ["mentor", "Mentor"],
  ["career_changer", "Career changer"],
  ["other", "Story"],
];
const GRADS = ["m-teal", "m-forest", "m-navy"];

const inputCls =
  "w-full rounded-card border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal";

export default function StoriesAdmin({ initial }: { initial: AdminSpotlight[] }) {
  const [rows, setRows] = useState<AdminSpotlight[]>(initial);

  async function patch(id: number, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/stories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || "Save failed");
    }
    const data = (await res.json()) as { id: number; status: string; slug: string | null };
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? ({ ...r, ...body, status: data.status, slug: data.slug } as AdminSpotlight)
          : r
      )
    );
  }

  async function remove(id: number) {
    const res = await fetch(`/api/admin/stories/${id}`, { method: "DELETE" });
    if (res.ok) setRows((prev) => prev.filter((r) => r.id !== id));
  }

  const groups: [string, AdminSpotlight["status"]][] = [
    ["New submissions", "submitted"],
    ["Published", "published"],
    ["Hidden", "hidden"],
  ];

  return (
    <div className="space-y-10">
      {groups.map(([label, status]) => {
        const g = rows.filter((r) => r.status === status);
        return (
          <section key={status}>
            <h2 className="lbl mb-3">
              {label} · {g.length}
            </h2>
            {g.length ? (
              <div className="space-y-4">
                {g.map((r) => (
                  <SpotlightRow key={r.id} row={r} onPatch={patch} onRemove={remove} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-meta">None.</p>
            )}
          </section>
        );
      })}
      {rows.length === 0 && (
        <p className="text-sm text-meta">
          No stories yet. Submissions from /stories will appear here.
        </p>
      )}
    </div>
  );
}

function SpotlightRow({
  row,
  onPatch,
  onRemove,
}: {
  row: AdminSpotlight;
  onPatch: (id: number, body: Record<string, unknown>) => Promise<void>;
  onRemove: (id: number) => Promise<void>;
}) {
  const [name, setName] = useState(row.name);
  const [roleField, setRoleField] = useState(row.role ?? "");
  const [tag, setTag] = useState(row.tag);
  const [quote, setQuote] = useState(row.quote ?? "");
  const [storyText, setStoryText] = useState(row.story.join("\n\n"));
  const [grad, setGrad] = useState(row.grad);
  const [sortOrder, setSortOrder] = useState(String(row.sort_order));
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function editedFields() {
    return {
      name: name.trim(),
      role: roleField.trim() || null,
      tag,
      quote: quote.trim() || null,
      story: storyText
        .split(/\n\n+/)
        .map((s) => s.trim())
        .filter(Boolean),
      grad,
      sort_order: Number(sortOrder) || 0,
    };
  }

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      await onPatch(row.id, body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-card border border-ink/10 bg-white p-5 shadow-card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-meta tabular-nums">
          #{row.id} · submitted {new Date(row.created_at).toLocaleDateString()}
          {row.submitter_email ? ` · ${row.submitter_email}` : ""}
          {row.slug ? ` · /stories#s-${row.slug}` : ""}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="lbl mb-1 block">Name</span>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <span className="lbl mb-1 block">Role / line</span>
          <input
            className={inputCls}
            value={roleField}
            onChange={(e) => setRoleField(e.target.value)}
            placeholder="Civic & Elections Cycle"
          />
        </label>
        <label className="block">
          <span className="lbl mb-1 block">Tag</span>
          <select className={inputCls} value={tag} onChange={(e) => setTag(e.target.value as AdminSpotlight["tag"])}>
            {TAGS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="lbl mb-1 block">Cover</span>
            <select className={inputCls} value={grad} onChange={(e) => setGrad(e.target.value)}>
              {GRADS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="lbl mb-1 block">Sort</span>
            <input
              className={inputCls}
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </label>
        </div>
      </div>

      <label className="mt-3 block">
        <span className="lbl mb-1 block">Pull-quote</span>
        <textarea
          className={inputCls}
          rows={2}
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          placeholder="The one line that leads the card."
        />
      </label>

      <label className="mt-3 block">
        <span className="lbl mb-1 block">Full story (blank line between paragraphs)</span>
        <textarea
          className={inputCls}
          rows={5}
          value={storyText}
          onChange={(e) => setStoryText(e.target.value)}
        />
      </label>

      {error && (
        <p className="mt-2 text-sm" style={{ color: "var(--red)" }} role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          className="btn btn-ghost px-4 py-2 text-sm"
          type="button"
          disabled={busy}
          onClick={() => act(editedFields())}
        >
          Save
        </button>
        {row.status !== "published" && (
          <button
            className="btn btn-teal px-4 py-2 text-sm"
            type="button"
            disabled={busy}
            onClick={() => act({ ...editedFields(), status: "published" })}
          >
            {busy ? "…" : "Publish"}
          </button>
        )}
        {row.status === "published" && (
          <button
            className="btn btn-ghost px-4 py-2 text-sm"
            type="button"
            disabled={busy}
            onClick={() => act({ status: "hidden" })}
          >
            Unpublish
          </button>
        )}
        {row.status === "submitted" && (
          <button
            className="btn btn-ghost px-4 py-2 text-sm"
            type="button"
            disabled={busy}
            onClick={() => act({ status: "hidden" })}
          >
            Dismiss
          </button>
        )}
        <button
          className="btn btn-ghost px-4 py-2 text-sm"
          type="button"
          disabled={busy}
          style={{ color: "var(--red)", marginLeft: "auto" }}
          onClick={() => (confirmDel ? onRemove(row.id) : setConfirmDel(true))}
        >
          {confirmDel ? "Tap again to delete" : "Delete"}
        </button>
      </div>
    </div>
  );
}
