"use client";

import * as React from "react";
import { MessageSquarePlus, X, Send, ImagePlus, Loader2, Check } from "lucide-react";
import { Button, Field, Textarea, Select } from "@/app/components/ui";

const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

type Category = "bug" | "suggestion" | "other";

interface Attachment {
  name: string;
  type: string;
  size: number;
  preview: string; // object URL for thumbnail
  data: string; // base64 (no data: prefix)
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function FeedbackWidget() {
  const [open, setOpen] = React.useState(false);
  const [category, setCategory] = React.useState<Category>("bug");
  const [description, setDescription] = React.useState("");
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const reset = React.useCallback(() => {
    attachments.forEach((a) => URL.revokeObjectURL(a.preview));
    setCategory("bug");
    setDescription("");
    setAttachments([]);
    setError(null);
    setDone(false);
    setSubmitting(false);
  }, [attachments]);

  const close = React.useCallback(() => {
    setOpen(false);
    reset();
  }, [reset]);

  // Close on Esc
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  async function addFiles(files: FileList | null) {
    if (!files) return;
    setError(null);
    const room = MAX_ATTACHMENTS - attachments.length;
    if (room <= 0) {
      setError(`You can attach up to ${MAX_ATTACHMENTS} images.`);
      return;
    }
    const next: Attachment[] = [];
    for (const file of Array.from(files).slice(0, room)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError("Images must be PNG, JPEG, or WebP.");
        continue;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setError("Each image must be 5MB or smaller.");
        continue;
      }
      try {
        const data = await fileToBase64(file);
        next.push({
          name: file.name,
          type: file.type,
          size: file.size,
          preview: URL.createObjectURL(file),
          data,
        });
      } catch {
        setError("Couldn't read that image. Please try another.");
      }
    }
    if (next.length) setAttachments((prev) => [...prev, ...next]);
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => {
      const a = prev[index];
      if (a) URL.revokeObjectURL(a.preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function submit() {
    if (!description.trim()) {
      setError("Please describe the problem.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          description: description.trim(),
          page_url: typeof window !== "undefined" ? window.location.href : undefined,
          attachments: attachments.map((a) => ({
            name: a.name,
            type: a.type,
            data: a.data,
          })),
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? "Something went wrong. Please try again.");
      }
      setDone(true);
      // Auto-close shortly after the success confirmation.
      setTimeout(() => close(), 1600);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Floating launcher — subtle, parked bottom-right */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Send feedback"
          className="fixed bottom-5 right-5 z-[55] inline-flex items-center gap-2 rounded-full border border-whisper bg-[rgba(42,49,66,0.92)] px-4 py-2.5 text-sm font-medium text-cloud/80 shadow-[0_4px_16px_rgba(0,0,0,0.35)] backdrop-blur-sm transition-all duration-150 ease-out hover:border-white/[0.16] hover:text-cloud hover:shadow-[0_6px_20px_rgba(0,0,0,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
        >
          <MessageSquarePlus className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Feedback</span>
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-title"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={close}
            aria-hidden
          />

          {/* Dialog */}
          <div className="relative w-full max-w-md rounded-xl border border-whisper bg-[rgba(42,49,66,0.98)] shadow-[0_16px_48px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between gap-4 border-b border-whisper px-5 py-4">
              <div>
                <h2
                  id="feedback-title"
                  className="text-base font-semibold tracking-tight text-white"
                >
                  Report a problem
                </h2>
                <p className="mt-0.5 text-xs text-cloud/60">
                  Tell us what went wrong. Screenshots help a lot.
                </p>
              </div>
              <button
                onClick={close}
                aria-label="Close"
                className="rounded-md p-1 text-cloud/60 transition-colors duration-150 hover:bg-white/[0.04] hover:text-cloud focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            {done ? (
              <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal/20 text-aqua">
                  <Check className="h-6 w-6" aria-hidden />
                </span>
                <p className="text-sm font-medium text-white">Thanks — we got it.</p>
                <p className="text-xs text-cloud/60">Your feedback has been sent.</p>
              </div>
            ) : (
              <div className="space-y-4 px-5 py-4">
                <Field label="Category" htmlFor="feedback-category">
                  <Select
                    id="feedback-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as Category)}
                  >
                    <option value="bug">Bug — something is broken</option>
                    <option value="suggestion">Suggestion — an idea or improvement</option>
                    <option value="other">Other</option>
                  </Select>
                </Field>

                <Field
                  label="What's the problem?"
                  htmlFor="feedback-description"
                  required
                  charCount={`${description.length}/5000`}
                >
                  <Textarea
                    id="feedback-description"
                    rows={4}
                    maxLength={5000}
                    placeholder="Describe what you saw and what you expected…"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </Field>

                <Field label="Attachments" helper={`Up to ${MAX_ATTACHMENTS} images · PNG, JPG, or WebP · 5MB each`}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      void addFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  {attachments.length < MAX_ATTACHMENTS && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-white/[0.16] bg-white/[0.02] px-3 py-3 text-sm text-cloud/60 transition-colors duration-150 hover:border-teal/50 hover:text-cloud focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                    >
                      <ImagePlus className="h-4 w-4" aria-hidden />
                      Click to attach images
                    </button>
                  )}
                  {attachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {attachments.map((a, i) => (
                        <div
                          key={i}
                          className="relative h-16 w-16 overflow-hidden rounded-md border border-whisper"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={a.preview}
                            alt={a.name}
                            className="h-full w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeAttachment(i)}
                            aria-label={`Remove ${a.name}`}
                            className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white transition-colors hover:bg-red"
                          >
                            <X className="h-3 w-3" aria-hidden />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </Field>

                {error && (
                  <p className="text-xs text-red-300" role="alert">
                    {error}
                  </p>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button variant="secondary" onClick={close} disabled={submitting}>
                    Cancel
                  </Button>
                  <Button onClick={submit} disabled={submitting || !description.trim()}>
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Sending…
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" aria-hidden />
                        Send
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
