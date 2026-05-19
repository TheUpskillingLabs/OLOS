"use client";

import { useState } from "react";

export type InitialProposal = {
  id: number;
  pod_id: number;
  name: string | null;
  summary: string | null;
  proposal_data: Record<string, string> | null;
  proposal_text: string | null;
};

type FormState = {
  name: string;
  summary: string;
  description: string;
  pod_problem_link: string;
  why_now: string;
  mvp_scope: string;
  skills_wanted: string;
};

const EMPTY_STATE: FormState = {
  name: "",
  summary: "",
  description: "",
  pod_problem_link: "",
  why_now: "",
  mvp_scope: "",
  skills_wanted: "",
};

function hydrateInitialState(initial: InitialProposal | null): FormState {
  if (!initial) return EMPTY_STATE;
  const data = initial.proposal_data ?? {};
  return {
    name: initial.name ?? "",
    summary: initial.summary ?? "",
    description: data.description ?? initial.proposal_text ?? "",
    pod_problem_link: data.pod_problem_link ?? "",
    why_now: data.why_now ?? "",
    mvp_scope: data.mvp_scope ?? "",
    skills_wanted: data.skills_wanted ?? "",
  };
}

export default function ProposalForm({
  pods,
  initialProposal,
  submissionOpen,
  closeAt,
}: {
  pods: { id: number; name: string | null }[];
  initialProposal: InitialProposal | null;
  submissionOpen: boolean;
  closeAt: string | null;
}) {
  const [selectedPodId, setSelectedPodId] = useState(
    initialProposal?.pod_id ?? pods[0]?.id ?? 0
  );
  const [form, setForm] = useState<FormState>(hydrateInitialState(initialProposal));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submittedAt, setSubmittedAt] = useState<number | null>(
    initialProposal ? Date.now() : null
  );
  const [editing, setEditing] = useState(!initialProposal);

  const hasSubmitted = submittedAt !== null && !editing;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!submissionOpen) {
      setError("Submission window has closed.");
      return;
    }
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch(`/api/pods/${selectedPodId}/solution-proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          summary: form.summary.trim(),
          description: form.description.trim(),
          pod_problem_link: form.pod_problem_link.trim() || undefined,
          why_now: form.why_now.trim() || undefined,
          mvp_scope: form.mvp_scope.trim() || undefined,
          skills_wanted: form.skills_wanted.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Failed to submit");
        return;
      }

      setSubmittedAt(Date.now());
      setEditing(false);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Submitted confirmation state — only path out is the Edit button (if open).
  if (hasSubmitted) {
    return (
      <div className="space-y-6">
        <div className="rounded-md border border-aqua/30 bg-aqua/[0.06] p-5">
          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-aqua/20"
              aria-hidden
            >
              <svg
                className="h-3.5 w-3.5 text-aqua"
                viewBox="0 0 20 20"
                fill="none"
              >
                <path
                  d="M5 10.5l3.5 3.5L15 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold tracking-tight text-white">
                Project submitted &nbsp;✓
              </p>
              <p className="mt-1 text-sm text-cloud/70">
                {form.name}
              </p>
              {submissionOpen && closeAt && (
                <p className="mt-2 text-xs text-cloud/60 tabular-nums">
                  You can edit until{" "}
                  {new Date(closeAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>
          </div>
        </div>

        {submissionOpen && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md border border-white/[0.12] bg-white/[0.04] px-4 py-2 text-sm font-semibold tracking-tight text-cloud transition-colors duration-150 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
          >
            Edit submission
          </button>
        )}
      </div>
    );
  }

  const disabled = !submissionOpen || submitting;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {pods.length > 1 && (
        <div className="space-y-1.5">
          <label
            htmlFor="select-pod"
            className="block text-sm font-medium text-cloud"
          >
            Pod
          </label>
          <div className="relative">
            <select
              id="select-pod"
              value={selectedPodId}
              onChange={(e) => setSelectedPodId(parseInt(e.target.value, 10))}
              disabled={disabled}
              className="block w-full appearance-none rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-2 pr-9 text-sm text-white transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal disabled:opacity-50"
            >
              {pods.map((pod) => (
                <option key={pod.id} value={pod.id}>
                  {pod.name || `Pod ${pod.id}`}
                </option>
              ))}
            </select>
            <svg
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cloud/60"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden
            >
              <path
                d="M6 8l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      )}

      <Field
        id="name"
        label="Project name"
        required
        maxLength={100}
        value={form.name}
        onChange={(v) => update("name", v)}
        disabled={disabled}
      />

      <Field
        id="summary"
        label="One-line summary"
        helper="Shown on voting cards — make it count."
        required
        maxLength={200}
        value={form.summary}
        onChange={(v) => update("summary", v)}
        disabled={disabled}
      />

      <Area
        id="description"
        label="Description"
        helper="The pitch."
        required
        maxLength={4000}
        rows={5}
        value={form.description}
        onChange={(v) => update("description", v)}
        disabled={disabled}
      />

      <Area
        id="pod_problem_link"
        label="How does this address your pod's problem?"
        maxLength={2000}
        rows={3}
        value={form.pod_problem_link}
        onChange={(v) => update("pod_problem_link", v)}
        disabled={disabled}
      />

      <Area
        id="why_now"
        label="Why does this matter now?"
        maxLength={2000}
        rows={3}
        value={form.why_now}
        onChange={(v) => update("why_now", v)}
        disabled={disabled}
      />

      <Area
        id="mvp_scope"
        label="What does an MVP look like in 6–10 weeks?"
        maxLength={2000}
        rows={3}
        value={form.mvp_scope}
        onChange={(v) => update("mvp_scope", v)}
        disabled={disabled}
      />

      <Area
        id="skills_wanted"
        label="Skills or collaborators you'd want on the team"
        maxLength={2000}
        rows={3}
        value={form.skills_wanted}
        onChange={(v) => update("skills_wanted", v)}
        disabled={disabled}
      />

      {error && (
        <p
          role="alert"
          className="rounded-md border border-red/20 bg-red/10 px-3 py-2 text-sm text-red-300"
        >
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={
            disabled ||
            !form.name.trim() ||
            !form.summary.trim() ||
            !form.description.trim()
          }
          className="rounded-md bg-teal px-4 py-2 text-sm font-semibold tracking-tight text-white shadow-[0_1px_4px_rgba(0,148,160,0.2)] transition-all duration-150 ease-spring hover:bg-teal/80 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
        >
          {submitting
            ? "Submitting..."
            : initialProposal
            ? "Save changes"
            : "Submit project"}
        </button>
        {initialProposal && editing && (
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setForm(hydrateInitialState(initialProposal));
            }}
            className="text-sm text-cloud/70 transition-colors duration-150 hover:text-cloud focus-visible:outline-none focus-visible:text-white"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  helper,
  required,
  maxLength,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  helper?: string;
  required?: boolean;
  maxLength: number;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-cloud">
        {label}
        {required && <span className="ml-1 text-aqua">*</span>}
      </label>
      {helper && <p className="text-xs text-cloud/60">{helper}</p>}
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        required={required}
        disabled={disabled}
        className="block w-full rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-cloud/40 transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal disabled:opacity-50"
      />
      <p className="text-right text-xs text-cloud/50 tabular-nums">
        {value.length}/{maxLength}
      </p>
    </div>
  );
}

function Area({
  id,
  label,
  helper,
  required,
  maxLength,
  rows,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  helper?: string;
  required?: boolean;
  maxLength: number;
  rows: number;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-cloud">
        {label}
        {required && <span className="ml-1 text-aqua">*</span>}
      </label>
      {helper && <p className="text-xs text-cloud/60">{helper}</p>}
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        required={required}
        disabled={disabled}
        rows={rows}
        className="block w-full resize-none rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-cloud/40 transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal disabled:opacity-50"
      />
      <p className="text-right text-xs text-cloud/50 tabular-nums">
        {value.length}/{maxLength}
      </p>
    </div>
  );
}
