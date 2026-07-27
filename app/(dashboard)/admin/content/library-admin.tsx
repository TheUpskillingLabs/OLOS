"use client";

import { useState } from "react";
import { formatDate } from "@/lib/format/date";
import { RESOURCE_CONTENT_TYPES } from "@/lib/validations/resource-admin";

/* The /admin/content Library surface — add a resource (a link-out to a
   view-only Google Doc, a recording, a course, …) and manage the catalog.
   Each row is metadata + an external `url`; the public /library grid links
   straight out to that url. Add-form on top, then the list grouped by status.
   Mirrors StoriesAdmin: the parent holds the list, each row owns its edit
   state and reconciles from the API response. */

export interface AdminResource {
  id: number;
  slug: string;
  title: string;
  content_type: (typeof RESOURCE_CONTENT_TYPES)[number];
  url: string | null;
  summary: string | null;
  meta: string | null;
  author: string | null;
  status: "published" | "draft";
  created_at: string;
}

const TYPES: [AdminResource["content_type"], string][] = [
  ["guide", "Guide"],
  ["recording", "Recording"],
  ["template", "Template"],
  ["course", "Course"],
  ["playbook", "Playbook"],
];

const inputCls =
  "w-full rounded-card border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal";

export default function LibraryAdmin({ initial }: { initial: AdminResource[] }) {
  const [rows, setRows] = useState<AdminResource[]>(initial);

  function upsertRow(row: AdminResource) {
    setRows((prev) => {
      const i = prev.findIndex((r) => r.id === row.id);
      if (i === -1) return [row, ...prev];
      const next = [...prev];
      next[i] = row;
      return next;
    });
  }

  async function patch(id: number, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/resources/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || "Save failed");
    }
    upsertRow((await res.json()) as AdminResource);
  }

  async function remove(id: number) {
    const res = await fetch(`/api/admin/resources/${id}`, { method: "DELETE" });
    if (res.ok) setRows((prev) => prev.filter((r) => r.id !== id));
  }

  const groups: [string, AdminResource["status"]][] = [
    ["Published", "published"],
    ["Drafts", "draft"],
  ];

  return (
    <div className="space-y-10">
      <AddResourceForm onCreated={upsertRow} />

      {groups.map(([label, status]) => {
        const g = rows.filter((r) => r.status === status);
        return (
          <section key={status}>
            <h3 className="lbl mb-3">
              {label} · {g.length}
            </h3>
            {g.length ? (
              <div className="space-y-4">
                {g.map((r) => (
                  <ResourceRow key={r.id} row={r} onPatch={patch} onRemove={remove} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-meta">None yet.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

function AddResourceForm({
  onCreated,
}: {
  onCreated: (row: AdminResource) => void;
}) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [contentType, setContentType] =
    useState<AdminResource["content_type"]>("guide");
  const [summary, setSummary] = useState("");
  const [meta, setMeta] = useState("");
  const [author, setAuthor] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(status: "published" | "draft") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          url: url.trim(),
          content_type: contentType,
          summary: summary.trim() || null,
          meta: meta.trim() || null,
          author: author.trim() || null,
          status,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Could not add resource");
      }
      onCreated((await res.json()) as AdminResource);
      setTitle("");
      setUrl("");
      setContentType("guide");
      setSummary("");
      setMeta("");
      setAuthor("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = title.trim().length > 0 && url.trim().length > 0 && !busy;

  return (
    <div className="rounded-card border border-ink/10 bg-white p-5 shadow-card">
      <h3 className="mb-1 t-h4 text-ink">Add a resource</h3>
      <p className="mb-4 text-sm text-meta">
        Paste a link (a view-only Google Doc works well) and a title. It appears
        on the public Library the moment it&apos;s published.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="lbl mb-1 block">Title</span>
          <input
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Prompting basics for benefits casework"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="lbl mb-1 block">Link (URL)</span>
          <input
            className={inputCls}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://docs.google.com/document/d/…"
          />
        </label>
        <label className="block">
          <span className="lbl mb-1 block">Type</span>
          <select
            className={inputCls}
            value={contentType}
            onChange={(e) =>
              setContentType(e.target.value as AdminResource["content_type"])
            }
          >
            {TYPES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="lbl mb-1 block">Label (optional)</span>
          <input
            className={inputCls}
            value={meta}
            onChange={(e) => setMeta(e.target.value)}
            placeholder="10 min read"
          />
        </label>
        <label className="block">
          <span className="lbl mb-1 block">Author (optional)</span>
          <input
            className={inputCls}
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="The Upskilling Labs"
          />
        </label>
      </div>

      <label className="mt-3 block">
        <span className="lbl mb-1 block">Summary (optional)</span>
        <textarea
          className={inputCls}
          rows={2}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="One line describing what this is."
        />
      </label>

      {error && (
        <p className="mt-2 text-sm" style={{ color: "var(--red)" }} role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          className="btn btn-teal px-4 py-2 text-sm"
          type="button"
          disabled={!canSubmit}
          onClick={() => submit("published")}
        >
          {busy ? "…" : "Add & publish"}
        </button>
        <button
          className="btn btn-ghost px-4 py-2 text-sm"
          type="button"
          disabled={!canSubmit}
          onClick={() => submit("draft")}
        >
          Save as draft
        </button>
      </div>
    </div>
  );
}

function ResourceRow({
  row,
  onPatch,
  onRemove,
}: {
  row: AdminResource;
  onPatch: (id: number, body: Record<string, unknown>) => Promise<void>;
  onRemove: (id: number) => Promise<void>;
}) {
  const [title, setTitle] = useState(row.title);
  const [url, setUrl] = useState(row.url ?? "");
  const [contentType, setContentType] = useState(row.content_type);
  const [summary, setSummary] = useState(row.summary ?? "");
  const [meta, setMeta] = useState(row.meta ?? "");
  const [author, setAuthor] = useState(row.author ?? "");
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function editedFields() {
    return {
      title: title.trim(),
      url: url.trim(),
      content_type: contentType,
      summary: summary.trim() || null,
      meta: meta.trim() || null,
      author: author.trim() || null,
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
          #{row.id} · added {formatDate(row.created_at)} · /library/{row.slug}
        </span>
        {row.url && (
          <a
            className="text-xs text-teal underline"
            href={row.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open link ↗
          </a>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="lbl mb-1 block">Title</span>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="block sm:col-span-2">
          <span className="lbl mb-1 block">Link (URL)</span>
          <input className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)} />
        </label>
        <label className="block">
          <span className="lbl mb-1 block">Type</span>
          <select
            className={inputCls}
            value={contentType}
            onChange={(e) =>
              setContentType(e.target.value as AdminResource["content_type"])
            }
          >
            {TYPES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="lbl mb-1 block">Label</span>
          <input className={inputCls} value={meta} onChange={(e) => setMeta(e.target.value)} />
        </label>
        <label className="block sm:col-span-2">
          <span className="lbl mb-1 block">Author</span>
          <input className={inputCls} value={author} onChange={(e) => setAuthor(e.target.value)} />
        </label>
      </div>

      <label className="mt-3 block">
        <span className="lbl mb-1 block">Summary</span>
        <textarea
          className={inputCls}
          rows={2}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
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
        {row.status === "draft" ? (
          <button
            className="btn btn-teal px-4 py-2 text-sm"
            type="button"
            disabled={busy}
            onClick={() => act({ ...editedFields(), status: "published" })}
          >
            {busy ? "…" : "Publish"}
          </button>
        ) : (
          <button
            className="btn btn-ghost px-4 py-2 text-sm"
            type="button"
            disabled={busy}
            onClick={() => act({ status: "draft" })}
          >
            Unpublish
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
