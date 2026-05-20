"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess(false);

    const form = new FormData(e.currentTarget);
    const multiSelect: Record<string, number[]> = {};

    for (const key of ["availability", "group_strengths"]) {
      const values = form.getAll(key);
      multiSelect[key] = values.map(Number);
    }

    const body = {
      state: form.get("state"),
      work_situation: form.get("work_situation"),
      main_focus: form.get("main_focus"),
      sector: form.get("sector") || null,
      linkedin: form.get("linkedin") || null,
      availability_commitment: "confirmed",
      ...multiSelect,
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
      const data = await res.json();
      console.error("Interest form error:", res.status, data);
      setError(data.error || "Submission failed");
    }
    setSubmitting(false);
  };

  const inputClass =
    "mt-1 block w-full rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-cloud/40 transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal disabled:cursor-not-allowed disabled:opacity-50";

  const checkboxClass =
    "h-4 w-4 rounded border-white/[0.20] bg-white/[0.04] accent-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight";

  const sectionHeadingClass =
    "text-sm font-medium uppercase tracking-widest text-cloud/50";

  return (
    <>
      {error && (
        <div className="mb-6 rounded-md border border-red/20 bg-red/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 rounded-md border border-teal/20 bg-teal/10 p-3 text-sm text-aqua">
          Interest submitted! Redirecting to your dashboard...
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-0">
        {/* Location */}
        <div className="space-y-4 pb-6">
          <h3 className={sectionHeadingClass}>Location</h3>
          <label className="block">
            <span className="text-sm font-medium text-cloud">State <span className="text-red-400">*</span></span>
            <select
              name="state"
              required
              defaultValue={defaults.state ?? ""}
              className={inputClass}
            >
              <option value="">Select...</option>
              <option value="MD">Maryland</option>
              <option value="DC">DC</option>
              <option value="VA">Virginia</option>
              <option value="Other">Other</option>
            </select>
          </label>
        </div>

        <div className="border-t border-white/[0.06]" />

        <div className="space-y-4 py-6">
          <label className="block">
            <span className="text-sm font-medium text-cloud">
              Work Situation <span className="text-red-400">*</span>
            </span>
            <select
              name="work_situation"
              required
              defaultValue={defaults.work_situation ?? ""}
              className={inputClass}
            >
              <option value="">Select...</option>
              <option value="employed full time">Employed full time</option>
              <option value="employed part-time">Employed part-time</option>
              <option value="self-employed">Self-employed</option>
              <option value="unemployed and jobseeking">
                Unemployed and jobseeking
              </option>
              <option value="in a career transition">
                In a career transition
              </option>
              <option value="student">Student</option>
              <option value="prefer not to say">Prefer not to say</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-cloud">Main Focus <span className="text-red-400">*</span></span>
            <select
              name="main_focus"
              required
              defaultValue={defaults.main_focus ?? ""}
              className={inputClass}
            >
              <option value="">Select...</option>
              <option value="finding a new role">Finding a new role</option>
              <option value="building a portfolio">Building a portfolio</option>
              <option value="upskilling in current field">
                Upskilling in current field
              </option>
              <option value="exploring new directions">
                Exploring new directions
              </option>
              <option value="starting something new">
                Starting something new
              </option>
              <option value="other">Other</option>
              <option value="n/a">N/A</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-cloud">Sector</span>
            <input
              name="sector"
              placeholder="e.g. Education, Healthcare, Tech"
              defaultValue={defaults.sector ?? ""}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-cloud">LinkedIn URL <span className="text-red-400">*</span></span>
            <input
              name="linkedin"
              type="text"
              required
              placeholder="https://linkedin.com/in/..."
              defaultValue={defaults.linkedin ?? ""}
              className={inputClass}
            />
          </label>
        </div>

        {selectedOptions.group_strengths !== undefined && (
          <>
            <div className="border-t border-white/[0.06]" />
            <div className="space-y-4 py-6">
              <h3 className={sectionHeadingClass}>Expertise</h3>
              <div className="mt-2 space-y-2" id="group_strengths_placeholder" />
            </div>
          </>
        )}

        <div className="border-t border-white/[0.06]" />

        {/* Commitment */}
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
          <label className="flex items-start gap-3 cursor-pointer rounded-md border border-white/[0.06] bg-white/[0.02] p-4 transition-colors duration-150 hover:border-white/[0.10] hover:bg-white/[0.03]">
            <input
              type="checkbox"
              name="commitment_confirmed"
              required
              className={checkboxClass + " mt-0.5"}
            />
            <span className="text-sm leading-relaxed text-cloud">
              I understand the time commitment and am ready to actively
              participate in group meetings, Slack collaboration, and
              independent work each week.
            </span>
          </label>
        </div>

        <div className="pt-8">
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-teal px-6 py-3 text-base font-semibold tracking-tight text-white shadow-[0_1px_4px_rgba(0,148,160,0.2)] transition-all duration-150 ease-spring hover:bg-teal/80 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      </form>
    </>
  );
}
