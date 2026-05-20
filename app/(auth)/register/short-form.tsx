"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ShortForm({
  email,
  authUserId,
}: {
  email: string;
  authUserId: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const form = new FormData(e.currentTarget);

    const body = {
      auth_user_id: authUserId,
      google_id: email,
      email,
      first_name: form.get("first_name"),
      last_name: form.get("last_name"),
      contact_consent: form.get("contact_consent") === "on",
    };

    const res = await fetch("/api/registrations/short", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (res.ok) {
      if (data.already_registered) {
        setAlreadyRegistered(true);
      } else {
        router.push("/dashboard");
      }
    } else {
      setError(data.error || "Registration failed");
    }
    setSubmitting(false);
  };

  if (alreadyRegistered) {
    return (
      <div className="rounded-md border border-teal/20 bg-teal/[0.04] p-6 text-center">
        <h2 className="text-lg font-semibold text-white">
          You already have an account
        </h2>
        <p className="mt-2 text-sm text-cloud/60">
          We sent you an email with a link to sign in. Check your inbox.
        </p>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="mb-4 rounded-md border border-red/20 bg-red/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
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
          <span className="text-sm font-medium text-cloud">Email</span>
          <input
            value={email}
            readOnly
            className="mt-1 block w-full rounded-md border border-white/[0.05] bg-white/[0.03] px-3 py-2 text-sm text-cloud/60"
          />
        </label>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="contact_consent"
            required
            className="mt-0.5 h-4 w-4 rounded border-white/[0.20] bg-white/[0.04] accent-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
          />
          <span className="text-sm text-cloud">
            I consent to The Upskilling Labs contacting me about cycles,
            events, and opportunities. *
          </span>
        </label>

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
