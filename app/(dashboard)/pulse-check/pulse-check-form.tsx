"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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

const ENERGY_LABELS = ["Very Low", "Low", "Moderate", "High", "Very High"];
const NOMINATION_TYPES: { value: "upskiller" | "mentor" | "advisor"; label: string }[] = [
  { value: "upskiller", label: "Upskiller" },
  { value: "mentor", label: "Mentor" },
  { value: "advisor", label: "Advisor" },
];
const NEW_CONNECTION_CHOICES = ["0", "1", "2", "3", "4", "5+"] as const;
type NewConnectionChoice = (typeof NEW_CONNECTION_CHOICES)[number];

type Nomination = {
  nominee_name: string;
  nominee_email: string;
  nominee_linkedin: string;
  nomination_type: "upskiller" | "mentor" | "advisor";
  reason: string;
};

const emptyNomination = (): Nomination => ({
  nominee_name: "",
  nominee_email: "",
  nominee_linkedin: "",
  nomination_type: "upskiller",
  reason: "",
});

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
  const [nominations, setNominations] = useState<Nomination[]>([emptyNomination()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<{ nominationCount: number } | null>(null);

  const toolNames = useMemo(() => aiTools.map((t) => t.value), [aiTools]);

  const projectsForSelectedPod = useMemo(
    () => (selectedPodId ? projects.filter((p) => p.pod_id === selectedPodId) : []),
    [selectedPodId, projects]
  );

  // Auto-select project if exactly one
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

  const updateNomination = (i: number, patch: Partial<Nomination>) => {
    setNominations((prev) => prev.map((n, idx) => (idx === i ? { ...n, ...patch } : n)));
  };

  const addNomination = () =>
    setNominations((prev) => [...prev, emptyNomination()]);

  const removeNomination = (i: number) =>
    setNominations((prev) => prev.filter((_, idx) => idx !== i));

  const deadlineDate = new Date(enforcement.deadline);
  const deadlineLabel = deadlineDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const form = new FormData(e.currentTarget);

    const accomplishment = String(form.get("accomplishment") ?? "").trim();
    if (!accomplishment) {
      setError("Please describe what you accomplished this week.");
      setSubmitting(false);
      return;
    }

    const survey_responses: Record<string, unknown> = { accomplishment };
    if (energyLevel) survey_responses.energy_level = energyLevel;

    const setIfPresent = (key: string, formKey?: string) => {
      const v = String(form.get(formKey ?? key) ?? "").trim();
      if (v) survey_responses[key] = v;
    };
    setIfPresent("highlight");
    setIfPresent("challenge");
    setIfPresent("blockers");
    setIfPresent("tailwinds");
    setIfPresent("mitigation_strategy");
    setIfPresent("anything_else");

    if (selectedToolNames.length > 0) {
      survey_responses.tools_used = selectedToolNames;
    }
    if (selectedBenefits.size > 0) {
      survey_responses.benefits = Array.from(selectedBenefits);
    }
    if (newConnections !== null) {
      survey_responses.new_connections = newConnections;
    }

    const validNominations = showNominations
      ? nominations
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
    const payload: Record<string, unknown> = {
      scheduled_date: today,
      survey_responses,
    };
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
      const data = await res.json().catch(() => ({}));
      setEnergyLevel(null);
      setSelectedToolNames([]);
      setSelectedBenefits(new Set());
      setNewConnections(null);
      setNominations([emptyNomination()]);
      setShowNominations(false);
      (e.target as HTMLFormElement).reset();
      setConfirmation({ nominationCount: data?.nomination_count ?? validNominations.length });
      router.refresh();
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Submission failed");
    }
    setSubmitting(false);
  };

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
      ? "border-red-500/40 bg-red-500/[0.08] text-red-200"
      : enforcement.status === "warning_1day"
        ? "border-red-500/30 bg-red-500/[0.06] text-red-200"
        : enforcement.status === "warning_3day"
          ? "border-orange-500/30 bg-orange-500/[0.06] text-orange-200"
          : "border-yellow-500/30 bg-yellow-500/[0.06] text-yellow-200";

  return (
    <>
      <div className={`mb-4 rounded-md border p-4 text-sm ${bannerTone}`}>
        <p className="font-semibold">
          Your next pulse check is due by {deadlineLabel}
        </p>
        {cycle && (
          <p className="mt-1 text-xs opacity-80">
            Active cycle: {cycle.name}
          </p>
        )}
      </div>

      <div className="mb-6 rounded-md border border-yellow-500/30 bg-yellow-500/[0.06] p-4">
        <p className="text-sm font-semibold text-yellow-300">
          Pulse checks keep your status active
        </p>
        <p className="mt-1 text-sm text-cloud/70">
          Going more than 7 days without a pulse check triggers automatic
          revocation of access to cycle infrastructure &mdash; GitHub repos,
          Google Docs, Slack channels, and Google Groups.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-8 rounded-md border border-whisper bg-white/[0.02] p-6"
      >
        {pods.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Context</h2>
            <label className="block">
              <span className="text-sm font-medium text-cloud">Pod</span>
              <select
                value={selectedPodId ?? ""}
                onChange={(e) => {
                  setSelectedPodId(e.target.value ? Number(e.target.value) : null);
                  setSelectedProjectId(null);
                }}
                className="mt-1 block w-full rounded-md border border-whisper bg-white/[0.04] px-3 py-2 text-sm text-white"
              >
                <option value="">— None —</option>
                {pods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            {projectsForSelectedPod.length > 0 && (
              <label className="block">
                <span className="text-sm font-medium text-cloud">Project</span>
                <select
                  value={selectedProjectId ?? effectiveProjectId ?? ""}
                  onChange={(e) =>
                    setSelectedProjectId(e.target.value ? Number(e.target.value) : null)
                  }
                  className="mt-1 block w-full rounded-md border border-whisper bg-white/[0.04] px-3 py-2 text-sm text-white"
                >
                  <option value="">— None —</option>
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
          <h2 className="text-lg font-semibold text-white">Energy & reflection</h2>

          <div>
            <span className="text-sm font-medium text-cloud">
              How&rsquo;s your energy this week?
            </span>
            <div className="mt-2 flex gap-2">
              {ENERGY_LABELS.map((label, i) => {
                const level = i + 1;
                const selected = energyLevel === level;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setEnergyLevel(selected ? null : level)}
                    className={`flex flex-1 flex-col items-center rounded-md border px-2 py-2 text-xs transition-colors ${
                      selected
                        ? "border-aqua bg-aqua text-midnight"
                        : "border-whisper text-cloud/60 hover:border-white/[0.15]"
                    }`}
                  >
                    <span className="text-base font-semibold">{level}</span>
                    <span className="mt-0.5 leading-tight">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-cloud">
              What did you accomplish this week? *
            </span>
            <span className="block text-xs text-cloud/40">
              What progress did you make &mdash; with support from The Labs or on
              your own upskilling journey?
            </span>
            <textarea
              name="accomplishment"
              required
              maxLength={2000}
              rows={4}
              className="mt-1 block w-full rounded-md border border-whisper bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-cloud/40"
              placeholder="Describe your progress, wins, or what you worked on..."
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-cloud">
              What was the highlight of your week?
            </span>
            <textarea
              name="highlight"
              maxLength={2000}
              rows={2}
              className="mt-1 block w-full rounded-md border border-whisper bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-cloud/40"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-cloud">
              What&rsquo;s challenging you right now?
            </span>
            <textarea
              name="challenge"
              maxLength={2000}
              rows={2}
              className="mt-1 block w-full rounded-md border border-whisper bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-cloud/40"
            />
          </label>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Headwinds & tailwinds</h2>

          <label className="block">
            <span className="text-sm font-medium text-cloud">
              What&rsquo;s blocking your progress?
            </span>
            <span className="block text-xs text-cloud/40">
              Technical obstacles, time constraints, unclear next steps, missing
              resources &mdash; anything in the way.
            </span>
            <textarea
              name="blockers"
              maxLength={2000}
              rows={3}
              className="mt-1 block w-full rounded-md border border-whisper bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-cloud/40"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-cloud">
              What&rsquo;s giving you momentum right now?
            </span>
            <span className="block text-xs text-cloud/40">
              Tailwinds &mdash; people, tools, wins, or insights that are
              accelerating your progress.
            </span>
            <textarea
              name="tailwinds"
              maxLength={2000}
              rows={3}
              className="mt-1 block w-full rounded-md border border-whisper bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-cloud/40"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-cloud">
              What are you doing to mitigate headwinds and maximize tailwinds?
            </span>
            <span className="block text-xs text-cloud/40">
              How are you working around obstacles? What&rsquo;s working well that
              you&rsquo;re leaning into?
            </span>
            <textarea
              name="mitigation_strategy"
              maxLength={2000}
              rows={3}
              className="mt-1 block w-full rounded-md border border-whisper bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-cloud/40"
            />
          </label>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Labs engagement</h2>

          <ToolsAutocomplete
            suggestions={toolNames}
            selected={selectedToolNames}
            onChange={setSelectedToolNames}
          />

          {pulseBenefits.length > 0 && (
            <div>
              <span className="text-sm font-medium text-cloud">
                Benefits from The Labs this week (max 3)
              </span>
              <div className="mt-2 space-y-2">
                {pulseBenefits.map((b) => {
                  const checked = selectedBenefits.has(b.id);
                  const disabled = !checked && selectedBenefits.size >= 3;
                  return (
                    <label
                      key={b.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                        checked
                          ? "border-aqua bg-aqua/10 text-white"
                          : disabled
                            ? "border-whisper opacity-40"
                            : "border-whisper text-cloud/80 hover:border-white/[0.15]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={checked}
                        disabled={disabled}
                        onChange={() =>
                          toggleSet(selectedBenefits, setSelectedBenefits, b.id, 3)
                        }
                      />
                      <span>{b.value}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <span className="text-sm font-medium text-cloud">
              How many new connections did you make through The Labs this week?
            </span>
            <div className="mt-2 grid grid-cols-6 gap-2">
              {NEW_CONNECTION_CHOICES.map((choice) => {
                const selected = newConnections === choice;
                return (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => setNewConnections(selected ? null : choice)}
                    className={`rounded-md border px-2 py-2 text-sm font-medium transition-colors ${
                      selected
                        ? "border-aqua bg-aqua text-midnight"
                        : "border-whisper text-cloud/80 hover:border-white/[0.15]"
                    }`}
                  >
                    {choice}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="rounded-md border border-whisper bg-white/[0.01] p-4">
          {!showNominations ? (
            <button
              type="button"
              onClick={() => setShowNominations(true)}
              className="flex w-full items-center justify-between text-left text-sm text-cloud/80 hover:text-aqua"
            >
              <span>
                <span className="font-medium text-white">
                  Know someone who should be part of The Labs?
                </span>
                <span className="ml-2 text-xs text-cloud/50">
                  Nominate an upskiller, mentor, or advisor
                </span>
              </span>
              <span className="text-lg leading-none">+</span>
            </button>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Nominations</h2>
                <button
                  type="button"
                  onClick={() => setShowNominations(false)}
                  className="text-xs text-cloud/60 hover:text-aqua"
                >
                  Hide
                </button>
              </div>
              {nominations.map((n, i) => (
                <div
                  key={i}
                  className="space-y-3 rounded-md border border-whisper bg-white/[0.02] p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wide text-cloud/50">
                      Nomination {i + 1}
                    </span>
                    {nominations.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeNomination(i)}
                        className="text-xs text-cloud/60 hover:text-red-300"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <label className="block">
                    <span className="text-sm font-medium text-cloud">Name *</span>
                    <input
                      type="text"
                      value={n.nominee_name}
                      onChange={(e) =>
                        updateNomination(i, { nominee_name: e.target.value })
                      }
                      maxLength={255}
                      className="mt-1 block w-full rounded-md border border-whisper bg-white/[0.04] px-3 py-2 text-sm text-white"
                    />
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-medium text-cloud">Email</span>
                      <input
                        type="email"
                        value={n.nominee_email}
                        onChange={(e) =>
                          updateNomination(i, { nominee_email: e.target.value })
                        }
                        className="mt-1 block w-full rounded-md border border-whisper bg-white/[0.04] px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-cloud">LinkedIn</span>
                      <input
                        type="url"
                        value={n.nominee_linkedin}
                        onChange={(e) =>
                          updateNomination(i, { nominee_linkedin: e.target.value })
                        }
                        maxLength={500}
                        className="mt-1 block w-full rounded-md border border-whisper bg-white/[0.04] px-3 py-2 text-sm text-white"
                        placeholder="https://linkedin.com/in/..."
                      />
                    </label>
                  </div>

                  <div>
                    <span className="text-sm font-medium text-cloud">Type</span>
                    <div className="mt-1 flex gap-2">
                      {NOMINATION_TYPES.map((t) => (
                        <label
                          key={t.value}
                          className={`flex flex-1 cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm transition-colors ${
                            n.nomination_type === t.value
                              ? "border-aqua bg-aqua/10 text-white"
                              : "border-whisper text-cloud/70"
                          }`}
                        >
                          <input
                            type="radio"
                            className="hidden"
                            checked={n.nomination_type === t.value}
                            onChange={() =>
                              updateNomination(i, { nomination_type: t.value })
                            }
                          />
                          {t.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <label className="block">
                    <span className="text-sm font-medium text-cloud">
                      Why should The Labs know them? *
                    </span>
                    <textarea
                      value={n.reason}
                      onChange={(e) => updateNomination(i, { reason: e.target.value })}
                      maxLength={2000}
                      rows={3}
                      className="mt-1 block w-full rounded-md border border-whisper bg-white/[0.04] px-3 py-2 text-sm text-white"
                    />
                  </label>
                </div>
              ))}

              <button
                type="button"
                onClick={addNomination}
                className="rounded-md border border-whisper px-3 py-2 text-xs text-cloud/80 hover:border-aqua hover:text-aqua"
              >
                + Add another nomination
              </button>
            </div>
          )}
        </section>

        <section>
          <label className="block">
            <span className="text-sm font-medium text-cloud">
              Is there anything else you&rsquo;d like us to know?
            </span>
            <span className="block text-xs text-cloud/40">
              Feedback, ideas, concerns, or anything that doesn&rsquo;t fit above.
            </span>
            <textarea
              name="anything_else"
              maxLength={2000}
              rows={3}
              className="mt-1 block w-full rounded-md border border-whisper bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-cloud/40"
            />
          </label>
        </section>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-aqua px-6 py-3 text-sm font-semibold text-midnight transition-colors hover:bg-teal disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit Pulse Check"}
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
    return pool
      .filter((s) => s.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, selected, suggestions]);

  const exactMatchExists = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [...selected, ...suggestions].some(
      (s) => s.toLowerCase() === q
    );
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
      <span className="text-sm font-medium text-cloud">
        AI tools used this week
      </span>
      <span className="block text-xs text-cloud/40">
        Start typing to see suggestions, or add your own. Press Enter to add a
        tag.
      </span>
      <div
        ref={containerRef}
        onBlur={(e) => {
          if (!containerRef.current?.contains(e.relatedTarget as Node)) {
            setOpen(false);
          }
        }}
        className="relative mt-2"
      >
        <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-whisper bg-white/[0.04] px-2 py-1.5">
          {selected.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-aqua/15 px-2 py-0.5 text-xs text-aqua"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="text-aqua/70 hover:text-white"
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
            placeholder={selected.length === 0 ? "e.g. Claude Code, Cursor, ChatGPT…" : ""}
            className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-sm text-white placeholder:text-cloud/40 focus:outline-none"
          />
        </div>
        {open && (matches.length > 0 || (query.trim() && !exactMatchExists)) && (
          <ul className="absolute left-0 right-0 z-10 mt-1 max-h-64 overflow-y-auto rounded-md border border-whisper bg-[#0e141b] shadow-lg">
            {matches.map((m, i) => (
              <li key={m}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addTag(m)}
                  className={`block w-full px-3 py-2 text-left text-sm ${
                    i === highlight
                      ? "bg-aqua/10 text-white"
                      : "text-cloud/80 hover:bg-white/[0.04]"
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
                  className="block w-full px-3 py-2 text-left text-sm text-aqua hover:bg-white/[0.04]"
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
    <div className="rounded-md border border-teal/30 bg-teal/[0.06] p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-aqua/15 text-aqua">
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m4.5 12.75 6 6 9-13.5"
          />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-white">
        Pulse check submitted
      </h2>
      <p className="mt-2 text-sm text-cloud/70">
        Thanks for checking in. Your access stays active for another 7 days.
        {nominationCount > 0 && (
          <>
            {" "}
            We received {nominationCount} nomination
            {nominationCount === 1 ? "" : "s"} &mdash; thank you for spreading
            the word.
          </>
        )}
      </p>
      <div className="mt-6 flex flex-col items-center gap-3">
        <Link
          href="/cycles"
          className="inline-flex w-full max-w-xs items-center justify-center rounded-md bg-aqua px-6 py-3 text-sm font-semibold text-midnight transition-colors hover:bg-teal sm:w-auto"
        >
          Return to dashboard
        </Link>
        <button
          type="button"
          onClick={onSubmitAnother}
          className="text-xs text-cloud/60 underline-offset-4 transition-colors hover:text-aqua hover:underline"
        >
          Submit another pulse check
        </button>
      </div>
    </div>
  );
}
