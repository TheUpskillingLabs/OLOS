"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/* Create a new field survey (draft). Ships with no questions — the builder
   opens straight after so the admin can add them before opening it. Every
   survey is affiliated with a cycle at creation, one survey per cycle
   (00089) — cycles that already have one render disabled. */

export interface CycleOption {
  id: number;
  name: string;
  status: string;
  hasSurvey: boolean;
}

export default function CreateSurveyForm({
  cycles,
}: {
  cycles: CycleOption[];
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [domain, setDomain] = useState("");
  const [cycleId, setCycleId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await fetch("/api/surveys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        share_slug: slug.trim(),
        problem_domain: domain.trim() || null,
        cycle_id: Number(cycleId),
      }),
    }).catch(() => null);
    setSubmitting(false);
    if (res?.ok) {
      const created = await res.json();
      router.push(`/admin/surveys/${created.share_slug}`);
    } else {
      const body = res ? await res.json().catch(() => null) : null;
      setError(body?.error ?? "Couldn't create the survey.");
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-teal inline-flex items-center gap-1.5 px-4 py-2 text-sm"
      >
        + New survey
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-md rounded-card border border-ink/10 bg-white p-4 shadow-card"
    >
      <h2 className="mb-3 text-sm font-semibold tracking-tight text-ink">
        New survey
      </h2>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-xs font-medium text-charcoal">
          Cycle (one survey per cycle)
          <select
            value={cycleId}
            onChange={(e) => setCycleId(e.target.value)}
            className="rounded-card border border-ink/10 bg-white px-3 py-1.5 text-base text-ink focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
          >
            <option value="">Choose a cycle…</option>
            {cycles.map((c) => (
              <option key={c.id} value={c.id} disabled={c.hasSurvey}>
                {c.name} ({c.status}){c.hasSurvey ? " — has a survey" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-charcoal">
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Housing: Field Survey"
            className="rounded-card border border-ink/10 bg-white px-3 py-1.5 text-base text-ink placeholder:text-meta focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-charcoal">
          Share slug (the public URL: /survey/&lt;slug&gt;)
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="e.g. housing"
            className="rounded-card border border-ink/10 bg-white px-3 py-1.5 font-mono text-sm text-ink placeholder:text-meta focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-charcoal">
          Problem domain (optional)
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="e.g. Housing"
            className="rounded-card border border-ink/10 bg-white px-3 py-1.5 text-base text-ink placeholder:text-meta focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
          />
        </label>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting || !title.trim() || !slug.trim() || !cycleId}
          className="btn btn-teal px-4 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create & edit"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="text-sm text-meta hover:text-charcoal"
        >
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red">
          {error}
        </p>
      )}
    </form>
  );
}
