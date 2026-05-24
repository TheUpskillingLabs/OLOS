"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createCycleSchema } from "@/lib/validations/cycles";

type FormData = z.infer<typeof createCycleSchema>;

export default function CreateCycleForm() {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const router = useRouter();

  const form = useForm<FormData>({
    resolver: zodResolver(createCycleSchema),
    defaultValues: { name: "", start_date: "", end_date: "" },
  });
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = form;

  async function onSubmit(data: FormData) {
    setServerError(null);
    const res = await fetch("/api/cycles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
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
        className="inline-flex items-center gap-1.5 rounded-md bg-teal px-4 py-2 text-sm font-semibold tracking-tight text-white shadow-[0_1px_4px_rgba(0,148,160,0.2)] transition-all duration-150 ease-spring hover:bg-teal/80 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
      >
        + New cycle
      </button>
    );
  }

  return (
    <FormProvider {...form}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-md border border-whisper bg-white/[0.02] p-4"
      >
        <h2 className="mb-3 text-sm font-semibold tracking-tight text-white">
          New cycle
        </h2>
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-cloud/80" htmlFor="cycle-name">
              Name
            </label>
            <input
              id="cycle-name"
              {...register("name")}
              placeholder="e.g. Spring 2026"
              className="rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-sm text-white placeholder:text-cloud/40 transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
            />
            {errors.name && (
              <p className="text-xs text-red-300">{errors.name.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-cloud/80" htmlFor="cycle-start">
              Start date
            </label>
            <input
              id="cycle-start"
              {...register("start_date")}
              type="date"
              className="rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-sm text-white transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
            />
            {errors.start_date && (
              <p className="text-xs text-red-300">{errors.start_date.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-cloud/80" htmlFor="cycle-end">
              End date
            </label>
            <input
              id="cycle-end"
              {...register("end_date")}
              type="date"
              className="rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-sm text-white transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
            />
            {errors.end_date && (
              <p className="text-xs text-red-300">{errors.end_date.message}</p>
            )}
          </div>
          <div className="flex items-center gap-2 pt-5">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-teal px-4 py-1.5 text-sm font-semibold tracking-tight text-white shadow-[0_1px_4px_rgba(0,148,160,0.2)] transition-all duration-150 ease-spring hover:bg-teal/80 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
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
              className="text-sm text-cloud/60 transition-colors duration-150 hover:text-cloud focus-visible:outline-none focus-visible:text-cloud"
            >
              Cancel
            </button>
          </div>
        </div>
        {serverError && (
          <p role="alert" className="mt-2 text-xs text-red-300">
            {serverError}
          </p>
        )}
      </form>
    </FormProvider>
  );
}
