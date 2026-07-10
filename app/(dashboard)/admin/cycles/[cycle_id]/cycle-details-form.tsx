"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { METROS } from "@/lib/metros";

type DetailsFormData = {
  name: string;
  description: string;
  what_you_build: string;
  metro_slug: string;
  is_hq_internal: boolean;
};

export function CycleDetailsForm({
  cycleId,
  name,
  description,
  whatYouBuild,
  metroSlug,
  isHqInternal = false,
  canEditKind = true,
}: {
  cycleId: number;
  name: string;
  description: string | null;
  whatYouBuild: string | null;
  metroSlug: string | null;
  // The cycle's lab (metro) + HQ-internal flag. Only HQ (full admins) may change
  // these — a labs lead configuring their own cycle can edit copy but must not
  // move the cycle to another lab or hide it. The route strips them server-side
  // regardless; this just hides the controls.
  isHqInternal?: boolean;
  canEditKind?: boolean;
}) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<DetailsFormData>({
    defaultValues: {
      name,
      description: description ?? "",
      what_you_build: whatYouBuild ?? "",
      metro_slug: metroSlug ?? "",
      is_hq_internal: isHqInternal,
    },
  });

  async function onSubmit(data: DetailsFormData) {
    setSaved(false);
    setError(null);
    const body: Record<string, unknown> = {
      name: data.name.trim(),
      description: data.description.trim() || null,
      what_you_build: data.what_you_build.trim() || null,
    };
    if (canEditKind) {
      body.metro_slug = data.metro_slug || null;
      body.is_hq_internal = data.is_hq_internal;
    }
    const res = await fetch(`/api/cycles/${cycleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      const json = await res.json().catch(() => null);
      setError(json?.error ?? "Failed to save cycle details");
    }
  }

  const inputClass =
    "w-full rounded-card border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-4">
      <div>
        <label className="mb-1 block text-sm font-semibold text-charcoal">
          Cycle name
        </label>
        <input className={inputClass} {...register("name")} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold text-charcoal">
          About this cycle
        </label>
        <p className="mb-1.5 text-xs text-meta">
          Shown on the cycle information page. Leave blank to use the standard
          Build Cycle description.
        </p>
        <textarea className={inputClass} rows={4} {...register("description")} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold text-charcoal">
          What you&rsquo;ll build
        </label>
        <p className="mb-1.5 text-xs text-meta">
          Leave blank to use the standard copy.
        </p>
        <textarea
          className={inputClass}
          rows={4}
          {...register("what_you_build")}
        />
      </div>
      {canEditKind && (
        <>
          <div>
            <label className="mb-1 block text-sm font-semibold text-charcoal">
              Lab / region
            </label>
            <p className="mb-1.5 text-xs text-meta">
              Leave unassigned for an <strong>HQ-open</strong> cycle (every lab
              participates; pods form per lab). Assign a lab to make this that
              lab&rsquo;s own cycle, run by its labs lead.
            </p>
            <select className={inputClass} {...register("metro_slug")}>
              <option value="">Unassigned — HQ-open</option>
              {Object.values(METROS).map((m) => (
                <option key={m.slug} value={m.slug}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="flex items-start gap-2 text-sm text-charcoal">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-ink/25 text-teal focus-visible:ring-teal"
                {...register("is_hq_internal")}
              />
              <span>
                <span className="font-semibold">HQ-internal cycle</span> — an
                org/structure cycle (standing teams), hidden from labs leads.
              </span>
            </label>
          </div>
        </>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn btn-teal px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Saving…" : "Save details"}
        </button>
        <Link
          href={`/c/${cycleId}`}
          target="_blank"
          className="text-sm font-semibold text-teal-deep hover:underline"
        >
          View public page →
        </Link>
        {saved && <span className="text-sm text-teal-deep">Saved ✓</span>}
        {error && (
          <span role="alert" className="text-sm text-red">
            {error}
          </span>
        )}
      </div>
    </form>
  );
}
