"use client";

import { useState } from "react";
import { fmtLabDateTime } from "@/lib/cycles/lab-time";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { solutionProposalSchema } from "@/lib/validations/pods";
import { FormField, Input, Textarea } from "@/app/components/ui/form";

type FormData = z.infer<typeof solutionProposalSchema>;

export type InitialProposal = {
  id: number;
  pod_id: number;
  name: string | null;
  summary: string | null;
  proposal_data: Record<string, string> | null;
  proposal_text: string | null;
};

function hydrateInitialValues(initial: InitialProposal | null): FormData {
  if (!initial) {
    return {
      name: "",
      summary: "",
      refined_problem_statement: "",
      project_hypothesis: "",
      target_users: "",
      the_value: "",
    };
  }
  const data = initial.proposal_data ?? {};
  return {
    name: initial.name ?? "",
    summary: initial.summary ?? "",
    refined_problem_statement: data.refined_problem_statement ?? "",
    project_hypothesis: data.project_hypothesis ?? "",
    target_users: data.target_users ?? "",
    the_value: data.the_value ?? "",
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
  const [submittedAt, setSubmittedAt] = useState<number | null>(
    initialProposal ? Date.now() : null
  );
  const [editing, setEditing] = useState(!initialProposal);
  const [submittedName, setSubmittedName] = useState(initialProposal?.name ?? "");
  const [serverError, setServerError] = useState("");

  const form = useForm<FormData>({
    resolver: zodResolver(solutionProposalSchema),
    defaultValues: hydrateInitialValues(initialProposal),
  });
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = form;

  const watched = watch();
  const fieldDisabled = !submissionOpen || isSubmitting;
  const hasSubmitted = submittedAt !== null && !editing;

  async function onSubmit(data: FormData) {
    if (!submissionOpen) {
      setServerError("Submission window has closed.");
      return;
    }
    setServerError("");

    try {
      const res = await fetch(`/api/pods/${selectedPodId}/solution-proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name.trim(),
          summary: data.summary.trim(),
          refined_problem_statement: data.refined_problem_statement.trim(),
          project_hypothesis: data.project_hypothesis.trim(),
          target_users: data.target_users.trim(),
          the_value: data.the_value.trim(),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setServerError(body.error || "Failed to submit");
        return;
      }

      setSubmittedName(data.name);
      setSubmittedAt(Date.now());
      setEditing(false);
    } catch {
      setServerError("Network error. Try again.");
    }
  }

  if (hasSubmitted) {
    return (
      <div className="space-y-6">
        <div className="rounded-card border border-teal/30 bg-teal/10 p-5">
          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-teal/20"
              aria-hidden
            >
              <svg className="h-3.5 w-3.5 text-teal-deep" viewBox="0 0 20 20" fill="none">
                <path d="M5 10.5l3.5 3.5L15 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold tracking-tight text-ink">Project submitted &nbsp;✓</p>
              <p className="mt-1 text-sm text-slate">{submittedName}</p>
              {submissionOpen && closeAt && (
                <p className="mt-2 text-xs text-meta tabular-nums">
                  You can edit until{" "}
                  {fmtLabDateTime(closeAt)}
                </p>
              )}
            </div>
          </div>
        </div>
        {submissionOpen && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="btn btn-ghost btn-sm"
          >
            Edit submission
          </button>
        )}
      </div>
    );
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" autoComplete="off">
        {pods.length > 1 && (
          <div className="space-y-1.5">
            <label htmlFor="select-pod" className="block text-sm font-medium text-charcoal">Pod</label>
            <div className="relative">
              <select
                id="select-pod"
                value={selectedPodId}
                onChange={(e) => setSelectedPodId(parseInt(e.target.value, 10))}
                disabled={fieldDisabled}
                className="block w-full appearance-none rounded-card border border-ink/10 bg-white px-3 py-2 pr-9 text-base text-ink transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal disabled:opacity-50"
              >
                {pods.map((pod) => (
                  <option key={pod.id} value={pod.id}>{pod.name || `Pod ${pod.id}`}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-meta" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        )}

        <FormField name="name" label="Project name" required charCount={`${(watched.name ?? "").length}/100`}>
          <Input {...register("name")} disabled={fieldDisabled} invalid={!!errors.name} />
        </FormField>

        <FormField name="summary" label="One-line summary" helper="Shown on voting cards — make it count." required charCount={`${(watched.summary ?? "").length}/200`}>
          <Input {...register("summary")} disabled={fieldDisabled} invalid={!!errors.summary} />
        </FormField>

        <FormField name="refined_problem_statement" label="Refined problem statement" helper="The status quo and current pain points." required charCount={`${(watched.refined_problem_statement ?? "").length}/1500`}>
          <Textarea {...register("refined_problem_statement")} rows={5} disabled={fieldDisabled} invalid={!!errors.refined_problem_statement} />
        </FormField>

        <FormField name="project_hypothesis" label="Project hypothesis" helper="Your proposed high-level concept statement." required charCount={`${(watched.project_hypothesis ?? "").length}/1500`}>
          <Textarea {...register("project_hypothesis")} rows={5} disabled={fieldDisabled} invalid={!!errors.project_hypothesis} />
        </FormField>

        <FormField name="target_users" label="Target users" helper="Common characteristics and needs of who you're solving for." required charCount={`${(watched.target_users ?? "").length}/1500`}>
          <Textarea {...register("target_users")} rows={5} disabled={fieldDisabled} invalid={!!errors.target_users} />
        </FormField>

        <FormField name="the_value" label="The value" helper="How your hypothetical solution makes things better." required charCount={`${(watched.the_value ?? "").length}/1500`}>
          <Textarea {...register("the_value")} rows={5} disabled={fieldDisabled} invalid={!!errors.the_value} />
        </FormField>

        {serverError && (
          <p role="alert" className="rounded-card border border-red/20 bg-red/10 px-3 py-2 text-sm text-red">
            {serverError}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={fieldDisabled}
            className="btn btn-teal btn-sm"
          >
            {isSubmitting ? "Submitting..." : initialProposal ? "Save changes" : "Submit project"}
          </button>
          {initialProposal && editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                reset(hydrateInitialValues(initialProposal));
              }}
              className="text-sm text-slate transition-colors duration-150 hover:text-ink focus-visible:underline"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </FormProvider>
  );
}
