"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormField, Input, Textarea, Select } from "@/app/components/ui/form";
import { HANDLE_RE } from "@/lib/participants/handle";

// Everything but the names is optional at the form layer: Mode B (forced
// name completion) submits names only, while Mode A submits the whole profile.
// The server schema (participants-update.ts) re-validates strictly; here we
// only guard formats the user can get wrong.
const PLACEHOLDER = /^unknown$/i;
const nameField = z
  .string()
  .min(1, "Required")
  .max(100, "Too long")
  .refine((s) => !PLACEHOLDER.test(s.trim()), { message: "Cannot be 'Unknown'" });
const opt = z.string().optional().or(z.literal(""));

const formSchema = z.object({
  first_name: nameField,
  last_name: nameField,
  preferred_name: z.string().max(100).optional().or(z.literal("")),
  headline: z.string().max(200).optional().or(z.literal("")),
  bio: z.string().max(2000).optional().or(z.literal("")),
  handle: z
    .string()
    .max(50)
    .refine((s) => !s || HANDLE_RE.test(s), {
      message: "Use lowercase letters, numbers, and dashes",
    })
    .optional()
    .or(z.literal("")),
  state: opt,
  neighborhood: z.string().max(255).optional().or(z.literal("")),
  dcpl_card: opt,
  zip: z
    .string()
    .refine((s) => !s || /^\d{5}$/.test(s), { message: "Enter a 5-digit ZIP" })
    .optional()
    .or(z.literal("")),
  work_situation: opt,
  main_focus: opt,
  sector: z.string().max(255).optional().or(z.literal("")),
  current_title: z.string().max(255).optional().or(z.literal("")),
  linkedin: z.string().max(500).optional().or(z.literal("")),
  primary_expertise: z.string().max(500).optional().or(z.literal("")),
  ai_tool_familiarity: z.string().optional().or(z.literal("")),
});

type FormData = z.infer<typeof formSchema>;

// Enum choices (values must match the DB CHECK constraints exactly).
const STATES = ["MD", "DC", "VA", "Other"];
const DCPL: [string, string][] = [
  ["yes", "Yes"],
  ["no", "No"],
  ["not sure", "Not sure"],
];
const WORK = [
  "employed full time",
  "employed part-time",
  "self-employed",
  "unemployed and jobseeking",
  "in a career transition",
  "student",
  "prefer not to say",
];
const FOCUS = [
  "finding a new role",
  "building a portfolio",
  "upskilling in current field",
  "exploring new directions",
  "starting something new",
  "other",
  "n/a",
];
const ROLE_INTENTS: [string, string][] = [
  ["cycle", "Builder"],
  ["mentor", "Mentor"],
  ["volunteer", "Volunteer"],
  ["events", "Community"],
];
const OPTION_SECTIONS: {
  list: string;
  label: string;
  scroll?: boolean;
  /** Single-select: picking a chip replaces the current choice. */
  single?: boolean;
}[] = [
  { list: "labs_goals", label: "Your goals" },
  { list: "availability", label: "Availability", single: true },
  { list: "work_style", label: "How you like to work" },
  { list: "group_strengths", label: "Your strengths" },
  { list: "ai_tools", label: "AI tools you use", scroll: true },
];

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// Downscale to <=512px and re-encode JPEG so uploads are "reasonably sized"
// without any server image processing.
function resizeImage(file: File, max = 512): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > max || height > max) {
        const scale = Math.min(max / width, max / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no canvas context"));
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("encode failed"))),
        "image/jpeg",
        0.85
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("could not load image"));
    };
    img.src = url;
  });
}

interface Props {
  participantId: number;
  initial: {
    first_name: string;
    last_name: string;
    preferred_name: string;
    headline: string;
    bio: string;
    handle: string;
    state: string;
    neighborhood: string;
    dcpl_card: string;
    zip: string;
    work_situation: string;
    main_focus: string;
    sector: string;
    current_title: string;
    linkedin: string;
    primary_expertise: string;
    ai_tool_familiarity: string;
    role_intents: string[];
    avatarUrl: string | null;
    initials: string;
  };
  optionLists: Record<string, { id: number; value: string }[]>;
  selectedOptions: Record<string, number[]>;
  required: boolean;
  nextPath: string;
  placeholder: boolean;
}

export default function ProfileEditForm({
  participantId,
  initial,
  optionLists,
  selectedOptions,
  required,
  nextPath,
  placeholder,
}: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [saved, setSaved] = useState(false);

  const [roleIntents, setRoleIntents] = useState<string[]>(
    initial.role_intents ?? []
  );
  const [options, setOptions] = useState<Record<string, number[]>>(
    () => ({ ...selectedOptions })
  );

  // Avatar (uploaded immediately, separate from the form submit).
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initial.avatarUrl);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: initial,
    mode: placeholder ? "onChange" : "onSubmit",
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  const toggleRole = (v: string) =>
    setRoleIntents((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
  const toggleOption = (list: string, id: number) =>
    setOptions((p) => {
      const cur = p[list] ?? [];
      const single = OPTION_SECTIONS.find((s) => s.list === list)?.single;
      if (single) {
        // Single-select list: picking a chip replaces the choice; picking the
        // active chip clears it.
        return { ...p, [list]: cur.includes(id) ? [] : [id] };
      }
      return {
        ...p,
        [list]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
      };
    });

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setAvatarError("");
    setAvatarBusy(true);
    try {
      const blob = await resizeImage(file);
      const fd = new FormData();
      fd.append("file", blob, "avatar.jpg");
      const res = await fetch(`/api/participants/${participantId}/avatar`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAvatarError(data?.error || "Upload failed. Try again.");
        return;
      }
      setAvatarUrl(data.profile_image_url);
      router.refresh();
    } catch {
      setAvatarError("Could not process that image.");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    setAvatarError("");
    setAvatarBusy(true);
    try {
      const res = await fetch(`/api/participants/${participantId}/avatar`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAvatarError(data?.error || "Could not remove the photo.");
        return;
      }
      setAvatarUrl(null);
      router.refresh();
    } finally {
      setAvatarBusy(false);
    }
  }

  async function onSubmit(values: FormData) {
    setServerError("");

    const body: Record<string, unknown> = {
      first_name: values.first_name.trim(),
      last_name: values.last_name.trim(),
      preferred_name: values.preferred_name?.trim() || null,
    };

    if (!required) {
      body.headline = values.headline?.trim() || null;
      body.bio = values.bio?.trim() || null;
      const handle = values.handle?.trim();
      if (handle) body.handle = handle;

      // NOT NULL columns — omit if somehow empty so we never violate the
      // constraint (selects are pre-filled, so normally always present).
      if (values.state) body.state = values.state;
      if (values.neighborhood?.trim()) body.neighborhood = values.neighborhood.trim();
      if (values.dcpl_card) body.dcpl_card = values.dcpl_card;
      if (values.zip?.trim()) body.zip = values.zip.trim();
      if (values.work_situation) body.work_situation = values.work_situation;
      if (values.main_focus) body.main_focus = values.main_focus;
      if (values.ai_tool_familiarity) {
        body.ai_tool_familiarity = Number(values.ai_tool_familiarity);
      }

      // Nullable columns — empty clears them.
      body.sector = values.sector?.trim() || null;
      body.current_title = values.current_title?.trim() || null;
      body.linkedin = values.linkedin?.trim() || null;
      body.primary_expertise = values.primary_expertise?.trim() || null;

      body.role_intents = roleIntents;
      body.options = options;
    }

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
      router.push(nextPath);
      router.refresh();
    } else {
      setSaved(true);
      router.refresh();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-5">
        {/* Saving scrolls to the top — the confirmation has to be waiting
            where the scroll lands, not only down by the submit bar
            (July 2026 feedback). */}
        {saved && !required && (
          <p className="rounded-card border border-teal/30 bg-teal/10 px-3 py-2 text-sm text-teal-deep">
            Saved.{" "}
            <Link href="/profile" className="underline">
              Back to profile
            </Link>
          </p>
        )}
        <FormField name="first_name" label="First name" required htmlFor="first_name">
          <Input id="first_name" type="text" autoComplete="given-name" invalid={!!errors.first_name} {...register("first_name")} />
        </FormField>

        <FormField name="last_name" label="Last name" required htmlFor="last_name">
          <Input id="last_name" type="text" autoComplete="family-name" invalid={!!errors.last_name} {...register("last_name")} />
        </FormField>

        <FormField
          name="preferred_name"
          label="Preferred name"
          helper="What you'd like to be called, if different from your first name."
          htmlFor="preferred_name"
        >
          <Input id="preferred_name" type="text" autoComplete="nickname" invalid={!!errors.preferred_name} {...register("preferred_name")} />
        </FormField>

        {!required && (
          <>
            {/* ── Photo ── */}
            <Section title="Profile photo">
              <div className="flex items-center gap-4">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt=""
                    className="h-20 w-20 rounded-full object-cover ring-1 ring-ink/10"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-teal-deep text-xl font-bold text-white">
                    {initial.initials || "•"}
                  </div>
                )}
                <div>
                  <input
                    ref={fileRef}
                    id="avatar-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={onPickAvatar}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={avatarBusy}
                      className="btn btn-ghost px-3 py-1.5 text-sm"
                    >
                      {avatarBusy ? "Uploading…" : avatarUrl ? "Change photo" : "Upload photo"}
                    </button>
                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={removeAvatar}
                        disabled={avatarBusy}
                        className="text-sm text-slate underline-offset-2 hover:text-red hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-meta">
                    JPEG, PNG, or WebP. We&apos;ll resize it for you.
                  </p>
                  {avatarError && (
                    <p className="mt-1 text-xs text-red">{avatarError}</p>
                  )}
                </div>
              </div>
            </Section>

            {/* ── Directory profile ── */}
            <Section title="Directory profile">
              <FormField
                name="headline"
                label="Headline"
                helper="One line under your name (e.g. “Frontend dev learning AI in practice”)."
                htmlFor="headline"
              >
                <Input id="headline" type="text" maxLength={200} invalid={!!errors.headline} {...register("headline")} />
              </FormField>
              <FormField name="bio" label="About" helper="A short intro shown on your profile." htmlFor="bio">
                <Textarea id="bio" rows={4} maxLength={2000} invalid={!!errors.bio} {...register("bio")} />
              </FormField>
              <FormField name="primary_expertise" label="Primary expertise" htmlFor="primary_expertise">
                <Input id="primary_expertise" type="text" maxLength={500} invalid={!!errors.primary_expertise} {...register("primary_expertise")} />
              </FormField>
              <FormField
                name="handle"
                label="Profile URL"
                helper="Your directory address: /u/your-handle."
                htmlFor="handle"
              >
                <Input id="handle" type="text" inputMode="url" autoCapitalize="none" spellCheck={false} maxLength={50} invalid={!!errors.handle} {...register("handle")} />
              </FormField>

              <div>
                <p className="lbl mb-2">What you&apos;re here for</p>
                <ChipRow>
                  {ROLE_INTENTS.map(([v, label]) => (
                    <Chip key={v} on={roleIntents.includes(v)} onClick={() => toggleRole(v)}>
                      {label}
                    </Chip>
                  ))}
                </ChipRow>
              </div>
            </Section>

            {/* ── Location ── */}
            <Section title="Location">
              <FormField name="state" label="State" htmlFor="state">
                <Select id="state" invalid={!!errors.state} {...register("state")}>
                  {STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </Select>
              </FormField>
              <FormField name="neighborhood" label="Neighborhood" htmlFor="neighborhood">
                <Input id="neighborhood" type="text" maxLength={255} invalid={!!errors.neighborhood} {...register("neighborhood")} />
              </FormField>
              <FormField name="zip" label="ZIP code" helper="Sets your local lab." htmlFor="zip">
                <Input id="zip" type="text" inputMode="numeric" maxLength={5} invalid={!!errors.zip} {...register("zip")} />
              </FormField>
              <FormField name="dcpl_card" label="DC Public Library card" htmlFor="dcpl_card">
                <Select id="dcpl_card" invalid={!!errors.dcpl_card} {...register("dcpl_card")}>
                  <option value="">—</option>
                  {DCPL.map(([v, label]) => (
                    <option key={v} value={v}>{label}</option>
                  ))}
                </Select>
              </FormField>
            </Section>

            {/* ── Professional ── */}
            <Section title="Professional context">
              <FormField name="current_title" label="Current title" htmlFor="current_title">
                <Input id="current_title" type="text" maxLength={255} invalid={!!errors.current_title} {...register("current_title")} />
              </FormField>
              <FormField name="work_situation" label="Work situation" htmlFor="work_situation">
                <Select id="work_situation" invalid={!!errors.work_situation} {...register("work_situation")}>
                  <option value="">—</option>
                  {WORK.map((v) => (
                    <option key={v} value={v}>{cap(v)}</option>
                  ))}
                </Select>
              </FormField>
              <FormField name="main_focus" label="Main focus" htmlFor="main_focus">
                <Select id="main_focus" invalid={!!errors.main_focus} {...register("main_focus")}>
                  <option value="">—</option>
                  {FOCUS.map((v) => (
                    <option key={v} value={v}>{cap(v)}</option>
                  ))}
                </Select>
              </FormField>
              <FormField name="sector" label="Sector" htmlFor="sector">
                <Input id="sector" type="text" maxLength={255} invalid={!!errors.sector} {...register("sector")} />
              </FormField>
              <FormField name="linkedin" label="LinkedIn" htmlFor="linkedin">
                <Input id="linkedin" type="url" inputMode="url" maxLength={500} placeholder="https://linkedin.com/in/…" invalid={!!errors.linkedin} {...register("linkedin")} />
              </FormField>
            </Section>

            {/* ── AI + Labs fit multiselects ── */}
            <Section title="AI background">
              <FormField name="ai_tool_familiarity" label="How familiar are you with AI tools?" htmlFor="ai_tool_familiarity">
                <Select id="ai_tool_familiarity" invalid={!!errors.ai_tool_familiarity} {...register("ai_tool_familiarity")}>
                  <option value="">—</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n} / 5</option>
                  ))}
                </Select>
              </FormField>
            </Section>

            <Section title="Labs fit">
              {OPTION_SECTIONS.map(({ list, label, scroll }) => {
                const choices = optionLists[list] ?? [];
                if (choices.length === 0) return null;
                return (
                  <div key={list}>
                    <p className="lbl mb-2">{label}</p>
                    <div className={scroll ? "max-h-48 overflow-y-auto rounded-card border border-ink/10 p-2" : ""}>
                      <ChipRow>
                        {choices.map((c) => (
                          <Chip
                            key={c.id}
                            on={(options[list] ?? []).includes(c.id)}
                            onClick={() => toggleOption(list, c.id)}
                          >
                            {c.value}
                          </Chip>
                        ))}
                      </ChipRow>
                    </div>
                  </div>
                );
              })}
            </Section>
          </>
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
            <Link href="/profile" className="text-sm text-slate underline-offset-2 hover:text-ink hover:underline">
              Cancel
            </Link>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-teal ml-auto px-4 py-2 text-sm"
          >
            {isSubmitting ? "Saving…" : required ? "Save and continue" : "Save changes"}
          </button>
        </div>
      </form>
    </FormProvider>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-5 border-t border-ink/10 pt-5">
      <p className="lbl">{title}</p>
      {children}
    </div>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" className={`chip${on ? " active" : ""}`} aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  );
}
