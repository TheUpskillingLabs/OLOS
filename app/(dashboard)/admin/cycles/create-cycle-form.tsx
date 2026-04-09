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
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        + New Cycle
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
    >
      <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        New Cycle
      </h2>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Name</label>
          <input
            name="name"
            required
            placeholder="e.g. Spring 2026"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Start date</label>
          <input
            name="start_date"
            type="date"
            required
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">End date</label>
          <input
            name="end_date"
            type="date"
            required
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {loading ? "Creating…" : "Create"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          Cancel
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </form>
  );
}
