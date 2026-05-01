"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateCycleForm() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    setLoading(true);

    const res = await fetch("/api/cycles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        start_date: new Date(fd.get("start_date") as string).toISOString(),
        end_date: new Date(fd.get("end_date") as string).toISOString(),
      }),
    });

    setLoading(false);
    if (res.ok) {
      const cycle = await res.json();
      router.push(`/admin/cycles/${cycle.id}`);
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to create cycle");
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
    <form
      onSubmit={handleSubmit}
      className="rounded-md border border-whisper bg-white/[0.02] p-4"
    >
      <h2 className="mb-3 text-sm font-semibold tracking-tight text-white">
        New cycle
      </h2>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-cloud/80" htmlFor="cycle-name">
            Name
          </label>
          <input
            id="cycle-name"
            name="name"
            required
            placeholder="e.g. Spring 2026"
            className="rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-sm text-white placeholder:text-cloud/40 transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-cloud/80" htmlFor="cycle-start">
            Start date
          </label>
          <input
            id="cycle-start"
            name="start_date"
            type="date"
            required
            className="rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-sm text-white transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-cloud/80" htmlFor="cycle-end">
            End date
          </label>
          <input
            id="cycle-end"
            name="end_date"
            type="date"
            required
            className="rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-sm text-white transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-teal px-4 py-1.5 text-sm font-semibold tracking-tight text-white shadow-[0_1px_4px_rgba(0,148,160,0.2)] transition-all duration-150 ease-spring hover:bg-teal/80 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
        >
          {loading ? "Creating…" : "Create"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="text-sm text-cloud/60 transition-colors duration-150 hover:text-cloud focus-visible:outline-none focus-visible:text-cloud"
        >
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-300">
          {error}
        </p>
      )}
    </form>
  );
}
