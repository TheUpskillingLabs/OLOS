"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, StatusBadge, ToggleSwitch } from "@/app/components/ui";
import { Field, Input, Textarea, Select } from "@/app/components/ui";
import { toLabInput, fromLabInput, fmtLabDateTime } from "@/lib/cycles/lab-time";

/* Admin CRUD for authored member tasks (custom_tasks, 00097). Create/edit
   posts to /api/admin/tasks; archive/restore PATCHes `archived`. A
   re-announcement should be a NEW task (fresh id → fresh dismissal state),
   which is why there is no "un-archive and bump" shortcut. */

export interface CustomTaskRow {
  id: number;
  title: string;
  detail: string | null;
  href: string;
  cta: string | null;
  cycle_id: number | null;
  starts_at: string | null;
  ends_at: string | null;
  pinned: boolean;
  dismissible: boolean;
  archived_at: string | null;
}

export interface CycleOption {
  id: number;
  name: string;
  status: string;
}

interface FormState {
  title: string;
  detail: string;
  href: string;
  cta: string;
  cycleId: string; // "" = program-global
  startsAt: string; // datetime-local value, lab wall-clock
  endsAt: string;
  pinned: boolean;
  dismissible: boolean;
}

const EMPTY: FormState = {
  title: "",
  detail: "",
  href: "",
  cta: "",
  cycleId: "",
  startsAt: "",
  endsAt: "",
  pinned: false,
  dismissible: true,
};

function toForm(t: CustomTaskRow): FormState {
  return {
    title: t.title,
    detail: t.detail ?? "",
    href: t.href,
    cta: t.cta ?? "",
    cycleId: t.cycle_id ? String(t.cycle_id) : "",
    startsAt: toLabInput(t.starts_at),
    endsAt: toLabInput(t.ends_at),
    pinned: t.pinned,
    dismissible: t.dismissible,
  };
}

function statusOf(
  t: CustomTaskRow,
  nowMs: number
): {
  label: string;
  variant: "active" | "forming" | "inactive" | "draft";
} {
  if (t.archived_at) return { label: "archived", variant: "inactive" };
  if (t.starts_at && Date.parse(t.starts_at) > nowMs)
    return { label: "scheduled", variant: "forming" };
  if (t.ends_at && Date.parse(t.ends_at) <= nowMs)
    return { label: "ended", variant: "inactive" };
  return { label: "live", variant: "active" };
}

export default function CustomTasksManager({
  tasks,
  cycles,
  nowMs,
}: {
  tasks: CustomTaskRow[];
  cycles: CycleOption[];
  /** Render instant from the server page (render-purity: no Date.now() here). */
  nowMs: number;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    const payload = {
      title: form.title,
      detail: form.detail.trim() || null,
      href: form.href,
      cta: form.cta.trim() || null,
      cycle_id: form.cycleId ? parseInt(form.cycleId, 10) : null,
      starts_at: form.startsAt ? fromLabInput(form.startsAt) : null,
      ends_at: form.endsAt ? fromLabInput(form.endsAt) : null,
      pinned: form.pinned,
      dismissible: form.dismissible,
    };
    const res = await fetch(
      editingId ? `/api/admin/tasks/${editingId}` : "/api/admin/tasks",
      {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Save failed — check the fields and try again.");
      return;
    }
    setForm(EMPTY);
    setEditingId(null);
    router.refresh();
  };

  const setArchived = async (t: CustomTaskRow, archived: boolean) => {
    await fetch(`/api/admin/tasks/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived }),
    });
    router.refresh();
  };

  return (
    <div className="space-y-8">
      {/* ── Create / edit form ─────────────────────────────────────── */}
      <section className="rounded-card border border-ink/10 bg-white p-5 shadow-card">
        <h2 className="t-h4 mb-4 text-ink">
          {editingId ? `Edit task #${editingId}` : "New task"}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" required htmlFor="ct-title" className="sm:col-span-2">
            <Input
              id="ct-title"
              value={form.title}
              maxLength={200}
              onChange={(e) => set("title", e.target.value)}
              placeholder="RSVP for the Summit"
            />
          </Field>
          <Field
            label="Detail"
            helper="Optional supporting line under the title."
            htmlFor="ct-detail"
            className="sm:col-span-2"
          >
            <Textarea
              id="ct-detail"
              rows={2}
              maxLength={1000}
              value={form.detail}
              onChange={(e) => set("detail", e.target.value)}
            />
          </Field>
          <Field
            label="Link"
            required
            helper="App path (/events/summit), anchor (#learning-log), or full URL."
            htmlFor="ct-href"
          >
            <Input
              id="ct-href"
              value={form.href}
              maxLength={500}
              onChange={(e) => set("href", e.target.value)}
              placeholder="/events/summit-2026"
            />
          </Field>
          <Field label="Button label" htmlFor="ct-cta">
            <Input
              id="ct-cta"
              value={form.cta}
              maxLength={40}
              onChange={(e) => set("cta", e.target.value)}
              placeholder="RSVP"
            />
          </Field>
          <Field
            label="Audience"
            helper="Everyone, or only members engaged in one cycle."
            htmlFor="ct-cycle"
          >
            <Select
              id="ct-cycle"
              value={form.cycleId}
              onChange={(e) => set("cycleId", e.target.value)}
            >
              <option value="">Everyone (program-global)</option>
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.status})
                </option>
              ))}
            </Select>
          </Field>
          {/* datetime-local inputs have a hard intrinsic min-width — they
              must stack on phones or the right one overlaps its neighbor. */}
          <Field
            label="Shows from"
            helper="Lab time (ET). Blank = now."
            htmlFor="ct-starts"
          >
            <Input
              id="ct-starts"
              type="datetime-local"
              className="min-w-0"
              value={form.startsAt}
              onChange={(e) => set("startsAt", e.target.value)}
            />
          </Field>
          <Field
            label="Due / hides at"
            helper="Shown as the deadline; the task disappears after."
            htmlFor="ct-ends"
          >
            <Input
              id="ct-ends"
              type="datetime-local"
              className="min-w-0"
              value={form.endsAt}
              onChange={(e) => set("endsAt", e.target.value)}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 sm:col-span-2">
            <label className="flex items-center gap-3 text-sm text-charcoal">
              <ToggleSwitch
                checked={form.pinned}
                onChange={() => set("pinned", !form.pinned)}
                label="Pinned"
              />
              Pinned — leads the queue, right under the weekly-log gate
            </label>
            <label className="flex items-center gap-3 text-sm text-charcoal">
              <ToggleSwitch
                checked={form.dismissible}
                onChange={() => set("dismissible", !form.dismissible)}
                label="Dismissible"
              />
              Members can dismiss it
            </label>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red">{error}</p>}
        <div className="mt-4 flex items-center gap-3">
          <Button
            onClick={submit}
            disabled={busy || !form.title.trim() || !form.href.trim()}
          >
            {editingId ? "Save changes" : "Create task"}
          </Button>
          {editingId && (
            <Button
              variant="secondary"
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY);
                setError(null);
              }}
            >
              Cancel
            </Button>
          )}
        </div>
      </section>

      {/* ── Existing tasks ─────────────────────────────────────────── */}
      <section>
        <h2 className="t-h4 mb-3 text-ink">Authored tasks</h2>
        {tasks.length === 0 ? (
          <p className="text-sm text-meta">
            Nothing authored yet — tasks you create here appear in every
            member&apos;s &ldquo;Up next&rdquo; queue.
          </p>
        ) : (
          <ul className="divide-y divide-ink/10 rounded-card border border-ink/10 bg-white shadow-card">
            {tasks.map((t) => {
              const s = statusOf(t, nowMs);
              const cycle = cycles.find((c) => c.id === t.cycle_id);
              return (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold tracking-tight text-ink">
                        {t.title}
                      </span>
                      <StatusBadge variant={s.variant}>{s.label}</StatusBadge>
                      {t.pinned && <StatusBadge variant="forming">pinned</StatusBadge>}
                      {!t.dismissible && (
                        <StatusBadge variant="draft">not dismissible</StatusBadge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-meta">
                      {t.cycle_id
                        ? `Cycle: ${cycle?.name ?? `#${t.cycle_id}`}`
                        : "Everyone"}
                      {t.ends_at ? ` · due ${fmtLabDateTime(t.ends_at)}` : ""}
                      {t.starts_at && Date.parse(t.starts_at) > nowMs
                        ? ` · shows from ${fmtLabDateTime(t.starts_at)}`
                        : ""}
                      {" · "}
                      <span className="break-all">{t.href}</span>
                    </p>
                  </div>
                  <span className="flex flex-shrink-0 items-center gap-3">
                    {!t.archived_at && (
                      <button
                        type="button"
                        className="text-xs font-semibold text-teal-deep hover:underline"
                        onClick={() => {
                          setEditingId(t.id);
                          setForm(toForm(t));
                          setError(null);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        Edit
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-xs text-meta hover:text-ink hover:underline"
                      onClick={() => setArchived(t, !t.archived_at)}
                    >
                      {t.archived_at ? "Restore" : "Archive"}
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
