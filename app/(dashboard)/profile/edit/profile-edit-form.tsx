"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormField, Input, Textarea } from "@/app/components/ui/form";
import { HANDLE_RE } from "@/lib/participants/handle";

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
  // Directory profile (Phase 2). Empty is allowed on the client — an empty
  // handle is omitted from the PATCH so the DB keeps the existing one; empty
  // bio/headline send null to clear. A non-empty handle must be url-safe;
  // uniqueness is enforced server-side (409 surfaced inline).
  headline: z.string().max(200, "Too long").optional().or(z.literal("")),
  bio: z.string().max(2000, "Too long").optional().or(z.literal("")),
  handle: z
    .string()
    .max(50, "Too long")
    .refine((s) => s === "" || HANDLE_RE.test(s), {
      message: "Use lowercase letters, numbers, and dashes",
    })
    .optional()
    .or(z.literal("")),
});

type FormData = z.infer<typeof formSchema>;

interface Props {
  participantId: number;
  initial: {
    first_name: string;
    last_name: string;
    preferred_name: string;
    headline: string;
    bio: string;
    handle: string;
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
      // bio/headline are nullable — empty clears them.
      headline: values.headline?.trim() ? values.headline.trim() : null,
      bio: values.bio?.trim() ? values.bio.trim() : null,
    };

    // handle is NOT NULL in the DB (auto-generated). Only send it when the
    // user typed one, so clearing the field keeps their existing handle
    // rather than failing the min-length check.
    const handle = values.handle?.trim();
    if (handle) body.handle = handle;

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

        {/* Directory profile — only on the voluntary edit path. Mode B (forced
            name completion) stays a single-purpose interstitial. */}
        {!required && (
          <div className="space-y-5 border-t border-ink/10 pt-5">
            <p className="lbl">Directory profile</p>

            <FormField
              name="headline"
              label="Headline"
              helper="One line under your name in the directory (e.g. “Frontend dev learning AI in practice”)."
              htmlFor="headline"
            >
              <Input
                id="headline"
                type="text"
                maxLength={200}
                invalid={!!errors.headline}
                {...register("headline")}
              />
            </FormField>

            <FormField
              name="bio"
              label="About"
              helper="A short intro shown on your profile. Optional."
              htmlFor="bio"
            >
              <Textarea
                id="bio"
                rows={4}
                maxLength={2000}
                invalid={!!errors.bio}
                {...register("bio")}
              />
            </FormField>

            <FormField
              name="handle"
              label="Profile URL"
              helper="Your directory address: /u/your-handle. Lowercase letters, numbers, and dashes."
              htmlFor="handle"
            >
              <Input
                id="handle"
                type="text"
                inputMode="url"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={50}
                invalid={!!errors.handle}
                {...register("handle")}
              />
            </FormField>
          </div>
        )}

        {serverError && (
          <p className="rounded-card border border-red/30 bg-red/10 px-3 py-2 text-sm text-red">
            {serverError}
          </p>
        )}

        {saved && !required && (
          <p className="rounded-card border border-teal/30 bg-teal/10 px-3 py-2 text-sm text-teal-deep">
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
              className="text-sm text-slate underline-offset-2 hover:text-ink hover:underline"
            >
              Cancel
            </Link>
          )}
          <button
            type="submit"
            disabled={isSubmitting || (!isDirty && !required)}
            className="btn btn-teal ml-auto px-4 py-2 text-sm"
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
