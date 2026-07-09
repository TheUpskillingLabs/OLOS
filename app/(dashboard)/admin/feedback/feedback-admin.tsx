"use client";

import { useState } from "react";
import Image from "next/image";
import { formatDate } from "@/lib/format/date";
import { StatusBadge } from "@/app/components/ui";
import {
  FEEDBACK_STATUSES,
  type FeedbackStatus,
} from "@/lib/validations/feedback";

/* The /admin/feedback client — every submission grouped by triage status, each
   row showing the report, the author, the originating page, and any
   screenshots (pre-signed URLs from the private bucket). Status changes PATCH
   /api/admin/feedback/[id] and reconcile locally, mirroring announcements-admin. */

export interface FeedbackAttachmentView {
  id: number;
  mimeType: string | null;
  /** Short-lived signed URL, or null if the object couldn't be signed. */
  url: string | null;
}

export interface AdminFeedback {
  id: number;
  category: "bug" | "suggestion" | "other";
  description: string;
  page_url: string | null;
  status: FeedbackStatus;
  created_at: string;
  /** "Name · email", email alone, or null when the reporter has no participant row. */
  author: string | null;
  attachments: FeedbackAttachmentView[];
}

const STATUS_META: Record<
  FeedbackStatus,
  { label: string; variant: "forming" | "draft" | "success" | "inactive" }
> = {
  open: { label: "Open", variant: "forming" },
  in_review: { label: "In review", variant: "draft" },
  resolved: { label: "Resolved", variant: "success" },
  closed: { label: "Closed", variant: "inactive" },
};

const CATEGORY_LABEL: Record<AdminFeedback["category"], string> = {
  bug: "Bug",
  suggestion: "Suggestion",
  other: "Other",
};

export default function FeedbackAdmin({
  initial,
}: {
  initial: AdminFeedback[];
}) {
  const [rows, setRows] = useState<AdminFeedback[]>(initial);

  async function setStatus(id: number, status: FeedbackStatus) {
    const res = await fetch(`/api/admin/feedback/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || "Update failed");
    }
    const data = (await res.json()) as { id: number; status: FeedbackStatus };
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: data.status } : r))
    );
  }

  if (rows.length === 0) {
    return <p className="text-sm text-meta">No feedback yet.</p>;
  }

  return (
    <div className="space-y-10">
      {FEEDBACK_STATUSES.map((status) => {
        const group = rows.filter((r) => r.status === status);
        return (
          <section key={status}>
            <h2 className="lbl mb-3">
              {STATUS_META[status].label} · {group.length}
            </h2>
            {group.length ? (
              <div className="space-y-4">
                {group.map((r) => (
                  <FeedbackRow key={r.id} row={r} onSetStatus={setStatus} />
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

function FeedbackRow({
  row,
  onSetStatus,
}: {
  row: AdminFeedback;
  onSetStatus: (id: number, status: FeedbackStatus) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(status: FeedbackStatus) {
    if (status === row.status) return;
    setBusy(true);
    setError(null);
    try {
      await onSetStatus(row.id, status);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-card border border-ink/10 bg-white p-5 shadow-card">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="lbl">{CATEGORY_LABEL[row.category]}</span>
        <StatusBadge variant={STATUS_META[row.status].variant}>
          {STATUS_META[row.status].label}
        </StatusBadge>
        <span className="ml-auto text-xs text-meta tabular-nums">
          #{row.id} · {row.author ?? "Unknown reporter"} ·{" "}
          {formatDate(row.created_at)}
        </span>
      </div>

      <p className="whitespace-pre-wrap text-sm text-ink">{row.description}</p>

      {row.page_url && (
        <p className="mt-2 truncate text-xs text-meta">
          From:{" "}
          <a
            href={row.page_url}
            className="text-teal-deep hover:text-ink"
            target="_blank"
            rel="noreferrer"
          >
            {row.page_url}
          </a>
        </p>
      )}

      {row.attachments.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {row.attachments.map((a) =>
            a.url ? (
              <a
                key={a.id}
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="relative block h-20 w-20 overflow-hidden rounded-card border border-ink/10 transition-opacity hover:opacity-90"
                title="Open full size"
              >
                <Image
                  src={a.url}
                  alt="Feedback screenshot"
                  fill
                  sizes="80px"
                  className="object-cover"
                  unoptimized
                />
              </a>
            ) : (
              <span
                key={a.id}
                className="flex h-20 w-20 items-center justify-center rounded-card border border-dashed border-ink/15 px-1 text-center text-[10px] text-meta"
              >
                Image unavailable
              </span>
            )
          )}
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm" style={{ color: "var(--red)" }} role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="lbl mr-1">Move to</span>
        {FEEDBACK_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            disabled={busy || s === row.status}
            onClick={() => change(s)}
            className={`btn px-3 py-1.5 text-sm ${
              s === row.status ? "btn-teal" : "btn-ghost"
            }`}
          >
            {STATUS_META[s].label}
          </button>
        ))}
      </div>
    </div>
  );
}
