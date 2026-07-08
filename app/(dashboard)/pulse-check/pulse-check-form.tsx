"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { copy } from "./copy";

interface Option {
  id: number;
  value: string;
}

interface Props {
  enforcement: {
    last_completed_at: string | null;
    deadline: string;
    status: "ok" | "warning_3day" | "warning_1day" | "overdue";
    locked: boolean;
  };
  aiTools: Option[];
  pulseBenefits: Option[];
  cycle: { id: number; name: string } | null;
  pods: { id: number; name: string }[];
  projects: { id: number; name: string; pod_id: number }[];
}

const NEW_CONNECTION_CHOICES = copy.engagement.newConnections.choices;
type NewConnectionChoice = (typeof NEW_CONNECTION_CHOICES)[number];

const nominationSchema = z
  .object({
    nominee_name: z.string().max(255),
    nominee_email: z.string().max(255),
    nominee_linkedin: z.string().max(500),
    nomination_type: z.enum(["upskiller", "mentor", "advisor"]),
    reason: z.string().max(2000),
  })
  .superRefine((data, ctx) => {
    const hasName = data.nominee_name.trim();
    const hasReason = data.reason.trim();
    const hasAny =
      hasName ||
      hasReason ||
      data.nominee_email.trim() ||
      data.nominee_linkedin.trim();
    if (!hasAny) return;
    if (!hasName) {
      ctx.addIssue({
        code: "custom",
        message: copy.nominations.name.error.required,
        path: ["nominee_name"],
      });
    }
    if (!hasReason) {
      ctx.addIssue({
        code: "custom",
        message: copy.nominations.reason.error.required,
        path: ["reason"],
      });
    }
  });

const pulseCheckFormSchema = z.object({
  accomplishment: z
    .string()
    .min(1, copy.reflection.accomplishment.error.required)
    .max(2000, copy.reflection.accomplishment.error.tooLong),
  highlight: z.string().max(2000),
  challenge: z.string().max(2000),
  blockers: z.string().max(2000),
  tailwinds: z.string().max(2000),
  mitigation_strategy: z.string().max(2000),
  anything_else: z.string().max(2000),
  nominations: z.array(nominationSchema),
});

type FormData = z.infer<typeof pulseCheckFormSchema>;

const emptyNomination = () => ({
  nominee_name: "",
  nominee_email: "",
  nominee_linkedin: "",
  nomination_type: "upskiller" as const,
  reason: "",
});

const inputClass =
  "mt-1 block w-full rounded-card border border-ink/10 bg-white px-3 py-2 text-base text-ink transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal disabled:cursor-not-allowed disabled:opacity-50";

const textareaClass =
  "mt-1 block w-full resize-none rounded-card border border-ink/10 bg-white px-3 py-2 text-base text-ink placeholder:text-meta-soft transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal disabled:cursor-not-allowed disabled:opacity-50";

export default function PulseCheckForm({
  enforcement,
  aiTools,
  pulseBenefits,
  cycle,
  pods,
  projects,
}: Props) {
  const router = useRouter();
  const [energyLevel, setEnergyLevel] = useState<number | null>(null);
  const [selectedToolNames, setSelectedToolNames] = useState<string[]>([]);
  const [selectedBenefits, setSelectedBenefits] = useState<Set<number>>(new Set());
  const [selectedPodId, setSelectedPodId] = useState<number | null>(
    pods.length === 1 ? pods[0].id : null
  );
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [newConnections, setNewConnections] = useState<NewConnectionChoice | null>(null);
  const [showNominations, setShowNominations] = useState(false);
  const [serverError, setServerError] = useState("");
  const [confirmation, setConfirmation] = useState<{ nominationCount: number } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(pulseCheckFormSchema),
    defaultValues: {
      accomplishment: "",
      highlight: "",
      challenge: "",
      blockers: "",
      tailwinds: "",
      mitigation_strategy: "",
      anything_else: "",
      nominations: [emptyNomination()],
    },
  });

  const { fields: nominationFields, append, remove } = useFieldArray({
    control,
    name: "nominations",
  });

  const watchedNominations = watch("nominations");

  const toolNames = useMemo(() => aiTools.map((t) => t.value), [aiTools]);

  const projectsForSelectedPod = useMemo(
    () => (selectedPodId ? projects.filter((p) => p.pod_id === selectedPodId) : []),
    [selectedPodId, projects]
  );

  const effectiveProjectId =
    selectedProjectId ??
    (projectsForSelectedPod.length === 1 ? projectsForSelectedPod[0].id : null);

  const toggleSet = (
    set: Set<number>,
    setSet: React.Dispatch<React.SetStateAction<Set<number>>>,
    id: number,
    max?: number
  ) => {
    const next = new Set(set);
    if (next.has(id)) {
      next.delete(id);
    } else {
      if (max && next.size >= max) return;
      next.add(id);
    }
    setSet(next);
  };

  const deadlineDate = new Date(enforcement.deadline);
  const deadlineLabel = deadlineDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  async function onSubmit(data: FormData) {
    setServerError("");

    const survey_responses: Record<string, unknown> = {
      accomplishment: data.accomplishment.trim(),
    };
    if (energyLevel) survey_responses.energy_level = energyLevel;
    if (data.highlight.trim()) survey_responses.highlight = data.highlight.trim();
    if (data.challenge.trim()) survey_responses.challenge = data.challenge.trim();
    if (data.blockers.trim()) survey_responses.blockers = data.blockers.trim();
    if (data.tailwinds.trim()) survey_responses.tailwinds = data.tailwinds.trim();
    if (data.mitigation_strategy.trim())
      survey_responses.mitigation_strategy = data.mitigation_strategy.trim();
    if (data.anything_else.trim()) survey_responses.anything_else = data.anything_else.trim();

    if (selectedToolNames.length > 0) survey_responses.tools_used = selectedToolNames;
    if (selectedBenefits.size > 0) survey_responses.benefits = Array.from(selectedBenefits);
    if (newConnections !== null) survey_responses.new_connections = newConnections;

    const validNominations = showNominations
      ? data.nominations
          .filter((n) => n.nominee_name.trim() && n.reason.trim())
          .map((n) => ({
            nominee_name: n.nominee_name.trim(),
            nominee_email: n.nominee_email.trim() || undefined,
            nominee_linkedin: n.nominee_linkedin.trim() || undefined,
            nomination_type: n.nomination_type,
            reason: n.reason.trim(),
          }))
      : [];

    const today = new Date().toISOString().split("T")[0];
    const payload: Record<string, unknown> = { scheduled_date: today, survey_responses };
    if (cycle) payload.cycle_id = cycle.id;
    if (selectedPodId) payload.pod_id = selectedPodId;
    if (effectiveProjectId) payload.project_id = effectiveProjectId;
    if (validNominations.length > 0) payload.nominations = validNominations;

    const res = await fetch("/api/pulse-checks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const resData = await res.json().catch(() => ({}));
      reset();
      setEnergyLevel(null);
      setSelectedToolNames([]);
      setSelectedBenefits(new Set());
      setNewConnections(null);
      setShowNominations(false);
      setConfirmation({
        nominationCount: resData?.nomination_count ?? validNominations.length,
      });
      router.refresh();
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } else {
      const resData = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setServerError(copy.submit.duplicateError);
      } else {
        setServerError(resData.error || copy.submit.genericError);
      }
    }
  }

  if (confirmation) {
    return (
      <ConfirmationView
        nominationCount={confirmation.nominationCount}
        onSubmitAnother={() => setConfirmation(null)}
      />
    );
  }

  const bannerTone =
    enforcement.status === "overdue"
      ? "border-red/30 bg-red/10 text-red"
      : enforcement.status === "warning_1day"
        ? "border-red/30 bg-red/[0.08] text-red"
        : enforcement.status === "warning_3day"
          ? "border-red/20 bg-red/[0.06] text-red"
          : "border-teal/20 bg-teal/[0.06] text-teal-deep";

  return (
    <>
      <div className={`mb-4 rounded-card border p-4 text-sm ${bannerTone}`}>
        <p className="font-semibold">{copy.status.deadline(deadlineLabel)}</p>
        {cycle && (
          <p className="mt-1 text-xs opacity-80">{copy.status.cycleLabel(cycle.name)}</p>
        )}
      </div>

      <div className="gate-banner mb-6">
        <p className="text-sm font-semibold text-red">{copy.status.consequenceTitle}</p>
        <p className="mt-1 text-sm text-slate">{copy.status.consequenceBody}</p>
      </div>

      {serverError && (
        <div
          role="alert"
          className="mb-4 rounded-card border border-red/20 bg-red/10 p-3 text-sm text-red"
        >
          {serverError}
        </div>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-8 rounded-card border border-ink/10 bg-white p-6 shadow-card"
      >
        {pods.length > 0 && (
          <section className="space-y-3">
            <h2 className="t-h3 text-ink">
              {copy.context.sectionTitle}
            </h2>
            <label className="block">
              <span className="text-sm font-medium text-charcoal">{copy.context.podLabel}</span>
              <select
                value={selectedPodId ?? ""}
                onChange={(e) => {
                  setSelectedPodId(e.target.value ? Number(e.target.value) : null);
                  setSelectedProjectId(null);
                }}
                className="mt-1 block w-full rounded-card border border-ink/10 bg-white px-3 py-2 text-base text-ink transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">{copy.context.podPlaceholder}</option>
                {pods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            {projectsForSelectedPod.length > 0 && (
              <label className="block">
                <span className="text-sm font-medium text-charcoal">
                  {copy.context.projectLabel}
                </span>
                <select
                  value={selectedProjectId ?? effectiveProjectId ?? ""}
                  onChange={(e) =>
                    setSelectedProjectId(e.target.value ? Number(e.target.value) : null)
                  }
                  className="mt-1 block w-full rounded-card border border-ink/10 bg-white px-3 py-2 text-base text-ink transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">{copy.context.projectPlaceholder}</option>
                  {projectsForSelectedPod.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </section>
        )}

        <section className="space-y-4">
          <h2 className="t-h3 text-ink">
            {copy.reflection.sectionTitle}
          </h2>

          <div>
            <span className="text-sm font-medium text-charcoal">
              {copy.reflection.energy.label}
            </span>
            <div className="mt-2 flex gap-2">
              {copy.reflection.energy.levels.map((label, i) => {
                const level = i + 1;
                const selected = energyLevel === level;
                return (
                  <button
                    key={level}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setEnergyLevel(selected ? null : level)}
                    className={`flex flex-1 flex-col items-center rounded-card border px-2 py-2 text-xs transition-all duration-150 ease-spring active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 ${
                      selected
                        ? "border-teal-deep bg-teal-deep text-white"
                        : "border-ink/10 text-charcoal hover:border-ink/20 hover:text-ink"
                    }`}
                  >
                    <span className="text-base font-semibold tabular-nums">{level}</span>
                    <span className="mt-0.5 leading-tight">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="accomplishment"
              className="block text-sm font-medium text-charcoal"
            >
              {copy.reflection.accomplishment.label} *
            </label>
            <span className="block text-xs text-meta">
              {copy.reflection.accomplishment.helper}
            </span>
            <textarea
              id="accomplishment"
              {...register("accomplishment")}
              rows={4}
              maxLength={2000}
              className={textareaClass}
              placeholder={copy.reflection.accomplishment.placeholder}
            />
            {errors.accomplishment && (
              <p className="mt-1 text-xs text-red">{errors.accomplishment.message}</p>
            )}
          </div>

          <label className="block">
            <span className="text-sm font-medium text-charcoal">
              {copy.reflection.highlight.label}
            </span>
            <span className="block text-xs text-meta">
              {copy.reflection.highlight.helper}
            </span>
            <textarea {...register("highlight")} maxLength={2000} rows={2} className={textareaClass} />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-charcoal">
              {copy.reflection.challenge.label}
            </span>
            <span className="block text-xs text-meta">
              {copy.reflection.challenge.helper}
            </span>
            <textarea {...register("challenge")} maxLength={2000} rows={2} className={textareaClass} />
          </label>
        </section>

        <section className="space-y-4">
          <h2 className="t-h3 text-ink">
            {copy.forces.sectionTitle}
          </h2>

          <label className="block">
            <span className="text-sm font-medium text-charcoal">{copy.forces.blockers.label}</span>
            <span className="block text-xs text-meta">{copy.forces.blockers.helper}</span>
            <textarea {...register("blockers")} maxLength={2000} rows={3} className={textareaClass} />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-charcoal">{copy.forces.tailwinds.label}</span>
            <span className="block text-xs text-meta">{copy.forces.tailwinds.helper}</span>
            <textarea {...register("tailwinds")} maxLength={2000} rows={3} className={textareaClass} />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-charcoal">{copy.forces.mitigation.label}</span>
            <span className="block text-xs text-meta">{copy.forces.mitigation.helper}</span>
            <textarea
              {...register("mitigation_strategy")}
              maxLength={2000}
              rows={3}
              className={textareaClass}
            />
          </label>
        </section>

        <section className="space-y-4">
          <h2 className="t-h3 text-ink">
            {copy.engagement.sectionTitle}
          </h2>

          <ToolsAutocomplete
            suggestions={toolNames}
            selected={selectedToolNames}
            onChange={setSelectedToolNames}
          />

          {pulseBenefits.length > 0 && (
            <div>
              <span className="text-sm font-medium text-charcoal">
                {copy.engagement.benefits.label}
                <span className="ml-1 text-xs font-normal text-meta">
                  ({copy.engagement.benefits.maxNote})
                </span>
              </span>
              <span className="block text-xs text-meta">
                {copy.engagement.benefits.helper}
              </span>
              <div className="mt-2 space-y-2">
                {pulseBenefits.map((b) => {
                  const checked = selectedBenefits.has(b.id);
                  const disabled = !checked && selectedBenefits.size >= 3;
                  return (
                    <label
                      key={b.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-card border px-3 py-2 text-sm transition-all duration-150 ease-out has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal has-[:focus-visible]:ring-offset-2 active:scale-[0.99] ${
                        checked
                          ? "border-teal/40 bg-teal/[0.08] text-teal-deep"
                          : disabled
                            ? "border-ink/10 opacity-40"
                            : "border-ink/10 text-charcoal hover:border-ink/20 hover:text-ink"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleSet(selectedBenefits, setSelectedBenefits, b.id, 3)}
                      />
                      <span>{b.value}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <span className="text-sm font-medium text-charcoal">
              {copy.engagement.newConnections.label}
            </span>
            <div className="mt-2 grid grid-cols-6 gap-2">
              {NEW_CONNECTION_CHOICES.map((choice) => {
                const selected = newConnections === choice;
                return (
                  <button
                    key={choice}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setNewConnections(selected ? null : choice)}
                    className={`rounded-card border px-2 py-2 text-sm font-semibold tabular-nums transition-all duration-150 ease-spring active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 ${
                      selected
                        ? "border-teal-deep bg-teal-deep text-white"
                        : "border-ink/10 text-charcoal hover:border-ink/20 hover:text-ink"
                    }`}
                  >
                    {choice}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="rounded-card border border-ink/10 bg-ink/[0.02] p-4">
          {!showNominations ? (
            <button
              type="button"
              onClick={() => setShowNominations(true)}
              className="flex w-full items-center justify-between gap-3 text-left text-sm text-charcoal transition-colors duration-150 ease-out hover:text-teal-deep"
            >
              <span>
                <span className="font-semibold tracking-tight text-ink">
                  {copy.nominations.collapsedTitle}
                </span>
                <span className="ml-2 text-xs text-meta">
                  {copy.nominations.collapsedHint}
                </span>
              </span>
              <span
                aria-hidden
                className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-ink/10 text-base leading-none"
              >
                +
              </span>
            </button>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="t-h3 text-ink">
                  {copy.nominations.sectionTitle}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowNominations(false)}
                  className="text-xs text-meta hover:text-teal-deep"
                >
                  {copy.nominations.hideLabel}
                </button>
              </div>
              {nominationFields.map((field, index) => {
                const nameError = errors.nominations?.[index]?.nominee_name?.message;
                const reasonError = errors.nominations?.[index]?.reason?.message;
                return (
                  <div
                    key={field.id}
                    className="space-y-3 rounded-card border border-ink/10 bg-white p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="lbl">
                        {copy.nominations.cardLabel(index + 1)}
                      </span>
                      {nominationFields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="text-xs text-meta hover:text-red"
                        >
                          {copy.nominations.removeLabel}
                        </button>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor={`nominations.${index}.nominee_name`}
                        className="block text-sm font-medium text-charcoal"
                      >
                        {copy.nominations.name.label} *
                      </label>
                      <input
                        id={`nominations.${index}.nominee_name`}
                        type="text"
                        {...register(`nominations.${index}.nominee_name`)}
                        maxLength={255}
                        className={inputClass}
                      />
                      {nameError && (
                        <p className="mt-1 text-xs text-red">{nameError}</p>
                      )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-sm font-medium text-charcoal">
                          {copy.nominations.email.label}
                        </span>
                        <input
                          type="email"
                          {...register(`nominations.${index}.nominee_email`)}
                          className={inputClass}
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-charcoal">
                          {copy.nominations.linkedin.label}
                        </span>
                        <input
                          type="text"
                          {...register(`nominations.${index}.nominee_linkedin`)}
                          maxLength={500}
                          className={inputClass}
                          placeholder={copy.nominations.linkedin.placeholder}
                        />
                      </label>
                    </div>

                    <div>
                      <span className="text-sm font-medium text-charcoal">
                        {copy.nominations.type.label}
                      </span>
                      <div className="mt-1 flex gap-2">
                        {copy.nominations.type.options.map((t) => (
                          <label
                            key={t.value}
                            className={`flex flex-1 cursor-pointer items-center justify-center rounded-card border px-3 py-2 text-sm transition-all duration-150 ease-out has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal has-[:focus-visible]:ring-offset-2 active:scale-[0.99] ${
                              watchedNominations[index]?.nomination_type === t.value
                                ? "border-teal/40 bg-teal/[0.08] text-teal-deep"
                                : "border-ink/10 text-slate hover:border-ink/20 hover:text-ink"
                            }`}
                          >
                            <input
                              type="radio"
                              className="hidden"
                              value={t.value}
                              {...register(`nominations.${index}.nomination_type`)}
                            />
                            {t.label}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor={`nominations.${index}.reason`}
                        className="block text-sm font-medium text-charcoal"
                      >
                        {copy.nominations.reason.label} *
                      </label>
                      <span className="block text-xs text-meta">
                        {copy.nominations.reason.helper}
                      </span>
                      <textarea
                        id={`nominations.${index}.reason`}
                        {...register(`nominations.${index}.reason`)}
                        maxLength={2000}
                        rows={3}
                        className="mt-1 block w-full rounded-card border border-ink/10 bg-white px-3 py-2 text-base text-ink transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      {reasonError && (
                        <p className="mt-1 text-xs text-red">{reasonError}</p>
                      )}
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => append(emptyNomination())}
                className="rounded-card ring-1 ring-ink/15 px-3 py-1.5 text-xs font-semibold tracking-tight text-charcoal transition-all duration-150 ease-spring hover:bg-ink/[0.04] hover:text-ink hover:ring-ink/25 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
              >
                {copy.nominations.addLabel}
              </button>
            </div>
          )}
        </section>

        <section>
          <label className="block">
            <span className="text-sm font-medium text-charcoal">{copy.closing.label}</span>
            <span className="block text-xs text-meta">{copy.closing.helper}</span>
            <textarea
              {...register("anything_else")}
              maxLength={2000}
              rows={3}
              className={textareaClass}
            />
          </label>
        </section>

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn btn-teal btn-block"
        >
          {isSubmitting ? copy.submit.submitting : copy.submit.idle}
        </button>
      </form>
    </>
  );
}

function ToolsAutocomplete({
  suggestions,
  selected,
  onChange,
}: {
  suggestions: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const taken = new Set(selected.map((s) => s.toLowerCase()));
    const pool = suggestions.filter((s) => !taken.has(s.toLowerCase()));
    if (!q) return pool.slice(0, 8);
    return pool.filter((s) => s.toLowerCase().includes(q)).slice(0, 8);
  }, [query, selected, suggestions]);

  const exactMatchExists = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [...selected, ...suggestions].some((s) => s.toLowerCase() === q);
  }, [query, selected, suggestions]);

  const addTag = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    if (value.length > 100) return;
    const taken = new Set(selected.map((s) => s.toLowerCase()));
    if (taken.has(value.toLowerCase())) return;
    onChange([...selected, value]);
    setQuery("");
    setHighlight(0);
  };

  const removeTag = (value: string) => {
    onChange(selected.filter((s) => s !== value));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && matches[highlight]) {
        addTag(matches[highlight]);
      } else if (query.trim()) {
        addTag(query);
      }
    } else if (e.key === "Backspace" && !query && selected.length > 0) {
      removeTag(selected[selected.length - 1]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div>
      <span className="text-sm font-medium text-charcoal">{copy.engagement.aiTools.label}</span>
      <span className="block text-xs text-meta">{copy.engagement.aiTools.helper}</span>
      <div
        ref={containerRef}
        onBlur={(e) => {
          if (!containerRef.current?.contains(e.relatedTarget as Node)) {
            setOpen(false);
          }
        }}
        className="relative mt-2"
      >
        <div className="flex flex-wrap items-center gap-1.5 rounded-card border border-ink/10 bg-white px-2 py-1.5">
          {selected.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-sm bg-teal/10 px-2 py-0.5 text-xs font-medium text-teal-deep"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="rounded-full text-teal-deep/70 transition-colors duration-150 hover:text-ink"
                aria-label={`Remove ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setHighlight(0);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={selected.length === 0 ? copy.engagement.aiTools.placeholderEmpty : ""}
            className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-base text-ink placeholder:text-meta-soft focus:outline-none"
          />
        </div>
        {open && (matches.length > 0 || (query.trim() && !exactMatchExists)) && (
          <ul
            role="listbox"
            className="absolute left-0 right-0 z-10 mt-1 max-h-64 overflow-y-auto rounded-card border border-ink/10 bg-white shadow-card-lg"
          >
            {matches.map((m, i) => (
              <li key={m}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addTag(m)}
                  className={`block w-full px-3 py-2 text-left text-sm ${
                    i === highlight ? "bg-teal/10 text-ink" : "text-charcoal hover:bg-ink/[0.04]"
                  }`}
                >
                  {m}
                </button>
              </li>
            ))}
            {query.trim() && !exactMatchExists && (
              <li>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addTag(query)}
                  className="block w-full px-3 py-2 text-left text-sm text-teal-deep hover:bg-ink/[0.04]"
                >
                  + Add &ldquo;{query.trim()}&rdquo;
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

function ConfirmationView({
  nominationCount,
  onSubmitAnother,
}: {
  nominationCount: number;
  onSubmitAnother: () => void;
}) {
  return (
    <div className="rounded-card border border-teal/30 bg-white p-8 shadow-card">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-teal/10 text-teal-deep">
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m4.5 12.75 6 6 9-13.5"
          />
        </svg>
      </div>
      <h2 className="t-h3 text-ink">
        {copy.confirmation.title}
      </h2>
      <p className="mt-2 text-sm text-charcoal">
        {copy.confirmation.body}
        {nominationCount > 0 && copy.confirmation.nominationThanks(nominationCount)}
      </p>
      <div className="mt-6 flex flex-col items-start gap-3">
        <Link
          href="/cycles"
          className="btn btn-teal w-full max-w-xs sm:w-auto"
        >
          {copy.confirmation.primaryCta}
        </Link>
        <button
          type="button"
          onClick={onSubmitAnother}
          className="text-xs text-meta underline-offset-4 transition-colors duration-150 hover:text-teal-deep hover:underline"
        >
          {copy.confirmation.secondaryCta}
        </button>
      </div>
    </div>
  );
}
