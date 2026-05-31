"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, FormProvider, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { registrationSchema } from "@/lib/validations/participants";
import { FormField, Input, Select } from "@/app/components/ui/form";

type FormData = z.infer<typeof registrationSchema>;

interface OptionGroup {
  [key: string]: { id: number; value: string }[];
}

const checkboxClass =
  "h-4 w-4 rounded border-white/[0.20] bg-white/[0.04] accent-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight";

export default function RegisterForm({
  email,
  authUserId,
}: {
  email: string;
  authUserId: string;
  profileImageUrl: string | null;
}) {
  const router = useRouter();
  const [options, setOptions] = useState<OptionGroup>({});
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    fetch("/api/options")
      .then((r) => r.json())
      .then(setOptions);
  }, []);

  const form = useForm<FormData>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      auth_user_id: authUserId,
      google_id: email,
      email,
      first_name: "",
      last_name: "",
      preferred_name: "",
      gender: "",
      state: "",
      neighborhood: "",
      dcpl_card: "",
      work_situation: "",
      main_focus: "",
      sector: "",
      current_title: "",
      linkedin: "",
      ai_tool_familiarity: undefined,
      ai_tools: [],
      labs_goals: [],
      availability: [],
      work_style: [],
      group_strengths: [],
      participation_commitment: "",
      primary_expertise: "",
      volunteer_interest: "",
      text_updates: false,
      photo_video_consent: true,
    },
  });

  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = form;

  async function onSubmit(data: FormData) {
    setServerError("");

    const body = {
      ...data,
      preferred_name: data.preferred_name || undefined,
      gender: data.gender || undefined,
      sector: data.sector || undefined,
      current_title: data.current_title || undefined,
      linkedin: data.linkedin || undefined,
      participation_commitment: data.participation_commitment || undefined,
      primary_expertise: data.primary_expertise || undefined,
      volunteer_interest: data.volunteer_interest || undefined,
    };

    const res = await fetch("/api/registrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      router.push("/profile");
    } else {
      const json = await res.json();
      setServerError(json.error || "Registration failed");
    }
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
          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold tracking-tight text-white">
              Identity
            </legend>
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
            <FormField name="preferred_name" label="Preferred Name">
              <Input {...register("preferred_name")} invalid={!!errors.preferred_name} />
            </FormField>
            <FormField name="gender" label="Gender">
              <Input {...register("gender")} invalid={!!errors.gender} />
            </FormField>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold tracking-tight text-white">
              Location
            </legend>
            <FormField name="state" label="State" required>
              <Select {...register("state")} invalid={!!errors.state}>
                <option value="">Select...</option>
                <option value="MD">Maryland</option>
                <option value="DC">DC</option>
                <option value="VA">Virginia</option>
                <option value="Other">Other</option>
              </Select>
            </FormField>
            <FormField name="neighborhood" label="Neighborhood" required>
              <Input {...register("neighborhood")} invalid={!!errors.neighborhood} />
            </FormField>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold tracking-tight text-white">
              DCPL
            </legend>
            <FormField name="dcpl_card" label="Do you have a DCPL library card?" required>
              <Select {...register("dcpl_card")} invalid={!!errors.dcpl_card}>
                <option value="">Select...</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="not sure">Not sure</option>
              </Select>
            </FormField>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold tracking-tight text-white">
              Professional Context
            </legend>
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
              <Input {...register("sector")} invalid={!!errors.sector} />
            </FormField>
            <FormField name="current_title" label="Current Title">
              <Input {...register("current_title")} invalid={!!errors.current_title} />
            </FormField>
            <FormField name="linkedin" label="LinkedIn URL">
              <Input {...register("linkedin")} invalid={!!errors.linkedin} />
            </FormField>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold tracking-tight text-white">
              AI Background
            </legend>
            <FormField name="ai_tool_familiarity" label="AI Tool Familiarity (1-5)" required>
              <Input
                {...register("ai_tool_familiarity", { valueAsNumber: true })}
                type="number"
                min={1}
                max={5}
                invalid={!!errors.ai_tool_familiarity}
              />
            </FormField>
            {options.ai_tools && (
              <div>
                <span className="text-sm font-medium text-cloud">AI Tools Used</span>
                <Controller
                  name="ai_tools"
                  control={control}
                  render={({ field }) => (
                    <div className="mt-2 space-y-2">
                      {options.ai_tools.map((opt) => (
                        <label key={opt.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className={checkboxClass}
                            checked={(field.value ?? []).includes(opt.id)}
                            onChange={(e) => {
                              const vals: number[] = field.value ?? [];
                              field.onChange(
                                e.target.checked
                                  ? [...vals, opt.id]
                                  : vals.filter((v) => v !== opt.id)
                              );
                            }}
                          />
                          <span className="text-sm text-cloud">{opt.value}</span>
                        </label>
                      ))}
                    </div>
                  )}
                />
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
                <Controller
                  name="labs_goals"
                  control={control}
                  render={({ field }) => (
                    <div className="mt-2 space-y-2">
                      {options.labs_goals.map((opt) => (
                        <label key={opt.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className={checkboxClass}
                            checked={(field.value ?? []).includes(opt.id)}
                            onChange={(e) => {
                              const vals: number[] = field.value ?? [];
                              field.onChange(
                                e.target.checked
                                  ? [...vals, opt.id]
                                  : vals.filter((v) => v !== opt.id)
                              );
                            }}
                          />
                          <span className="text-sm text-cloud">{opt.value}</span>
                        </label>
                      ))}
                    </div>
                  )}
                />
              </div>
            )}
            {options.availability && (
              <div>
                <span className="text-sm font-medium text-cloud">Availability</span>
                <Controller
                  name="availability"
                  control={control}
                  render={({ field }) => (
                    <div className="mt-2 space-y-2">
                      {options.availability.map((opt) => (
                        <label key={opt.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className={checkboxClass}
                            checked={(field.value ?? []).includes(opt.id)}
                            onChange={(e) => {
                              const vals: number[] = field.value ?? [];
                              field.onChange(
                                e.target.checked
                                  ? [...vals, opt.id]
                                  : vals.filter((v) => v !== opt.id)
                              );
                            }}
                          />
                          <span className="text-sm text-cloud">{opt.value}</span>
                        </label>
                      ))}
                    </div>
                  )}
                />
              </div>
            )}
            {options.work_style && (
              <div>
                <span className="text-sm font-medium text-cloud">Work Style</span>
                <Controller
                  name="work_style"
                  control={control}
                  render={({ field }) => (
                    <div className="mt-2 space-y-2">
                      {options.work_style.map((opt) => (
                        <label key={opt.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className={checkboxClass}
                            checked={(field.value ?? []).includes(opt.id)}
                            onChange={(e) => {
                              const vals: number[] = field.value ?? [];
                              field.onChange(
                                e.target.checked
                                  ? [...vals, opt.id]
                                  : vals.filter((v) => v !== opt.id)
                              );
                            }}
                          />
                          <span className="text-sm text-cloud">{opt.value}</span>
                        </label>
                      ))}
                    </div>
                  )}
                />
              </div>
            )}
            {options.group_strengths && (
              <div>
                <span className="text-sm font-medium text-cloud">Group Strengths</span>
                <Controller
                  name="group_strengths"
                  control={control}
                  render={({ field }) => (
                    <div className="mt-2 space-y-2">
                      {options.group_strengths.map((opt) => (
                        <label key={opt.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className={checkboxClass}
                            checked={(field.value ?? []).includes(opt.id)}
                            onChange={(e) => {
                              const vals: number[] = field.value ?? [];
                              field.onChange(
                                e.target.checked
                                  ? [...vals, opt.id]
                                  : vals.filter((v) => v !== opt.id)
                              );
                            }}
                          />
                          <span className="text-sm text-cloud">{opt.value}</span>
                        </label>
                      ))}
                    </div>
                  )}
                />
              </div>
            )}
            <FormField name="participation_commitment" label="Participation Commitment">
              <Select {...register("participation_commitment")} invalid={!!errors.participation_commitment}>
                <option value="">Select...</option>
                <option value="yes">Yes</option>
                <option value="uncertain">Uncertain</option>
              </Select>
            </FormField>
            <FormField name="primary_expertise" label="Primary Expertise">
              <Input {...register("primary_expertise")} invalid={!!errors.primary_expertise} />
            </FormField>
            <FormField name="volunteer_interest" label="Volunteer Interest">
              <Input {...register("volunteer_interest")} invalid={!!errors.volunteer_interest} />
            </FormField>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold tracking-tight text-white">
              Consent
            </legend>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                {...register("text_updates")}
                className={checkboxClass}
              />
              <span className="text-sm text-cloud">I agree to receive text updates</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                {...register("photo_video_consent")}
                defaultChecked
                className={checkboxClass}
              />
              <span className="text-sm text-cloud">I consent to photo/video usage</span>
            </label>
          </fieldset>

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
