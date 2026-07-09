"use client";

import { useState } from "react";
import { formatDate } from "@/lib/format/date";

/* The /admin/announcements client — a compose form on top, then the existing
   posts grouped by status (Published / Drafts / Archived). Each row owns its
   edit state; the parent holds the list and reconciles after each API call.
   Mirrors stories-admin.tsx, plus a create path (spotlights are user-submitted;
   announcements are authored here). */

export interface AdminAnnouncement {
  id: number;
  title: string;
  body: string;
  lab_id: number | null;
  status: "draft" | "published" | "archived";
  pinned: boolean;
  published_at: string | null;
  created_at: string;
}

export interface LabOption {
  id: number;
  label: string;
}

const inputCls =
  "w-full rounded-card border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal";

export default function AnnouncementsAdmin({
  initial,
  labs,
  fixedLab,
}: {
  initial: AdminAnnouncement[];
  labs: LabOption[];
  /** Lab-scoped mode (the /lab/[slug] composer): audience is locked to this
      lab, so the audience picker is hidden and every post is scoped to it. */
  fixedLab?: { id: number; label: string };
}) {
  const [rows, setRows] = useState<AdminAnnouncement[]>(initial);

  function labLabel(labId: number | null) {
    if (fixedLab) return fixedLab.label;
    if (labId == null) return "Org-wide";
    return labs.find((l) => l.id === labId)?.label ?? `Lab #${labId}`;
  }

  async function create(body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/announcements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || "Create failed");
    }
    const data = (await res.json()) as { id: number; status: string };
    const now = new Date().toISOString();
    const row: AdminAnnouncement = {
      id: data.id,
      title: String(body.title ?? ""),
      body: String(body.body ?? ""),
      lab_id: (body.lab_id as number | null) ?? null,
      status: data.status as AdminAnnouncement["status"],
      pinned: Boolean(body.pinned),
      published_at: data.status === "published" ? now : null,
      created_at: now,
    };
    setRows((prev) => [row, ...prev]);
  }

  async function patch(id: number, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/announcements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || "Save failed");
    }
    const data = (await res.json()) as { id: number; status: string };
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? ({
              ...r,
              ...body,
              status: data.status as AdminAnnouncement["status"],
              published_at:
                data.status === "published" && !r.published_at
                  ? new Date().toISOString()
                  : r.published_at,
            } as AdminAnnouncement)
          : r
      )
    );
  }

  async function remove(id: number) {
    const res = await fetch(`/api/admin/announcements/${id}`, {
      method: "DELETE",
    });
    if (res.ok) setRows((prev) => prev.filter((r) => r.id !== id));
  }

  const groups: [string, AdminAnnouncement["status"]][] = [
    ["Published", "published"],
    ["Drafts", "draft"],
    ["Archived", "archived"],
  ];

  return (
    <div className="space-y-10">
      <ComposeForm labs={labs} fixedLab={fixedLab} onCreate={create} />

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
                  <AnnouncementRow
                    key={r.id}
                    row={r}
                    labs={labs}
                    fixedLab={fixedLab}
                    labLabel={labLabel}
                    onPatch={patch}
                    onRemove={remove}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-meta">None.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

function LabSelect({
  labs,
  value,
  onChange,
}: {
  labs: LabOption[];
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <select
      className={inputCls}
      value={value == null ? "" : String(value)}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
    >
      <option value="">Org-wide (everyone)</option>
      {labs.map((l) => (
        <option key={l.id} value={l.id}>
          {l.label}
        </option>
      ))}
    </select>
  );
}

function ComposeForm({
  labs,
  fixedLab,
  onCreate,
}: {
  labs: LabOption[];
  fixedLab?: { id: number; label: string };
  onCreate: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [labId, setLabId] = useState<number | null>(fixedLab?.id ?? null);
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(status: "draft" | "published") {
    if (!title.trim() || !body.trim()) {
      setError("Title and body are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onCreate({
        title: title.trim(),
        body: body.trim(),
        lab_id: fixedLab ? fixedLab.id : labId,
        pinned,
        status,
      });
      setTitle("");
      setBody("");
      setLabId(fixedLab?.id ?? null);
      setPinned(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-card border border-ink/10 bg-white p-5 shadow-card">
      <h2 className="mb-4 t-h3 text-ink">New announcement</h2>
      <div className="space-y-3">
        <label className="block">
          <span className="lbl mb-1 block">Title</span>
          <input
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What's the news?"
            maxLength={200}
          />
        </label>
        <label className="block">
          <span className="lbl mb-1 block">Body</span>
          <textarea
            className={inputCls}
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="The announcement, in a few sentences."
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="lbl mb-1 block">Audience</span>
            {fixedLab ? (
              <p className="px-1 py-2 text-sm text-meta">{fixedLab.label}</p>
            ) : (
              <LabSelect labs={labs} value={labId} onChange={setLabId} />
            )}
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
            />
            Pin to top
          </label>
        </div>
      </div>

      {error && (
        <p className="mt-2 text-sm" style={{ color: "var(--red)" }} role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          className="btn btn-teal px-4 py-2 text-sm"
          type="button"
          disabled={busy}
          onClick={() => submit("published")}
        >
          {busy ? "…" : "Publish"}
        </button>
        <button
          className="btn btn-ghost px-4 py-2 text-sm"
          type="button"
          disabled={busy}
          onClick={() => submit("draft")}
        >
          Save draft
        </button>
      </div>
    </section>
  );
}

function AnnouncementRow({
  row,
  labs,
  fixedLab,
  labLabel,
  onPatch,
  onRemove,
}: {
  row: AdminAnnouncement;
  labs: LabOption[];
  fixedLab?: { id: number; label: string };
  labLabel: (labId: number | null) => string;
  onPatch: (id: number, body: Record<string, unknown>) => Promise<void>;
  onRemove: (id: number) => Promise<void>;
}) {
  const [title, setTitle] = useState(row.title);
  const [body, setBody] = useState(row.body);
  const [labId, setLabId] = useState<number | null>(row.lab_id);
  const [pinned, setPinned] = useState(row.pinned);
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function editedFields() {
    return {
      title: title.trim(),
      body: body.trim(),
      lab_id: labId,
      pinned,
    };
  }

  async function act(patchBody: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      await onPatch(row.id, patchBody);
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
          #{row.id} · {labLabel(row.lab_id)}
          {row.pinned ? " · pinned" : ""}
          {row.published_at
            ? ` · published ${formatDate(row.published_at)}`
            : ` · created ${formatDate(row.created_at)}`}
        </span>
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="lbl mb-1 block">Title</span>
          <input
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
          />
        </label>
        <label className="block">
          <span className="lbl mb-1 block">Body</span>
          <textarea
            className={inputCls}
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="lbl mb-1 block">Audience</span>
            {fixedLab ? (
              <p className="px-1 py-2 text-sm text-meta">{fixedLab.label}</p>
            ) : (
              <LabSelect labs={labs} value={labId} onChange={setLabId} />
            )}
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
            />
            Pin to top
          </label>
        </div>
      </div>

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
            onClick={() => act({ status: "archived" })}
          >
            Unpublish
          </button>
        )}
        {row.status === "archived" && (
          <button
            className="btn btn-ghost px-4 py-2 text-sm"
            type="button"
            disabled={busy}
            onClick={() => act({ status: "draft" })}
          >
            Restore to draft
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
