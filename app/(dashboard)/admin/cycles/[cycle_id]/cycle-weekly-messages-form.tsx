"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";

/* Per-week "What's next" copy for a cycle (cycle_weekly_messages). Thirteen
   textareas — one per wk0→wk12 marker — saved together in one PUT; an empty
   box clears that week's row server-side. Mirrors CycleRegInfoForm's
   saved/serverError structure. */

const WEEK_LABELS = Array.from({ length: 13 }, (_, w) =>
  w === 0 ? "Week 0 (Kickoff)" : w === 12 ? "Week 12 (Showcase)" : `Week ${w}`
);

type WeeklyMessagesFormData = Record<string, string>;

const fieldName = (week: number) => `week_${week}`;

export default function CycleWeeklyMessagesForm({
  cycleId,
  messages,
}: {
  cycleId: number;
  messages: { week: number; message: string }[];
}) {
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const byWeek = new Map(messages.map((m) => [m.week, m.message]));

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<WeeklyMessagesFormData>({
    defaultValues: Object.fromEntries(
      WEEK_LABELS.map((_, w) => [fieldName(w), byWeek.get(w) ?? ""])
    ),
  });

  async function onSubmit(data: WeeklyMessagesFormData) {
    setSaved(false);
    setServerError(null);

    const res = await fetch(`/api/cycles/${cycleId}/weekly-messages`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: WEEK_LABELS.map((_, w) => ({
          week: w,
          message: data[fieldName(w)] ?? "",
        })),
      }),
    });

    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      const json = await res.json().catch(() => ({}));
      setServerError(json.error ?? "Failed to save weekly messages");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-4">
        {WEEK_LABELS.map((label, w) => (
          <div key={w}>
            <label
              htmlFor={fieldName(w)}
              className="mb-1 block text-sm text-meta"
            >
              {label}
            </label>
            <textarea
              id={fieldName(w)}
              rows={2}
              maxLength={4000}
              {...register(fieldName(w))}
              className="block w-full rounded-card border border-ink/10 bg-white px-3 py-2 text-base text-ink transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn btn-teal px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Saving…" : "Save Messages"}
        </button>
        {saved && (
          <span className="text-sm font-medium text-teal-deep">Saved.</span>
        )}
        {serverError && (
          <span role="alert" className="text-sm text-red">
            {serverError}
          </span>
        )}
      </div>
    </form>
  );
}
