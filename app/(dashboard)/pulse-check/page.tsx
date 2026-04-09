"use client";

import { useState, useEffect } from "react";

interface Option {
  id: number;
  value: string;
}

interface Enrollment {
  cycle_id: number;
  status: string;
  cycles: { name: string };
}

interface PulseCheckEntry {
  scheduled_date: string;
  completed_at: string;
  survey_responses: {
    accomplishment: string;
    energy_level?: number;
    highlight?: string;
    challenge?: string;
  };
}

type Mode = "cycle" | "standalone";

const ENERGY_LABELS = ["Very Low", "Low", "Moderate", "High", "Very High"];

export default function PulseCheckPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>("standalone");
  const [aiTools, setAiTools] = useState<Option[]>([]);
  const [pulseBenefits, setPulseBenefits] = useState<Option[]>([]);
  const [history, setHistory] = useState<PulseCheckEntry[]>([]);
  const [energyLevel, setEnergyLevel] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/options").then((r) => r.json()),
      fetch("/api/cycles").then((r) => r.json()),
    ]).then(([options, cycles]) => {
      setAiTools(options.ai_tools || []);
      setPulseBenefits(options.pulse_benefits || []);

      if (Array.isArray(cycles)) {
        const activeCycles = cycles.filter(
          (c: { status: string }) => c.status === "active"
        );
        setEnrollments(
          activeCycles.map((c: { id: number; name: string }) => ({
            cycle_id: c.id,
            status: "active",
            cycles: { name: c.name },
          }))
        );
        if (activeCycles.length > 0) {
          setSelectedCycleId(activeCycles[0].id);
          setMode("cycle");
        }
      }
      setLoading(false);
    });
  }, []);

  // Fetch history when mode or cycle changes
  useEffect(() => {
    if (mode === "cycle" && selectedCycleId) {
      fetch(`/api/pulse-checks/${selectedCycleId}`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setHistory(data);
        });
    } else if (mode === "standalone") {
      fetch("/api/pulse-checks/me")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setHistory(data);
        });
    }
  }, [mode, selectedCycleId, success]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess(false);

    const form = new FormData(e.currentTarget);

    const toolsUsed = form.getAll("tools_used").map(Number);
    const benefits = form.getAll("benefits").map(Number);

    if (benefits.length > 3) {
      setError("Please select at most 3 benefits.");
      setSubmitting(false);
      return;
    }

    const survey_responses: Record<string, unknown> = {
      accomplishment: form.get("accomplishment"),
    };

    // Reflective fields (both modes)
    if (energyLevel) survey_responses.energy_level = energyLevel;

    const highlight = form.get("highlight");
    if (highlight) survey_responses.highlight = highlight;

    const challenge = form.get("challenge");
    if (challenge) survey_responses.challenge = challenge;

    // Cycle-specific fields
    if (mode === "cycle") {
      if (toolsUsed.length > 0) survey_responses.tools_used = toolsUsed;
      if (benefits.length > 0) survey_responses.benefits = benefits;

      const newConnections = form.get("new_connections");
      if (newConnections) {
        survey_responses.new_connections = Number(newConnections);
      }

      const helpNeeded = form.get("help_needed");
      if (helpNeeded) survey_responses.help_needed = helpNeeded;

      if (form.get("help_attempted") === "on") {
        survey_responses.help_attempted = true;
      }

      if (form.get("network_referral") === "on") {
        survey_responses.network_referral = true;
      }
    }

    const today = new Date().toISOString().split("T")[0];

    const payload: Record<string, unknown> = {
      scheduled_date: today,
      survey_responses,
    };
    if (mode === "cycle" && selectedCycleId) {
      payload.cycle_id = selectedCycleId;
    }

    const res = await fetch("/api/pulse-checks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setSuccess(true);
      setEnergyLevel(null);
      (e.target as HTMLFormElement).reset();
    } else {
      const data = await res.json();
      setError(data.error || "Submission failed");
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-cloud/60">Loading...</p>
      </div>
    );
  }

  if (enrollments.length === 0) {
    return (
      <div className="mx-auto max-w-2xl text-center py-20">
        <h1 className="text-2xl font-bold text-white">
          Pulse Check
        </h1>
        <p className="mt-4 text-cloud/80">
          No active cycles found. Pulse checks are available when you are
          enrolled in an active build cycle.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 text-2xl font-bold text-white">
        Pulse Check
      </h1>
      <p className="mb-6 text-sm text-cloud/80">
        Share what you accomplished this week and how things are going.
      </p>

      {/* Mode toggle — only shown when the user has active cycles */}
      {hasCycles && (
        <div className="mb-6 flex rounded-xl border border-white/10 p-1">
          <button
            type="button"
            onClick={() => setMode("cycle")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              mode === "cycle"
                ? "bg-aqua text-midnight"
                : "text-cloud/60 hover:text-aqua"
            }`}
          >
            Cycle Check-in
          </button>
          <button
            type="button"
            onClick={() => setMode("standalone")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              mode === "standalone"
                ? "bg-aqua text-midnight"
                : "text-cloud/60 hover:text-aqua"
            }`}
          >
            Personal Reflection
          </button>
        </div>
      )}

      {/* Cycle selector — only in cycle mode with multiple cycles */}
      {mode === "cycle" && enrollments.length > 1 && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-cloud">
            Cycle
          </label>
          <select
            value={selectedCycleId ?? ""}
            onChange={(e) => setSelectedCycleId(Number(e.target.value))}
            className="mt-1 block w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white"
          >
            {enrollments.map((en) => (
              <option key={en.cycle_id} value={en.cycle_id}>
                {en.cycles.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-xl border border-teal/20 bg-teal/10 p-3 text-sm text-aqua">
          Pulse check submitted successfully!
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-red/20 bg-red/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-6 backdrop-blur-sm"
      >
        {/* === Reflective fields (both modes) === */}

        {/* Energy level */}
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
                  className={`flex flex-1 flex-col items-center rounded-lg border px-2 py-2 text-xs transition-colors ${
                    selected
                      ? "border-aqua bg-aqua text-midnight"
                      : "border-white/10 text-cloud/60 hover:border-white/20"
                  }`}
                >
                  <span className="text-base font-semibold">{level}</span>
                  <span className="mt-0.5 leading-tight">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Accomplishment — the core narrative */}
        <label className="block">
          <span className="text-sm font-medium text-cloud">
            What did you accomplish this week? *
          </span>
          <textarea
            name="accomplishment"
            required
            maxLength={1000}
            rows={4}
            className="mt-1 block w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white placeholder:text-cloud/40"
            placeholder="Describe your progress, wins, or what you worked on..."
          />
        </label>

        {aiTools.length > 0 && (
          <div>
            <span className="text-sm font-medium text-cloud">
              AI Tools Used
            </span>
            <div className="mt-2 flex flex-wrap gap-3">
              {aiTools.map((tool) => (
                <label key={tool.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="tools_used"
                    value={tool.id}
                    className="rounded border-white/20 bg-white/[0.05] text-teal"
                  />
                  <span className="text-sm text-cloud">
                    {tool.value}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {pulseBenefits.length > 0 && (
          <div>
            <span className="text-sm font-medium text-cloud">
              Benefits this week (max 3)
            </span>
            <div className="mt-2 space-y-2">
              {pulseBenefits.map((b) => (
                <label key={b.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="benefits"
                    value={b.id}
                    className="rounded border-white/20 bg-white/[0.05] text-teal"
                  />
                  <span className="text-sm text-cloud">
                    {b.value}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        <label className="block">
          <span className="text-sm font-medium text-cloud">
            New connections made
          </span>
          <input
            name="new_connections"
            type="number"
            min={0}
            className="mt-1 block w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white placeholder:text-cloud/40"
            placeholder="Number of new collaborators you met"
          />
        </label>

        {/* Challenge */}
        <label className="block">
          <span className="text-sm font-medium text-cloud">
            What&rsquo;s challenging you right now?
          </span>
          <textarea
            name="challenge"
            maxLength={1000}
            rows={2}
            className="mt-1 block w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white placeholder:text-cloud/40"
            placeholder="Anything blocking you, frustrating you, or keeping you up at night..."
          />
        </label>

        {/* === Cycle-specific fields (only in cycle mode) === */}
        {mode === "cycle" && (
          <>
            {aiTools.length > 0 && (
              <div>
                <span className="text-sm font-medium text-cloud">
                  AI Tools Used
                </span>
                <div className="mt-2 flex flex-wrap gap-3">
                  {aiTools.map((tool) => (
                    <label key={tool.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="tools_used"
                        value={tool.id}
                        className="rounded border-white/20 bg-white/[0.05] text-teal"
                      />
                      <span className="text-sm text-cloud">
                        {tool.value}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {pulseBenefits.length > 0 && (
              <div>
                <span className="text-sm font-medium text-cloud">
                  Benefits this week (max 3)
                </span>
                <div className="mt-2 space-y-2">
                  {pulseBenefits.map((b) => (
                    <label key={b.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="benefits"
                        value={b.id}
                        className="rounded border-white/20 bg-white/[0.05] text-teal"
                      />
                      <span className="text-sm text-cloud">
                        {b.value}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <label className="block">
              <span className="text-sm font-medium text-cloud">
                New connections made
              </span>
              <input
                name="new_connections"
                type="number"
                min={0}
                className="mt-1 block w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white placeholder:text-cloud/40"
                placeholder="Number of new collaborators you met"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-cloud">
                Do you need any help?
              </span>
              <textarea
                name="help_needed"
                maxLength={1000}
                rows={3}
                className="mt-1 block w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white placeholder:text-cloud/40"
                placeholder="Describe any support or resources you need..."
              />
            </label>

            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="help_attempted"
                  className="rounded border-white/20 bg-white/[0.05] text-teal"
                />
                <span className="text-sm text-cloud">
                  I have already sought help for this
                </span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="network_referral"
                  className="rounded border-white/20 bg-white/[0.05] text-teal"
                />
                <span className="text-sm text-cloud">
                  I am interested in a network referral
                </span>
              </label>
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-aqua px-6 py-3 text-sm font-semibold text-midnight transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
        >
          {submitting ? "Submitting..." : "Submit Pulse Check"}
        </button>
      </form>

      {/* History */}
      {history.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Previous Submissions
          </h2>
          <div className="space-y-3">
            {history.map((entry) => (
              <div
                key={entry.scheduled_date}
                className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4 backdrop-blur-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-cloud">
                      {new Date(entry.scheduled_date).toLocaleDateString(
                        "en-US",
                        {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        }
                      )}
                    </span>
                    {entry.survey_responses.energy_level && (
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                        title={`Energy: ${ENERGY_LABELS[entry.survey_responses.energy_level - 1]}`}
                      >
                        {entry.survey_responses.energy_level <= 2
                          ? "Energy " + entry.survey_responses.energy_level + "/5"
                          : "Energy " + entry.survey_responses.energy_level + "/5"}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-cloud/60">
                    {new Date(entry.completed_at).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="mt-2 text-sm text-cloud/80">
                  {entry.survey_responses.accomplishment}
                </p>
                {entry.survey_responses.highlight && (
                  <p className="mt-1 text-sm text-cloud/60">
                    <span className="font-medium">Highlight:</span>{" "}
                    {entry.survey_responses.highlight}
                  </p>
                )}
                {entry.survey_responses.challenge && (
                  <p className="mt-1 text-sm text-cloud/60">
                    <span className="font-medium">Challenge:</span>{" "}
                    {entry.survey_responses.challenge}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
