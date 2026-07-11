"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createCycleSchema } from "@/lib/validations/cycles";

type FormData = z.infer<typeof createCycleSchema>;

/**
 * fixedMode: when set, this form is scoped to a single cycle track — the
 * Type select is hidden, `mode` is pinned in both the RHF defaults and the
 * POST body, and (for "org") the copy retitles to the organization-cycle
 * language used on /admin/org. Absent (the default /admin cycles list use),
 * behavior is unchanged: both cycle types selectable via the Type select.
 *
 * labId: when set (the /admin/labs/[slug] drill-in), the new cycle is pinned
 * to that local lab's stream (docs/LOCAL_LABS.md) — same pattern as
 * fixedMode, no visible control. Absent = HQ/global.
 */
export default function CreateCycleForm({
  fixedMode,
  labId,
}: {
  fixedMode?: "open" | "org";
  labId?: number;
} = {}) {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const router = useRouter();

  const form = useForm<FormData>({
    resolver: zodResolver(createCycleSchema),
    defaultValues: {
      name: "",
      start_date: "",
      end_date: "",
      mode: fixedMode ?? "open",
    },
  });
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = form;

  async function onSubmit(data: FormData) {
    setServerError(null);
    const res = await fetch("/api/cycles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        ...(fixedMode ? { mode: fixedMode } : {}),
        ...(labId ? { lab_id: labId } : {}),
        start_date: new Date(data.start_date).toISOString(),
        end_date: new Date(data.end_date).toISOString(),
      }),
    });

    if (res.ok) {
      const cycle = await res.json();
      router.push(`/admin/cycles/${cycle.id}`);
    } else {
      const body = await res.json();
      setServerError(body.error ?? "Failed to create cycle");
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn btn-teal inline-flex items-center gap-1.5 px-4 py-2 text-sm"
      >
        {fixedMode === "org" ? "+ New org cycle" : "+ New cycle"}
      </button>
    );
  }

  return (
    <FormProvider {...form}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-card border border-ink/10 bg-white p-4 shadow-card"
      >
        <h2 className="mb-3 text-sm font-semibold tracking-tight text-ink">
          {fixedMode === "org" ? "New organization cycle" : "New cycle"}
        </h2>
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-charcoal" htmlFor="cycle-name">
              Name
            </label>
            <input
              id="cycle-name"
              {...register("name")}
              placeholder="e.g. Spring 2026"
              className="rounded-card border border-ink/10 bg-white px-3 py-1.5 text-base text-ink placeholder:text-meta transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
            />
            {errors.name && (
              <p className="text-xs text-red">{errors.name.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-charcoal" htmlFor="cycle-start">
              Start date
            </label>
            <input
              id="cycle-start"
              {...register("start_date")}
              type="date"
              className="rounded-card border border-ink/10 bg-white px-3 py-1.5 text-base text-ink transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
            />
            {errors.start_date && (
              <p className="text-xs text-red">{errors.start_date.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-charcoal" htmlFor="cycle-end">
              End date
            </label>
            <input
              id="cycle-end"
              {...register("end_date")}
              type="date"
              className="rounded-card border border-ink/10 bg-white px-3 py-1.5 text-base text-ink transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
            />
            {errors.end_date && (
              <p className="text-xs text-red">{errors.end_date.message}</p>
            )}
          </div>
          {!fixedMode && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-charcoal" htmlFor="cycle-mode">
                Type
              </label>
              <select
                id="cycle-mode"
                {...register("mode")}
                className="rounded-card border border-ink/10 bg-white px-3 py-1.5 text-base text-ink transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
              >
                <option value="open">Participant cycle</option>
                <option value="org">Organization cycle</option>
              </select>
              {errors.mode && (
                <p className="text-xs text-red">{errors.mode.message}</p>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 pt-5">
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-teal px-4 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Creating…" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setServerError(null);
                reset();
              }}
              className="text-sm text-meta transition-colors duration-150 hover:text-charcoal"
            >
              Cancel
            </button>
          </div>
        </div>
        {serverError && (
          <p role="alert" className="mt-2 text-xs text-red">
            {serverError}
          </p>
        )}
      </form>
    </FormProvider>
  );
}
