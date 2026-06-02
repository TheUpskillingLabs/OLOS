"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
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

  const fallbackPrompt =
    "Summarize the themes across these pulse comments. Flag members or topics worth attention this week. Cite specific responses. Be descriptive, not judgmental.";

  const onCopy = async () => {
    const bundle = buildBundle(prompt ?? fallbackPrompt, comments);
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
    <div className="rounded-md border border-teal/25 bg-teal/[0.04] p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs uppercase tracking-widest text-aqua/80">
            AI-assisted summary
          </div>
          <div className="text-sm text-cloud/85">
            Bundle recent pulse comments with a ready-to-use prompt and
            paste into ChatGPT, Claude, or your AI tool of choice.
          </div>
        </div>
        <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-aqua/70" />
      </div>

      <div className="mb-3 max-h-48 overflow-y-auto rounded-md border border-whisper bg-ink/40 p-4">
        <div className="mb-2 text-[10px] uppercase tracking-widest text-cloud/40">
          Pulse comments · {rangeLabel} · {comments.length} response
          {comments.length === 1 ? "" : "s"} from {scopeLabel}
        </div>
        {comments.length === 0 ? (
          <div className="text-xs text-cloud/50">
            No free-text comments in this range yet.
          </div>
        ) : (
          <div className="space-y-2.5 text-xs text-cloud/80">
            {comments.slice(0, 4).map((c, idx) => (
              <div key={`${c.participant_id}:${c.scheduled_date}:${idx}`}>
                <span className="text-cloud/45">
                  [{c.initials} · {formatWeek(c.scheduled_date)}]
                </span>{" "}
                {c.text}
              </div>
            ))}
            {comments.length > 4 && (
              <div className="italic text-cloud/45">
                …{comments.length - 4} more comments included in the copy
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <button
          onClick={onCopy}
          disabled={comments.length === 0}
          className="rounded bg-teal/25 px-3 py-1.5 text-xs font-medium text-aqua transition-colors hover:bg-teal/35 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {copied ? "Copied!" : "Copy prompt + responses"}
        </button>
      </div>
    </div>
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
