"use client";

import * as React from "react";
import { Sparkles, X } from "lucide-react";
import type { PulseComment } from "@/lib/moderator/pod-insights";

/**
 * AI-assisted summary blocks (PRD §7.10.3).
 *
 * OLOS does not run an LLM. These blocks bundle recent member responses with
 * a canonical prompt and let the poderator copy the bundle into their own AI
 * tool (ChatGPT, Claude, …).
 *
 * Two exports:
 *   - CopyBundleBlock — the generic presenter: any labeled items + a
 *     prebuilt bundle string. The Learning Log insights section feeds it.
 *   - AISummaryBlock — the original pulse-typed wrapper, kept with its exact
 *     prop shape so the pulse-insights and cross-pod call sites are
 *     untouched. It maps pulse comments into items and builds its bundle
 *     from cycle_config.ai_summary_prompt (with the historical fallback).
 *
 * Two paths to clipboard:
 *   1. "Copy prompt + responses" — one-click copy, no preview
 *   2. "Preview" — a modal showing the full bundle (not just the first 4
 *      items) with its own Copy button, so the user can confirm what's about
 *      to paste into their AI tool before sending it.
 */

export interface BundleItem {
  key: string;
  /** The bracketed attribution, e.g. "AB · Aug 22" or "Member C · Aug 22 · weekly". */
  label: string;
  /** The response text (may be multi-line). */
  text: string;
}

export function CopyBundleBlock({
  title,
  description,
  itemsLabel,
  scopeLabel,
  emptyMessage,
  items,
  bundle,
  rangeLabel,
}: {
  title: string;
  description: string;
  /** e.g. "Pulse comments" / "Learning Log entries" — the preview strip label. */
  itemsLabel: string;
  scopeLabel: string;
  emptyMessage: string;
  items: BundleItem[];
  bundle: string;
  rangeLabel: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(bundle);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard failed (no permission or unsupported); the Preview modal's
      // selectable textarea is the fallback path.
    }
  };

  return (
    <div className="rounded-card border border-teal/25 bg-teal/[0.04] p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="lbl lbl-teal mb-1">{title}</div>
          <div className="text-sm text-charcoal">{description}</div>
        </div>
        <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-teal-deep" />
      </div>

      <div className="mb-3 max-h-48 overflow-y-auto rounded-card border border-ink/10 bg-white p-4">
        <div className="mb-2 text-[10px] uppercase tracking-widest text-meta">
          {itemsLabel} · {rangeLabel} · {items.length} response
          {items.length === 1 ? "" : "s"} from {scopeLabel}
        </div>
        {items.length === 0 ? (
          <div className="text-xs text-meta">{emptyMessage}</div>
        ) : (
          <div className="space-y-2.5 text-xs text-charcoal">
            {items.slice(0, 4).map((c) => (
              <div key={c.key} className="whitespace-pre-line">
                <span className="text-meta">[{c.label}]</span> {c.text}
              </div>
            ))}
            {items.length > 4 && (
              <div className="italic text-meta">
                …{items.length - 4} more included in the copy
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setPreviewOpen(true)}
          disabled={items.length === 0}
          className="rounded-card border border-ink/10 bg-white px-3 py-1.5 text-xs font-medium text-charcoal transition-colors hover:bg-ink/[0.04] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Preview
        </button>
        <button
          onClick={onCopy}
          disabled={items.length === 0}
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
        itemCount={items.length}
      />
    </div>
  );
}

/** The original pulse-typed block. Prop shape unchanged — do not churn the
    pulse-insights / cross-pod call sites. */
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
  const fallbackPrompt =
    "Summarize the themes across these pulse comments. Flag members or topics worth attention this week. Cite specific responses. Be descriptive, not judgmental.";

  const items: BundleItem[] = comments.map((c, idx) => ({
    key: `${c.participant_id}:${c.scheduled_date}:${idx}`,
    label: `${c.initials} · ${formatWeek(c.scheduled_date)}`,
    text: c.text,
  }));

  const header = (prompt ?? fallbackPrompt).trim();
  const body = items.map((i) => `[${i.label}] ${i.text}`).join("\n\n");
  const bundle = `${header}\n\n---\n\n${body}\n`;

  return (
    <CopyBundleBlock
      title="AI-assisted summary"
      description="Bundle recent pulse comments with a ready-to-use prompt and paste into ChatGPT, Claude, or your AI tool of choice."
      itemsLabel="Pulse comments"
      scopeLabel={scope === "pod" ? "this pod" : "all your pods combined"}
      emptyMessage="No free-text comments in this range yet."
      items={items}
      bundle={bundle}
      rangeLabel={rangeLabel}
    />
  );
}

/**
 * Modal preview of a copy bundle. Native <dialog>; backdrop styling in
 * app/globals.css. Renders the full text in a read-only textarea with its
 * own Copy button so the user can confirm before pasting.
 */
function PreviewDialog({
  open,
  onClose,
  bundle,
  rangeLabel,
  scopeLabel,
  itemCount,
}: {
  open: boolean;
  onClose: () => void;
  bundle: string;
  rangeLabel: string;
  scopeLabel: string;
  itemCount: number;
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const [dialogCopied, setDialogCopied] = React.useState(false);

  React.useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // Reset copy feedback whenever the dialog reopens. Deferred so it isn't a
  // synchronous setState in the effect body (react-hooks/set-state-in-effect).
  React.useEffect(() => {
    if (open) queueMicrotask(() => setDialogCopied(false));
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
          <div className="lbl lbl-teal mb-1">AI summary bundle</div>
          <div className="text-xs text-slate">
            {rangeLabel} · {itemCount} response
            {itemCount === 1 ? "" : "s"} from {scopeLabel}
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

function formatWeek(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
