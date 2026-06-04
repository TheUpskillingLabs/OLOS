"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormField, Input } from "@/app/components/ui/form";

// Form-side schema: stricter than the API's partial-update schema because
// the form always submits all three whitelisted fields. The API accepts
// any subset; the form requires first/last name be present and valid.
// Mirrors the .refine() on the server schema so server + client reject
// the same inputs (defense in depth).
const PLACEHOLDER = /^unknown$/i;
const nameField = z
  .string()
  .min(1, "Required")
  .max(100, "Too long")
  .refine((s) => !PLACEHOLDER.test(s.trim()), {
    message: "Cannot be 'Unknown'",
  });

const formSchema = z.object({
  first_name: nameField,
  last_name: nameField,
  preferred_name: z.string().max(100).optional().or(z.literal("")),
});

type FormData = z.infer<typeof formSchema>;

interface Props {
  participantId: number;
  initial: {
    first_name: string;
    last_name: string;
    preferred_name: string;
  };
  required: boolean;
  nextPath: string;
  placeholder: boolean;
}

export default function ProfileEditForm({
  participantId,
  initial,
  required,
  nextPath,
  placeholder,
}: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [saved, setSaved] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: initial,
    // Show validation as the user types when their starting values are
    // placeholders (Mode B) — the 'Unknown' values are pre-filled but
    // need to be replaced. onChange validation surfaces the error band
    // immediately so the user understands what's expected.
    mode: placeholder ? "onChange" : "onSubmit",
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = form;

  async function onSubmit(values: FormData) {
    setServerError("");

    // Send only the whitelisted fields. preferred_name is nullable in the
    // DB: an empty string from the form is normalized to null so the
    // column stores a clean absence rather than an empty literal.
    const body: Record<string, string | null> = {
      first_name: values.first_name.trim(),
      last_name: values.last_name.trim(),
      preferred_name: values.preferred_name?.trim()
        ? values.preferred_name.trim()
        : null,
    };

    const res = await fetch(`/api/participants/${participantId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setServerError(
        typeof data?.error === "string"
          ? data.error
          : `Request failed (${res.status})`
      );
      return;
    }

    if (required) {
      // Mode B: bounce the user to where they were originally headed.
      // router.refresh() ensures the dashboard layout re-evaluates the
      // placeholder check so it doesn't redirect back to /profile/edit
      // on the very next request.
      router.push(nextPath);
      router.refresh();
    } else {
      // Mode A: voluntary edit — stay on the page and show success.
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-5">
        <FormField
          name="first_name"
          label="First name"
          required
          htmlFor="first_name"
        >
          <Input
            id="first_name"
            type="text"
            autoComplete="given-name"
            invalid={!!errors.first_name}
            {...register("first_name")}
          />
        </FormField>

        <FormField
          name="last_name"
          label="Last name"
          required
          htmlFor="last_name"
        >
          <Input
            id="last_name"
            type="text"
            autoComplete="family-name"
            invalid={!!errors.last_name}
            {...register("last_name")}
          />
        </FormField>

        <FormField
          name="preferred_name"
          label="Preferred name"
          helper="What you'd like to be called, if different from your first name."
          htmlFor="preferred_name"
        >
          <Input
            id="preferred_name"
            type="text"
            autoComplete="nickname"
            invalid={!!errors.preferred_name}
            {...register("preferred_name")}
          />
        </FormField>

        {serverError && (
          <p className="rounded-md border border-red/30 bg-red/10 px-3 py-2 text-sm text-red-300">
            {serverError}
          </p>
        )}

        {saved && !required && (
          <p className="rounded-md border border-aqua/30 bg-aqua/10 px-3 py-2 text-sm text-aqua">
            Saved.{" "}
            <Link href="/profile" className="underline">
              Back to profile
            </Link>
          </p>
        )}

        <div className="flex items-center justify-between gap-3 pt-2">
          {!required && (
            <Link
              href="/profile"
              className="text-sm text-cloud/70 underline-offset-2 hover:text-white hover:underline"
            >
              Cancel
            </Link>
          )}
          <button
            type="submit"
            disabled={isSubmitting || (!isDirty && !required)}
            className="ml-auto inline-flex items-center justify-center rounded-md bg-teal px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-teal/80 focus:outline-none focus:ring-2 focus:ring-teal focus:ring-offset-2 focus:ring-offset-shadow-teal disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting
              ? "Saving…"
              : required
              ? "Save and continue"
              : "Save changes"}
          </button>
        </div>
      </form>
    </FormProvider>
  );
}
