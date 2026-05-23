"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cycleInterestSchema } from "@/lib/validations/cycle-interest";
import { FormField, Input, Select } from "@/app/components/ui/form";

const formSchema = cycleInterestSchema.extend({
  commitment_confirmed: z.literal(true, {
    error: "Confirm you understand the commitment",
  }),
});

type FormData = z.infer<typeof formSchema>;

interface Defaults {
  state: string | null;
  work_situation: string | null;
  main_focus: string | null;
  sector: string | null;
  linkedin: string | null;
}

export default function CycleInterestForm({
  cycleId,
  defaults,
  selectedOptions,
}: {
  cycleId: number;
  defaults: Defaults;
  selectedOptions: Record<string, number[]>;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      state: defaults.state ?? "",
      work_situation: defaults.work_situation ?? "",
      main_focus: defaults.main_focus ?? "",
      sector: defaults.sector ?? "",
      linkedin: defaults.linkedin ?? "",
      availability_commitment: "confirmed",
      availability: selectedOptions.availability ?? [],
      group_strengths: selectedOptions.group_strengths ?? [],
    },
  });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = form;

  async function onSubmit(data: FormData) {
    setServerError("");
    setSuccess(false);

    const { commitment_confirmed: _, ...rest } = data;
    const body = {
      ...rest,
      sector: rest.sector || null,
      linkedin: rest.linkedin || null,
    };

    const res = await fetch(`/api/cycles/${cycleId}/interest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setSuccess(true);
      router.push(`/cycles/${cycleId}/register-pods`);
    } else {
      const json = await res.json();
      console.error("Interest form error:", res.status, json);
      setServerError(json.error || "Submission failed");
    }
  }

  const checkboxClass =
    "h-4 w-4 rounded border-white/[0.20] bg-white/[0.04] accent-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight";

  const sectionHeadingClass =
    "text-sm font-medium uppercase tracking-widest text-cloud/50";

  return (
    <>
      {serverError && (
        <div className="mb-6 rounded-md border border-red/20 bg-red/10 p-3 text-sm text-red-300">
          {serverError}
        </div>
      )}

      {success && (
        <div className="mb-6 rounded-md border border-teal/20 bg-teal/10 p-3 text-sm text-aqua">
          Interest submitted! Redirecting to your dashboard...
        </div>
      )}

      <FormProvider {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-0">
          <div className="space-y-4 pb-6">
            <h3 className={sectionHeadingClass}>Location</h3>
            <FormField name="state" label="State" required>
              <Select {...register("state")} invalid={!!errors.state}>
                <option value="">Select...</option>
                <option value="MD">Maryland</option>
                <option value="DC">DC</option>
                <option value="VA">Virginia</option>
                <option value="Other">Other</option>
              </Select>
            </FormField>
          </div>

          <div className="border-t border-white/[0.06]" />

          <div className="space-y-4 py-6">
            <FormField name="work_situation" label="Work Situation" required>
              <Select {...register("work_situation")} invalid={!!errors.work_situation}>
                <option value="">Select...</option>
                <option value="employed full time">Employed full time</option>
                <option value="employed part-time">Employed part-time</option>
                <option value="self-employed">Self-employed</option>
                <option value="unemployed and jobseeking">Unemployed and jobseeking</option>
                <option value="in a career transition">In a career transition</option>
                <option value="student">Student</option>
                <option value="prefer not to say">Prefer not to say</option>
              </Select>
            </FormField>
            <FormField name="main_focus" label="Main Focus" required>
              <Select {...register("main_focus")} invalid={!!errors.main_focus}>
                <option value="">Select...</option>
                <option value="finding a new role">Finding a new role</option>
                <option value="building a portfolio">Building a portfolio</option>
                <option value="upskilling in current field">Upskilling in current field</option>
                <option value="exploring new directions">Exploring new directions</option>
                <option value="starting something new">Starting something new</option>
                <option value="other">Other</option>
                <option value="n/a">N/A</option>
              </Select>
            </FormField>
            <FormField name="sector" label="Sector">
              <Input
                {...register("sector")}
                placeholder="e.g. Education, Healthcare, Tech"
                invalid={!!errors.sector}
              />
            </FormField>
            <FormField name="linkedin" label="LinkedIn URL">
              <Input
                {...register("linkedin")}
                placeholder="https://linkedin.com/in/..."
                invalid={!!errors.linkedin}
              />
            </FormField>
          </div>

          <div className="border-t border-white/[0.06]" />

          <div className="space-y-4 pt-6">
            <h3 className={sectionHeadingClass}>Commitment</h3>
            <div className="rounded-md border border-yellow-500/20 bg-yellow-500/[0.04] p-4">
              <p className="text-sm leading-relaxed text-cloud/80">
                Participation in a cycle requires attending a weekly group
                meeting, engaging regularly with your teammates on Slack, and
                dedicating 1 to 2 hours per week to independent work. Please join
                only if you are prepared to make this commitment.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="flex items-start gap-3 cursor-pointer rounded-md border border-white/[0.06] bg-white/[0.02] p-4 transition-colors duration-150 hover:border-white/[0.10] hover:bg-white/[0.03]">
                <input
                  type="checkbox"
                  {...register("commitment_confirmed")}
                  className={checkboxClass + " mt-0.5"}
                />
                <span className="text-sm leading-relaxed text-cloud">
                  I understand the time commitment and am ready to actively
                  participate in group meetings, Slack collaboration, and
                  independent work each week.
                </span>
              </label>
              {errors.commitment_confirmed && (
                <p className="text-xs text-red-300">
                  {errors.commitment_confirmed.message as string}
                </p>
              )}
            </div>
          </div>

          <div className="pt-8">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-md bg-teal px-6 py-3 text-base font-semibold tracking-tight text-white shadow-[0_1px_4px_rgba(0,148,160,0.2)] transition-all duration-150 ease-spring hover:bg-teal/80 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Submitting..." : "Submit"}
            </button>
          </div>
        </form>
      </FormProvider>
    </>
  );
}
