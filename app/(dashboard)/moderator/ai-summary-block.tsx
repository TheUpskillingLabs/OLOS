"use client";

import * as React from "react";
import { Sparkles, X } from "lucide-react";
import type { PulseComment } from "@/lib/moderator/pod-insights";

/**
 * AI-assisted summary block (PRD §7.10.3).
 *
 * OLOS does not run an LLM. This block bundles recent pulse comments
 * (initials only) with the canonical prompt from cycle_config.ai_summary_prompt
 * and lets the poderator copy the bundle to their own AI tool.
 *
 * Same component used on both All pods (cross-pod scope) and per-pod
 * surfaces — the scope only changes what `comments` and `rangeLabel`
 * are passed in.
 *
 * Two paths to clipboard:
 *   1. "Copy prompt + responses" — one-click copy, no preview
 *   2. "Preview" — opens a modal showing the full bundle (full prompt +
 *      every included comment, not just the first 4); modal has its own
 *      Copy button so the user can confirm what's about to paste into
 *      their AI tool before sending it.
 */
export function AISummaryBlock({
  scope,
  prompt,
  comments,
  rangeLabel,
}: {
  scope: "pod" | "all-pods";
  prompt: string | null;
  comments: PulseComment[];
  rangeLabel: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);

  const fallbackPrompt =
    "Summarize the themes across these pulse comments. Flag members or topics worth attention this week. Cite specific responses. Be descriptive, not judgmental.";

  const bundle = buildBundle(prompt ?? fallbackPrompt, comments);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(bundle);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard failed (no permission or unsupported); render textarea
      // fallback inline next render. For now, just no-op.
    }
  };

  const scopeLabel =
    scope === "pod" ? "this pod" : "all your pods combined";

  return (
    <div className="rounded-card border border-teal/25 bg-teal/[0.04] p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="lbl lbl-teal mb-1">
            AI-assisted summary
          </div>
          <div className="text-sm text-charcoal">
            Bundle recent pulse comments with a ready-to-use prompt and
            paste into ChatGPT, Claude, or your AI tool of choice.
          </div>
        </div>
        <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-teal-deep" />
      </div>

      <div className="mb-3 max-h-48 overflow-y-auto rounded-card border border-ink/10 bg-white p-4">
        <div className="mb-2 text-[10px] uppercase tracking-widest text-meta">
          Pulse comments · {rangeLabel} · {comments.length} response
          {comments.length === 1 ? "" : "s"} from {scopeLabel}
        </div>
        {comments.length === 0 ? (
          <div className="text-xs text-meta">
            No free-text comments in this range yet.
          </div>
        ) : (
          <div className="space-y-2.5 text-xs text-charcoal">
            {comments.slice(0, 4).map((c, idx) => (
              <div key={`${c.participant_id}:${c.scheduled_date}:${idx}`}>
                <span className="text-meta">
                  [{c.initials} · {formatWeek(c.scheduled_date)}]
                </span>{" "}
                {c.text}
              </div>
            ))}
            {comments.length > 4 && (
              <div className="italic text-meta">
                …{comments.length - 4} more comments included in the copy
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setPreviewOpen(true)}
          disabled={comments.length === 0}
          className="rounded-card border border-ink/10 bg-white px-3 py-1.5 text-xs font-medium text-charcoal transition-colors hover:bg-ink/[0.04] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Preview
        </button>
        <button
          onClick={onCopy}
          disabled={comments.length === 0}
          className="rounded-card bg-teal-deep px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-teal disabled:cursor-not-allowed disabled:opacity-40"
        >
          {copied ? "Copied!" : "Copy prompt + responses"}
        </button>
      </div>

      <PreviewDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        bundle={bundle}
        rangeLabel={rangeLabel}
        scopeLabel={scopeLabel}
        commentCount={comments.length}
      />
    </div>
  );
}

/**
 * Modal preview of the AI-summary bundle. Uses the native <dialog>
 * element — backdrop styling is in app/globals.css. The dialog renders
 * the full text (not truncated to 4 comments like the inline preview)
 * in a read-only textarea, with its own Copy button so the user can
 * confirm before pasting.
 */
function PreviewDialog({
  open,
  onClose,
  bundle,
  rangeLabel,
  scopeLabel,
  commentCount,
}: {
  open: boolean;
  onClose: () => void;
  bundle: string;
  rangeLabel: string;
  scopeLabel: string;
  commentCount: number;
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const [dialogCopied, setDialogCopied] = React.useState(false);

  React.useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // Reset copy feedback whenever the dialog reopens. Deferred so the state
  // update doesn't run synchronously inside the effect body (lint fix).
  React.useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => setDialogCopied(false), 0);
    return () => clearTimeout(id);
  }, [open]);

  const onDialogCopy = async () => {
    try {
      await navigator.clipboard.writeText(bundle);
      setDialogCopied(true);
      setTimeout(() => setDialogCopied(false), 2500);
    } catch {
      // ignore — textarea is selectable as fallback
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={onClose}
      className="w-full max-w-3xl rounded-card border border-ink/10 bg-white p-0 text-charcoal shadow-card-lg backdrop:bg-[rgba(0,20,27,0.5)]"
    >
      <div className="flex items-start justify-between gap-4 border-b border-ink/10 px-5 py-4">
        <div>
          <div className="lbl lbl-teal mb-1">
            AI summary bundle
          </div>
          <div className="text-xs text-slate">
            {rangeLabel} · {commentCount} response
            {commentCount === 1 ? "" : "s"} from {scopeLabel}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="rounded p-1 text-meta transition-colors hover:bg-ink/[0.04] hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="px-5 py-4">
        <textarea
          readOnly
          value={bundle}
          className="h-96 w-full resize-none rounded-card border border-ink/10 bg-paper px-3 py-2 font-mono text-xs leading-relaxed text-charcoal focus-visible:border-teal focus-visible:outline-none"
        />
        <div className="mt-1 text-[10px] text-meta">
          This is exactly what gets copied. Select-all + ⌘C also works.
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-ink/10 px-5 py-3">
        <button
          onClick={onClose}
          className="rounded-card border border-ink/10 bg-white px-3 py-1.5 text-xs font-medium text-charcoal transition-colors hover:bg-ink/[0.04]"
        >
          Close
        </button>
        <button
          onClick={onDialogCopy}
          className="rounded-card bg-teal-deep px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-teal"
        >
          {dialogCopied ? "Copied!" : "Copy"}
        </button>
      </div>
    </dialog>
  );
}

function buildBundle(prompt: string, comments: PulseComment[]): string {
  const header = prompt.trim();
  const body = comments
    .map(
      (c) =>
        `[${c.initials} · ${formatWeek(c.scheduled_date)}] ${c.text}`
    )
    .join("\n\n");
  return `${header}\n\n---\n\n${body}\n`;
}

function formatWeek(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
