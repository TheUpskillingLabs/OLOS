"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { shortRegistrationSchema } from "@/lib/validations/short-registration";
import { FormField, Input } from "@/app/components/ui/form";

type FormData = z.infer<typeof shortRegistrationSchema>;

export default function ShortForm({
  email,
  authUserId,
}: {
  email: string;
  authUserId: string;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(shortRegistrationSchema),
    defaultValues: {
      auth_user_id: authUserId,
      google_id: email,
      email,
      first_name: "",
      last_name: "",
    },
  });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = form;

  async function onSubmit(data: FormData) {
    setServerError("");
    const res = await fetch("/api/registrations/short", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const json = await res.json();

    if (res.ok) {
      if (json.already_registered) {
        setAlreadyRegistered(true);
      } else {
        router.push("/dashboard");
      }
    } else {
      setServerError(json.error || "Registration failed");
    }
  }

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
      {serverError && (
        <div className="mb-4 rounded-md border border-red/20 bg-red/10 p-3 text-sm text-red-300">
          {serverError}
        </div>
      )}

      <FormProvider {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField name="first_name" label="First Name" required>
              <Input {...register("first_name")} invalid={!!errors.first_name} />
            </FormField>
            <FormField name="last_name" label="Last Name" required>
              <Input {...register("last_name")} invalid={!!errors.last_name} />
            </FormField>
          </div>

          <div>
            <label className="block text-sm font-medium text-cloud">Email</label>
            <input
              value={email}
              readOnly
              className="mt-1 block w-full rounded-md border border-white/[0.05] bg-white/[0.03] px-3 py-2 text-sm text-cloud/60"
            />
          </div>

          <div className="space-y-1.5">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                {...register("contact_consent")}
                className="mt-0.5 h-4 w-4 rounded border-white/[0.20] bg-white/[0.04] accent-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
              />
              <span className="text-sm text-cloud">
                I consent to The Upskilling Labs contacting me about cycles,
                events, and opportunities. *
              </span>
            </label>
            {errors.contact_consent && (
              <p className="text-xs text-red-300">
                {errors.contact_consent.message as string}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-teal px-6 py-3 text-base font-semibold tracking-tight text-white shadow-[0_1px_4px_rgba(0,148,160,0.2)] transition-all duration-150 ease-spring hover:bg-teal/80 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Submitting..." : "Become an Upskiller"}
          </button>
        </form>
      </FormProvider>
    </>
  );
}
