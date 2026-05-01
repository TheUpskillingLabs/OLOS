"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface OptionGroup {
  [key: string]: { id: number; value: string }[];
}

export default function RegisterForm({
  email,
  authUserId,
  profileImageUrl,
}: {
  email: string;
  authUserId: string;
  profileImageUrl: string | null;
}) {
  const router = useRouter();
  const [options, setOptions] = useState<OptionGroup>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/options")
      .then((r) => r.json())
      .then(setOptions);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const selectedOptions: Record<string, number[]> = {};

    for (const key of [
      "ai_tools",
      "labs_goals",
      "availability",
      "work_style",
      "group_strengths",
    ]) {
      const values = form.getAll(key);
      selectedOptions[key] = values.map(Number);
    }

    const body = {
      auth_user_id: authUserId,
      google_id: email,
      email,
      first_name: form.get("first_name"),
      last_name: form.get("last_name"),
      preferred_name: form.get("preferred_name") || undefined,
      gender: form.get("gender") || undefined,
      state: form.get("state"),
      neighborhood: form.get("neighborhood"),
      dcpl_card: form.get("dcpl_card"),
      work_situation: form.get("work_situation"),
      main_focus: form.get("main_focus"),
      sector: form.get("sector") || undefined,
      current_title: form.get("current_title") || undefined,
      linkedin: form.get("linkedin") || undefined,
      ai_tool_familiarity: Number(form.get("ai_tool_familiarity")),
      participation_commitment:
        form.get("participation_commitment") || undefined,
      primary_expertise: form.get("primary_expertise") || undefined,
      volunteer_interest: form.get("volunteer_interest") || undefined,
      text_updates: form.get("text_updates") === "on",
      photo_video_consent: form.get("photo_video_consent") !== "off",
      source: form.get("source") || undefined,
      ...selectedOptions,
    };

    const res = await fetch("/api/registrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      router.push("/profile");
    } else {
      const data = await res.json();
      setError(data.error || "Registration failed");
    }
    setSubmitting(false);
  };

  return (
    <>
      {error && (
        <div className="mb-4 rounded-md border border-red/20 bg-red/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold tracking-tight text-white">
            Identity
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-cloud">
                First Name *
              </span>
              <input
                name="first_name"
                required
                className="mt-1 block w-full rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-cloud/40 transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-cloud">
                Last Name *
              </span>
              <input
                name="last_name"
                required
                className="mt-1 block w-full rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-cloud/40 transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-cloud">
              Email
            </span>
            <input
              value={email}
              readOnly
              className="mt-1 block w-full rounded-md border border-white/[0.05] bg-white/[0.03] px-3 py-2 text-sm text-cloud/60"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-cloud">
              Preferred Name
            </span>
            <input
              name="preferred_name"
              className="mt-1 block w-full rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-cloud/40 transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-cloud">
              Gender
            </span>
            <input
              name="gender"
              className="mt-1 block w-full rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-cloud/40 transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold tracking-tight text-white">
            Location
          </legend>
          <label className="block">
            <span className="text-sm font-medium text-cloud">
              State *
            </span>
            <select
              name="state"
              required
              className="mt-1 block w-full rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-2 text-sm text-white transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select...</option>
              <option value="MD">Maryland</option>
              <option value="DC">DC</option>
              <option value="VA">Virginia</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-cloud">
              Neighborhood *
            </span>
            <input
              name="neighborhood"
              required
              className="mt-1 block w-full rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-cloud/40 transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold tracking-tight text-white">
            DCPL
          </legend>
          <label className="block">
            <span className="text-sm font-medium text-cloud">
              Do you have a DCPL library card? *
            </span>
            <select
              name="dcpl_card"
              required
              className="mt-1 block w-full rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-2 text-sm text-white transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select...</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="not sure">Not sure</option>
            </select>
          </label>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold tracking-tight text-white">
            Professional Context
          </legend>
          <label className="block">
            <span className="text-sm font-medium text-cloud">
              Work Situation *
            </span>
            <select
              name="work_situation"
              required
              className="mt-1 block w-full rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-2 text-sm text-white transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal disabled:cursor-not-allowed disabled:opacity-50"
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
            <span className="text-sm font-medium text-cloud">
              Main Focus *
            </span>
            <select
              name="main_focus"
              required
              className="mt-1 block w-full rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-2 text-sm text-white transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal disabled:cursor-not-allowed disabled:opacity-50"
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
            <span className="text-sm font-medium text-cloud">
              Sector
            </span>
            <input
              name="sector"
              className="mt-1 block w-full rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-cloud/40 transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-cloud">
              Current Title
            </span>
            <input
              name="current_title"
              className="mt-1 block w-full rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-cloud/40 transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-cloud">
              LinkedIn URL
            </span>
            <input
              name="linkedin"
              type="url"
              className="mt-1 block w-full rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-cloud/40 transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold tracking-tight text-white">
            AI Background
          </legend>
          <label className="block">
            <span className="text-sm font-medium text-cloud">
              AI Tool Familiarity (1-5) *
            </span>
            <input
              name="ai_tool_familiarity"
              type="number"
              min={1}
              max={5}
              required
              className="mt-1 block w-full rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-cloud/40 transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>
          {options.ai_tools && (
            <div>
              <span className="text-sm font-medium text-cloud">
                AI Tools Used
              </span>
              <div className="mt-2 space-y-2">
                {options.ai_tools.map((opt) => (
                  <label key={opt.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="ai_tools"
                      value={opt.id}
                      className="h-4 w-4 rounded border-white/[0.20] bg-white/[0.04] accent-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
                    />
                    <span className="text-sm text-cloud">
                      {opt.value}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold tracking-tight text-white">
            Labs Fit
          </legend>
          {options.labs_goals && (
            <div>
              <span className="text-sm font-medium text-cloud">
                What are your goals for the Labs?
              </span>
              <div className="mt-2 space-y-2">
                {options.labs_goals.map((opt) => (
                  <label key={opt.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="labs_goals"
                      value={opt.id}
                      className="h-4 w-4 rounded border-white/[0.20] bg-white/[0.04] accent-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
                    />
                    <span className="text-sm text-cloud">
                      {opt.value}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {options.availability && (
            <div>
              <span className="text-sm font-medium text-cloud">
                Availability
              </span>
              <div className="mt-2 space-y-2">
                {options.availability.map((opt) => (
                  <label key={opt.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="availability"
                      value={opt.id}
                      className="h-4 w-4 rounded border-white/[0.20] bg-white/[0.04] accent-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
                    />
                    <span className="text-sm text-cloud">
                      {opt.value}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {options.work_style && (
            <div>
              <span className="text-sm font-medium text-cloud">
                Work Style
              </span>
              <div className="mt-2 space-y-2">
                {options.work_style.map((opt) => (
                  <label key={opt.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="work_style"
                      value={opt.id}
                      className="h-4 w-4 rounded border-white/[0.20] bg-white/[0.04] accent-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
                    />
                    <span className="text-sm text-cloud">
                      {opt.value}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {options.group_strengths && (
            <div>
              <span className="text-sm font-medium text-cloud">
                Group Strengths
              </span>
              <div className="mt-2 space-y-2">
                {options.group_strengths.map((opt) => (
                  <label key={opt.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="group_strengths"
                      value={opt.id}
                      className="h-4 w-4 rounded border-white/[0.20] bg-white/[0.04] accent-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
                    />
                    <span className="text-sm text-cloud">
                      {opt.value}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <label className="block">
            <span className="text-sm font-medium text-cloud">
              Participation Commitment
            </span>
            <select
              name="participation_commitment"
              className="mt-1 block w-full rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-2 text-sm text-white transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select...</option>
              <option value="yes">Yes</option>
              <option value="uncertain">Uncertain</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-cloud">
              Primary Expertise
            </span>
            <input
              name="primary_expertise"
              className="mt-1 block w-full rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-cloud/40 transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-cloud">
              Volunteer Interest
            </span>
            <input
              name="volunteer_interest"
              className="mt-1 block w-full rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-cloud/40 transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold tracking-tight text-white">
            Consent
          </legend>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="text_updates"
              className="h-4 w-4 rounded border-white/[0.20] bg-white/[0.04] accent-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
            />
            <span className="text-sm text-cloud">
              I agree to receive text updates
            </span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="photo_video_consent"
              defaultChecked
              className="h-4 w-4 rounded border-white/[0.20] bg-white/[0.04] accent-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
            />
            <span className="text-sm text-cloud">
              I consent to photo/video usage
            </span>
          </label>
        </fieldset>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-teal px-6 py-3 text-base font-semibold tracking-tight text-white shadow-[0_1px_4px_rgba(0,148,160,0.2)] transition-all duration-150 ease-spring hover:bg-teal/80 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Become an Upskiller"}
        </button>
      </form>
    </>
  );
}
