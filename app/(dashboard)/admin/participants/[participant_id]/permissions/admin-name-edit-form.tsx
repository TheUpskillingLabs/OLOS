"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormField, Input } from "@/app/components/ui/form";

// Mirror of the participant-side schema in lib/validations/participants-update.ts
// and the form schema in profile/edit/profile-edit-form.tsx. Refusing
// 'Unknown' here means an admin cannot accidentally re-save the placeholder
// value when nudging a stranded participant.
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
}

export default function AdminNameEditForm({ participantId, initial }: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [saved, setSaved] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: initial,
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = form;

  async function onSubmit(values: FormData) {
    setServerError("");
    setSaved(false);

    const body: Record<string, string | null> = {
      first_name: values.first_name.trim(),
      last_name: values.last_name.trim(),
      preferred_name: values.preferred_name?.trim()
        ? values.preferred_name.trim()
        : null,
    };

    // Hits the same PATCH /api/participants/[id] endpoint that powers the
    // participant's own profile edit. The endpoint's authorization branch
    // is isSelf || isAdmin — admins pass via the second branch. RLS
    // migration 00021's WITH CHECK on participants_update_own enforces
    // the same predicate at the DB layer.
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

    setSaved(true);
    // refresh() re-runs the server component so the page header's
    // displayName updates with the new value on next render.
    router.refresh();
  }

  return (
    <section className="mt-8 rounded-lg border border-whisper bg-white/[0.02] p-6">
      <h2 className="text-base font-semibold text-white">Edit name</h2>
      <p className="mt-1 text-sm text-cloud/70">
        Updates first name, last name, and preferred name. Used to fix
        placeholder values (e.g. &quot;Unknown&quot; rows from data migration)
        without raw SQL.
      </p>

      <FormProvider {...form}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mt-5 grid gap-4 sm:grid-cols-3"
        >
          <FormField
            name="first_name"
            label="First name"
            required
            htmlFor="admin_first_name"
          >
            <Input
              id="admin_first_name"
              type="text"
              invalid={!!errors.first_name}
              {...register("first_name")}
            />
          </FormField>

          <FormField
            name="last_name"
            label="Last name"
            required
            htmlFor="admin_last_name"
          >
            <Input
              id="admin_last_name"
              type="text"
              invalid={!!errors.last_name}
              {...register("last_name")}
            />
          </FormField>

          <FormField
            name="preferred_name"
            label="Preferred name"
            htmlFor="admin_preferred_name"
          >
            <Input
              id="admin_preferred_name"
              type="text"
              invalid={!!errors.preferred_name}
              {...register("preferred_name")}
            />
          </FormField>

          <div className="sm:col-span-3 flex items-center justify-between gap-3">
            <div className="flex-1">
              {serverError && (
                <p className="rounded-md border border-red/30 bg-red/10 px-3 py-2 text-sm text-red-300">
                  {serverError}
                </p>
              )}
              {saved && !serverError && (
                <p className="text-sm text-aqua">Saved.</p>
              )}
            </div>
            <button
              type="submit"
              disabled={isSubmitting || !isDirty}
              className="inline-flex items-center justify-center rounded-md bg-teal px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-teal/80 focus:outline-none focus:ring-2 focus:ring-teal focus:ring-offset-2 focus:ring-offset-shadow-teal disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </FormProvider>
    </section>
  );
}
