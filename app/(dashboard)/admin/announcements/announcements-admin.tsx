"use client";

import { useState, useSyncExternalStore } from "react";
import { formatDate } from "@/lib/format/date";
import {
  announcementPhase,
  defaultExpiry,
  fromLocalInput,
  toLocalInput,
  type AnnouncementPhase,
} from "@/lib/announcements/schedule";

/* The /admin/announcements client — a compose form on top, then the existing
   posts grouped by where they sit right now (Live / Scheduled / Drafts /
   Archived). Each row owns its edit state; the parent holds the list and
   reconciles after each API call. Mirrors stories-admin.tsx, plus a create
   path (spotlights are user-submitted; announcements are authored here).

   Scheduling (00104): "Go live" sets published_at — a future time schedules
   the post. "Expires" auto-archives it; a new post defaults to two weeks from
   creation (or from its go-live, when scheduled). Expired posts drop off the
   member feed immediately and are swept to Archived by an hourly cron; until
   then they're grouped with Archived here. */

export interface AdminAnnouncement {
  id: number;
  title: string;
  body: string;
  lab_id: number | null;
  status: "draft" | "published" | "archived";
  pinned: boolean;
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface LabOption {
  id: number;
  label: string;
}

interface SavedFields {
  id: number;
  status: AdminAnnouncement["status"];
  published_at: string | null;
  expires_at: string | null;
}

const inputCls =
  "w-full rounded-card border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal";

// datetime-local values are in the browser's timezone, so they can't be
// server-rendered without a hydration mismatch. Render them empty on the
// server and during hydration, then fill in on the client.
const noopSubscribe = () => () => {};
function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

function isFuture(iso: string | null) {
  return iso != null && new Date(iso).getTime() > Date.now();
}

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
    const data = (await res.json()) as SavedFields;
    const row: AdminAnnouncement = {
      id: data.id,
      title: String(body.title ?? ""),
      body: String(body.body ?? ""),
      lab_id: (body.lab_id as number | null) ?? null,
      status: data.status,
      pinned: Boolean(body.pinned),
      published_at: data.published_at,
      expires_at: data.expires_at,
      created_at: new Date().toISOString(),
    };
    setRows((prev) => [row, ...prev]);
  }

  async function patch(
    id: number,
    body: Record<string, unknown>
  ): Promise<SavedFields> {
    const res = await fetch(`/api/admin/announcements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || "Save failed");
    }
    const data = (await res.json()) as SavedFields;
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? ({
              ...r,
              ...body,
              status: data.status,
              published_at: data.published_at,
              expires_at: data.expires_at,
            } as AdminAnnouncement)
          : r
      )
    );
    return data;
  }

  async function remove(id: number) {
    const res = await fetch(`/api/admin/announcements/${id}`, {
      method: "DELETE",
    });
    if (res.ok) setRows((prev) => prev.filter((r) => r.id !== id));
  }

  const groups: [string, AnnouncementPhase[]][] = [
    ["Live", ["live"]],
    ["Scheduled", ["scheduled"]],
    ["Drafts", ["draft"]],
    ["Archived", ["archived", "expired"]],
  ];
  const now = new Date();

  return (
    <div className="space-y-10">
      <ComposeForm labs={labs} fixedLab={fixedLab} onCreate={create} />

      {groups.map(([label, phases]) => {
        const g = rows.filter((r) => phases.includes(announcementPhase(r, now)));
        return (
          <section key={label}>
            <h2 className="lbl mb-3">
              {label} · {g.length}
            </h2>
            {g.length ? (
              <div className="space-y-4">
                {g.map((r) => (
                  <AnnouncementRow
                    key={r.id}
                    row={r}
                    phase={announcementPhase(r, now)}
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

/** Go-live + expiry inputs, shared by the compose form and each row. Values
    are ISO strings (or null); conversion to the browser's local time happens
    only here. */
function ScheduleFields({
  goLive,
  onGoLive,
  expiresAt,
  onExpiresAt,
  goLiveHint,
}: {
  goLive: string | null;
  onGoLive: (iso: string | null) => void;
  expiresAt: string | null;
  onExpiresAt: (iso: string | null) => void;
  goLiveHint: string;
}) {
  const hydrated = useHydrated();
  const never = expiresAt == null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className="lbl mb-1 block">Go live</span>
        <input
          type="datetime-local"
          className={inputCls}
          value={hydrated ? toLocalInput(goLive) : ""}
          onChange={(e) => onGoLive(fromLocalInput(e.target.value))}
        />
        <span className="mt-1 block text-xs text-meta">{goLiveHint}</span>
      </label>
      <div className="block">
        <label className="block">
          <span className="lbl mb-1 block">Expires</span>
          <input
            type="datetime-local"
            className={inputCls}
            disabled={never}
            value={hydrated ? toLocalInput(expiresAt) : ""}
            onChange={(e) => onExpiresAt(fromLocalInput(e.target.value))}
          />
        </label>
        <label className="mt-1 flex items-center gap-2 text-xs text-meta">
          <input
            type="checkbox"
            checked={never}
            onChange={(e) =>
              onExpiresAt(
                e.target.checked
                  ? null
                  : defaultExpiry(
                      isFuture(goLive) ? new Date(goLive!) : new Date()
                    ).toISOString()
              )
            }
          />
          Never expires (otherwise auto-archives at this time)
        </label>
      </div>
    </div>
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
  const [goLive, setGoLive] = useState<string | null>(null);
  // Until the admin touches it, expiry tracks the default: two weeks from
  // creation, or from the go-live time when the post is scheduled.
  const [expiresOverride, setExpiresOverride] = useState<
    { value: string | null } | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scheduled = isFuture(goLive);
  const defaultExpiresAt = defaultExpiry(
    scheduled ? new Date(goLive!) : new Date()
  ).toISOString();
  const expiresAt = expiresOverride ? expiresOverride.value : defaultExpiresAt;

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
        published_at: goLive,
        // Untouched + not scheduled: let the server stamp creation + 14 days.
        ...(expiresOverride || scheduled ? { expires_at: expiresAt } : {}),
      });
      setTitle("");
      setBody("");
      setLabId(fixedLab?.id ?? null);
      setPinned(false);
      setGoLive(null);
      setExpiresOverride(null);
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
        <ScheduleFields
          goLive={goLive}
          onGoLive={setGoLive}
          expiresAt={expiresAt}
          onExpiresAt={(v) => setExpiresOverride({ value: v })}
          goLiveHint="Leave blank to go live as soon as you publish."
        />
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
          {busy ? "…" : scheduled ? "Schedule" : "Publish"}
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

function phaseMeta(row: AdminAnnouncement, phase: AnnouncementPhase): string {
  const parts: string[] = [];
  if (phase === "scheduled" && row.published_at) {
    parts.push(`goes live ${formatDate(row.published_at)}`);
  } else if (row.published_at && phase !== "draft") {
    parts.push(`published ${formatDate(row.published_at)}`);
  } else {
    parts.push(`created ${formatDate(row.created_at)}`);
  }
  if (phase === "expired" && row.expires_at) {
    parts.push(`expired ${formatDate(row.expires_at)}`);
  } else if (row.expires_at && phase !== "archived") {
    parts.push(`expires ${formatDate(row.expires_at)}`);
  } else if (!row.expires_at && phase !== "archived") {
    parts.push("never expires");
  }
  return parts.join(" · ");
}

function AnnouncementRow({
  row,
  phase,
  labs,
  fixedLab,
  labLabel,
  onPatch,
  onRemove,
}: {
  row: AdminAnnouncement;
  phase: AnnouncementPhase;
  labs: LabOption[];
  fixedLab?: { id: number; label: string };
  labLabel: (labId: number | null) => string;
  onPatch: (id: number, body: Record<string, unknown>) => Promise<SavedFields>;
  onRemove: (id: number) => Promise<void>;
}) {
  const [title, setTitle] = useState(row.title);
  const [body, setBody] = useState(row.body);
  const [labId, setLabId] = useState<number | null>(row.lab_id);
  const [pinned, setPinned] = useState(row.pinned);
  const [goLive, setGoLive] = useState<string | null>(row.published_at);
  const [expiresAt, setExpiresAt] = useState<string | null>(row.expires_at);
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only send the schedule when it changed, so editing the title of a post
  // doesn't re-validate (and trip over) an untouched window.
  function editedFields() {
    const fields: Record<string, unknown> = {
      title: title.trim(),
      body: body.trim(),
      lab_id: labId,
      pinned,
    };
    if (goLive !== row.published_at) fields.published_at = goLive;
    if (expiresAt !== row.expires_at) fields.expires_at = expiresAt;
    return fields;
  }

  async function act(patchBody: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const saved = await onPatch(row.id, patchBody);
      // The server may have stamped either timestamp (publish → now); adopt
      // its values so the next Save diffs against what's stored.
      setGoLive(saved.published_at);
      setExpiresAt(saved.expires_at);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const willSchedule = isFuture(goLive);

  return (
    <div className="rounded-card border border-ink/10 bg-white p-5 shadow-card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-meta tabular-nums">
          #{row.id} · {labLabel(row.lab_id)}
          {row.pinned ? " · pinned" : ""} · {phaseMeta(row, phase)}
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
        <ScheduleFields
          goLive={goLive}
          onGoLive={setGoLive}
          expiresAt={expiresAt}
          onExpiresAt={setExpiresAt}
          goLiveHint={
            phase === "live"
              ? "When this post went live."
              : "Leave blank to go live as soon as you publish."
          }
        />
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
        {phase === "draft" && (
          <button
            className="btn btn-teal px-4 py-2 text-sm"
            type="button"
            disabled={busy}
            onClick={() =>
              act({
                ...editedFields(),
                status: "published",
                // A stale (past) planned go-live publishes now instead.
                published_at: willSchedule ? goLive : null,
              })
            }
          >
            {busy ? "…" : willSchedule ? "Schedule" : "Publish"}
          </button>
        )}
        {phase === "scheduled" && (
          <button
            className="btn btn-teal px-4 py-2 text-sm"
            type="button"
            disabled={busy}
            onClick={() =>
              act({ ...editedFields(), published_at: new Date().toISOString() })
            }
          >
            {busy ? "…" : "Publish now"}
          </button>
        )}
        {(phase === "draft" || phase === "scheduled" || phase === "live") && (
          <button
            className="btn btn-ghost px-4 py-2 text-sm"
            type="button"
            disabled={busy}
            onClick={() => act({ status: "archived" })}
          >
            Archive
          </button>
        )}
        {(phase === "archived" || phase === "expired") && (
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
