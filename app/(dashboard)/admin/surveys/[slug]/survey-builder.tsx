"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  FieldSurvey,
  SurveyQuestion,
  SurveyQuestionType,
  SurveyQuestionConfig,
} from "@/lib/content/surveys";

/* The question builder island. Edits survey settings and authors/reorders
   questions against the CRUD routes, then router.refresh()es to re-read the
   server truth. System questions (the seeded 7) are copy-editable only — their
   type/options/required are locked because downstream columns depend on them. */

const inputCls =
  "w-full rounded-card border border-ink/10 bg-white px-3 py-1.5 text-base text-ink placeholder:text-meta focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal";
const labelCls = "flex flex-col gap-1.5 text-xs font-medium text-charcoal";

const TYPE_LABELS: Record<SurveyQuestionType, string> = {
  short_text: "Short text",
  long_text: "Long text",
  single_select: "Single choice",
  multi_select: "Multiple choice",
  scale: "1–5 scale",
  yes_no: "Yes / No",
  consent: "Consent",
  contact: "Contact fields",
};

const AUTHORABLE_TYPES: SurveyQuestionType[] = [
  "short_text",
  "long_text",
  "single_select",
  "multi_select",
  "scale",
  "yes_no",
  "consent",
  "contact",
];

const hasOptions = (t: SurveyQuestionType) =>
  t === "single_select" || t === "multi_select" || t === "yes_no";

export default function SurveyBuilder({
  survey,
  initialQuestions,
}: {
  survey: FieldSurvey;
  initialQuestions: SurveyQuestion[];
}) {
  const router = useRouter();
  const questions = initialQuestions;
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, method: string, body?: unknown) {
    setError(null);
    setBusy(true);
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) return res;
    const json = res ? await res.json().catch(() => null) : null;
    setError(json?.error ?? "Something went wrong.");
    return null;
  }

  async function move(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= questions.length) return;
    const ordered = questions.map((q) => q.id);
    [ordered[index], ordered[next]] = [ordered[next], ordered[index]];
    const res = await call(
      `/api/surveys/${survey.share_slug}/questions/reorder`,
      "POST",
      { orderedIds: ordered }
    );
    if (res) router.refresh();
  }

  async function remove(q: SurveyQuestion) {
    if (!confirm(`Delete "${q.prompt}"? This can't be undone.`)) return;
    const res = await call(
      `/api/surveys/${survey.share_slug}/questions/${q.id}`,
      "DELETE"
    );
    if (res) router.refresh();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
      <SettingsPanel survey={survey} onSaved={() => router.refresh()} />

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="t-h4 text-ink">Questions</h2>
          <button
            type="button"
            onClick={() => setEditing("new")}
            disabled={busy}
            className="btn btn-teal px-3 py-1.5 text-sm"
          >
            + Add question
          </button>
        </div>

        {error && (
          <p role="alert" className="mb-3 text-sm text-red">
            {error}
          </p>
        )}

        {editing === "new" && (
          <QuestionEditor
            slug={survey.share_slug}
            question={null}
            onDone={(changed) => {
              setEditing(null);
              if (changed) router.refresh();
            }}
          />
        )}

        {questions.length === 0 && editing !== "new" ? (
          <p className="text-sm text-meta">
            No questions yet — add the first one. A survey needs at least one
            question before it can be opened.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {questions.map((q, i) =>
              editing === q.id ? (
                <li key={q.id}>
                  <QuestionEditor
                    slug={survey.share_slug}
                    question={q}
                    onDone={(changed) => {
                      setEditing(null);
                      if (changed) router.refresh();
                    }}
                  />
                </li>
              ) : (
                <li
                  key={q.id}
                  className={`rounded-card border border-ink/10 bg-white p-4 shadow-card ${
                    q.active ? "" : "opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-teal/10 px-2 py-0.5 text-xs font-semibold text-teal-deep">
                          {TYPE_LABELS[q.question_type]}
                        </span>
                        {q.required && (
                          <span className="text-xs text-meta">required</span>
                        )}
                        {q.is_system && (
                          <span className="text-xs text-meta">· system</span>
                        )}
                        {!q.active && (
                          <span className="text-xs text-red">· retired</span>
                        )}
                      </div>
                      <p className="mt-1.5 text-sm font-medium text-ink">
                        {q.prompt}
                      </p>
                      {q.help && (
                        <p className="mt-0.5 text-xs text-meta">{q.help}</p>
                      )}
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1">
                      <button
                        type="button"
                        aria-label="Move up"
                        disabled={busy || i === 0}
                        onClick={() => move(i, -1)}
                        className="rounded px-2 py-1 text-meta hover:bg-ink/5 disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label="Move down"
                        disabled={busy || i === questions.length - 1}
                        onClick={() => move(i, 1)}
                        className="rounded px-2 py-1 text-meta hover:bg-ink/5 disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(q.id)}
                        className="rounded px-2 py-1 text-sm font-semibold text-teal-deep hover:bg-teal/10"
                      >
                        Edit
                      </button>
                      {!q.is_system && (
                        <button
                          type="button"
                          onClick={() => remove(q)}
                          disabled={busy}
                          className="rounded px-2 py-1 text-sm font-semibold text-red hover:bg-red/10 disabled:opacity-40"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              )
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Settings panel ───────────────────────────────────────────────────────────

function SettingsPanel({
  survey,
  onSaved,
}: {
  survey: FieldSurvey;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(survey.title);
  const [domain, setDomain] = useState(survey.problem_domain ?? "");
  const [about, setAbout] = useState(survey.about ?? "");
  const [slug, setSlug] = useState(survey.share_slug);
  const [status, setStatus] = useState(survey.status);
  const [anon, setAnon] = useState(survey.allow_anonymous);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    setSaved(false);
    const res = await fetch(`/api/surveys/${survey.share_slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        problem_domain: domain.trim() || null,
        about: about.trim() || null,
        share_slug: slug.trim(),
        status,
        allow_anonymous: anon,
      }),
    }).catch(() => null);
    setSaving(false);
    if (res?.ok) {
      const body = await res.json().catch(() => null);
      const newSlug = body?.share_slug ?? survey.share_slug;
      if (newSlug !== survey.share_slug) {
        router.push(`/admin/surveys/${newSlug}`);
      } else {
        setSaved(true);
        onSaved();
      }
    } else {
      const body = res ? await res.json().catch(() => null) : null;
      setError(body?.error ?? "Couldn't save settings.");
    }
  }

  return (
    <form
      onSubmit={save}
      className="h-fit rounded-card border border-ink/10 bg-white p-5 shadow-card"
    >
      <h2 className="t-h4 mb-4 text-ink">Settings</h2>
      <div className="flex flex-col gap-3">
        <label className={labelCls}>
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className={labelCls}>
          Problem domain
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="e.g. Civics & Elections"
            className={inputCls}
          />
        </label>
        <label className={labelCls}>
          About (landing lede)
          <textarea
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            rows={3}
            className={inputCls}
          />
        </label>
        <label className={labelCls}>
          Share slug
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className={`${inputCls} font-mono text-sm`}
          />
        </label>
        <div className="flex gap-3">
          <label className={`${labelCls} flex-1`}>
            Status
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as FieldSurvey["status"])
              }
              className={inputCls}
            >
              <option value="draft">Draft</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </label>
          <label className="flex flex-1 items-center gap-2 pt-6 text-sm text-charcoal">
            <input
              type="checkbox"
              checked={anon}
              onChange={(e) => setAnon(e.target.checked)}
              className="h-4 w-4 accent-teal-deep"
            />
            Allow anonymous
          </label>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="btn btn-teal px-4 py-1.5 text-sm disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
        {saved && <span className="text-xs text-teal-deep">Saved ✓</span>}
      </div>
      {status === "open" && (
        <p className="mt-3 text-xs text-meta">
          Open surveys are publicly submittable at{" "}
          <span className="font-mono">/survey/{slug}</span>.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-red">
          {error}
        </p>
      )}
    </form>
  );
}

// ── Question editor (create + edit) ──────────────────────────────────────────

type OptionRow = { v: string; label: string };

function QuestionEditor({
  slug,
  question,
  onDone,
}: {
  slug: string;
  question: SurveyQuestion | null;
  onDone: (changed: boolean) => void;
}) {
  const isSystem = question?.is_system ?? false;
  const [type, setType] = useState<SurveyQuestionType>(
    question?.question_type ?? "short_text"
  );
  const [prompt, setPrompt] = useState(question?.prompt ?? "");
  const [help, setHelp] = useState(question?.help ?? "");
  const [placeholder, setPlaceholder] = useState(question?.placeholder ?? "");
  const [required, setRequired] = useState(question?.required ?? false);
  const [options, setOptions] = useState<OptionRow[]>(
    question?.config.options ?? []
  );
  const [min, setMin] = useState<number>(question?.config.min ?? 0);
  const [lowLabel, setLowLabel] = useState(question?.config.lowLabel ?? "");
  const [highLabel, setHighLabel] = useState(question?.config.highLabel ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function buildConfig(): SurveyQuestionConfig {
    const cfg: SurveyQuestionConfig = {};
    if (hasOptions(type)) {
      cfg.options = options
        .filter((o) => o.v.trim() && o.label.trim())
        .map((o) => ({ v: o.v.trim(), label: o.label.trim() }));
      if (type === "multi_select") cfg.min = min;
    }
    if (type === "scale") {
      cfg.lowLabel = lowLabel.trim();
      cfg.highLabel = highLabel.trim();
    }
    // consent/contact config on system questions is preserved server-side (we
    // only send editable copy for those); custom consent/contact keep any
    // existing config untouched here.
    if (question && (type === "consent" || type === "contact")) {
      Object.assign(cfg, question.config);
    }
    return cfg;
  }

  async function save() {
    if (!prompt.trim()) {
      setError("A prompt is required.");
      return;
    }
    if (hasOptions(type) && buildConfig().options!.length === 0) {
      setError("Add at least one option.");
      return;
    }
    setError(null);
    setSaving(true);

    const editableCopy = {
      prompt: prompt.trim(),
      help: help.trim() || null,
      placeholder: placeholder.trim() || null,
    };
    const fullPayload = {
      ...editableCopy,
      question_type: type,
      required,
      config: buildConfig(),
    };

    let res: Response | null;
    if (!question) {
      res = await fetch(`/api/surveys/${slug}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fullPayload),
      }).catch(() => null);
    } else {
      // System questions only accept copy edits; the server ignores the rest,
      // but we keep the payload minimal to be explicit.
      const body = isSystem ? editableCopy : fullPayload;
      res = await fetch(`/api/surveys/${slug}/questions/${question.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => null);
    }

    setSaving(false);
    if (res?.ok) {
      onDone(true);
    } else {
      const json = res ? await res.json().catch(() => null) : null;
      setError(json?.error ?? "Couldn't save the question.");
    }
  }

  return (
    <div className="rounded-card border border-teal/40 bg-teal/[0.03] p-4">
      <div className="flex flex-col gap-3">
        <label className={labelCls}>
          Question type
          <select
            value={type}
            onChange={(e) => setType(e.target.value as SurveyQuestionType)}
            disabled={isSystem}
            className={`${inputCls} disabled:opacity-60`}
          >
            {AUTHORABLE_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        {isSystem && (
          <p className="text-xs text-meta">
            This is a system question — its type, options, and requirement are
            locked. You can still edit its wording.
          </p>
        )}

        <label className={labelCls}>
          Prompt
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className={labelCls}>
          Help text (optional)
          <input
            value={help}
            onChange={(e) => setHelp(e.target.value)}
            className={inputCls}
          />
        </label>

        {(type === "short_text" || type === "long_text") && (
          <label className={labelCls}>
            Placeholder (optional)
            <input
              value={placeholder}
              onChange={(e) => setPlaceholder(e.target.value)}
              className={inputCls}
            />
          </label>
        )}

        {hasOptions(type) && !isSystem && (
          <OptionsEditor options={options} onChange={setOptions} />
        )}

        {type === "multi_select" && !isSystem && (
          <label className={`${labelCls} w-40`}>
            Minimum picks
            <input
              type="number"
              min={0}
              value={min}
              onChange={(e) => setMin(Number(e.target.value) || 0)}
              className={inputCls}
            />
          </label>
        )}

        {type === "scale" && !isSystem && (
          <div className="flex gap-3">
            <label className={`${labelCls} flex-1`}>
              Low label (1)
              <input
                value={lowLabel}
                onChange={(e) => setLowLabel(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className={`${labelCls} flex-1`}>
              High label (5)
              <input
                value={highLabel}
                onChange={(e) => setHighLabel(e.target.value)}
                className={inputCls}
              />
            </label>
          </div>
        )}

        {(type === "consent" || type === "contact") && isSystem && (
          <p className="text-xs text-meta">
            The {type === "consent" ? "consent agreement" : "contact fields"} for
            this system question are fixed.
          </p>
        )}

        {!isSystem && (
          <label className="flex items-center gap-2 text-sm text-charcoal">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="h-4 w-4 accent-teal-deep"
            />
            Required
          </label>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="btn btn-teal px-4 py-1.5 text-sm disabled:opacity-50"
        >
          {saving ? "Saving…" : question ? "Save question" : "Add question"}
        </button>
        <button
          type="button"
          onClick={() => onDone(false)}
          className="text-sm text-meta hover:text-charcoal"
        >
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red">
          {error}
        </p>
      )}
    </div>
  );
}

function OptionsEditor({
  options,
  onChange,
}: {
  options: OptionRow[];
  onChange: (rows: OptionRow[]) => void;
}) {
  const update = (i: number, patch: Partial<OptionRow>) =>
    onChange(options.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-charcoal">Options</span>
      {options.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={o.label}
            onChange={(e) => update(i, { label: e.target.value })}
            placeholder="Label shown to people"
            className={`${inputCls} flex-1`}
          />
          <input
            value={o.v}
            onChange={(e) => update(i, { v: e.target.value })}
            placeholder="value_key"
            className={`${inputCls} w-40 font-mono text-sm`}
          />
          <button
            type="button"
            aria-label="Remove option"
            onClick={() => onChange(options.filter((_, j) => j !== i))}
            className="rounded px-2 py-1 text-meta hover:bg-ink/5"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...options, { v: "", label: "" }])}
        className="self-start text-sm font-semibold text-teal-deep hover:underline"
      >
        + Add option
      </button>
    </div>
  );
}
