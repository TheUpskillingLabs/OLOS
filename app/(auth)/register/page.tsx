"use client";

import { useState, useEffect } from "react";

interface OptionGroup {
  [key: string]: { id: number; value: string }[];
}

export default function RegisterPage() {
  const [options, setOptions] = useState<OptionGroup>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
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
      google_id: form.get("email"),
      email: form.get("email"),
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
      participation_commitment: form.get("participation_commitment") || undefined,
      primary_expertise: form.get("primary_expertise") || undefined,
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
      setSuccess(true);
    } else {
      const data = await res.json();
      setError(data.error || "Registration failed");
    }
    setSubmitting(false);
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="rounded-xl bg-white p-8 text-center shadow-lg dark:bg-zinc-900">
          <h1 className="text-2xl font-bold text-green-600">
            Registration Complete
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Thank you for registering for The Upskilling Labs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-8 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Register for The Upskilling Labs
      </h1>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Identity
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                First Name *
              </span>
              <input
                name="first_name"
                required
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Last Name *
              </span>
              <input
                name="last_name"
                required
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Email *
            </span>
            <input
              name="email"
              type="email"
              required
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Preferred Name
            </span>
            <input
              name="preferred_name"
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </label>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Location
          </legend>
          <label className="block">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              State *
            </span>
            <select
              name="state"
              required
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            >
              <option value="">Select...</option>
              <option value="MD">Maryland</option>
              <option value="DC">DC</option>
              <option value="VA">Virginia</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Neighborhood *
            </span>
            <input
              name="neighborhood"
              required
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </label>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            DCPL
          </legend>
          <label className="block">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Do you have a DCPL library card? *
            </span>
            <select
              name="dcpl_card"
              required
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            >
              <option value="">Select...</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="not sure">Not sure</option>
            </select>
          </label>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Professional Context
          </legend>
          <label className="block">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Work Situation *
            </span>
            <select
              name="work_situation"
              required
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
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
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Main Focus *
            </span>
            <select
              name="main_focus"
              required
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
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
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            AI Background
          </legend>
          <label className="block">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              AI Tool Familiarity (1-5) *
            </span>
            <input
              name="ai_tool_familiarity"
              type="number"
              min={1}
              max={5}
              required
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </label>
          {options.ai_tools && (
            <div>
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                AI Tools Used
              </span>
              <div className="mt-2 space-y-2">
                {options.ai_tools.map((opt) => (
                  <label key={opt.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="ai_tools"
                      value={opt.id}
                      className="rounded border-zinc-300"
                    />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                      {opt.value}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Consent
          </legend>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="text_updates"
              className="rounded border-zinc-300"
            />
            <span className="text-sm text-zinc-700 dark:text-zinc-300">
              I agree to receive text updates
            </span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="photo_video_consent"
              defaultChecked
              className="rounded border-zinc-300"
            />
            <span className="text-sm text-zinc-700 dark:text-zinc-300">
              I consent to photo/video usage
            </span>
          </label>
        </fieldset>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {submitting ? "Submitting..." : "Register"}
        </button>
      </form>
    </div>
  );
}
