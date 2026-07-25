"use client";

import { useState } from "react";
import Link from "next/link";

// One short form, no wizard. The submission leans on the map: the GitHub
// link (the triad repo from the Triangulator's Git handoff) carries the
// evidence, the openness, and the paradox — so the form only asks for the
// link plus the basics a ballot card needs: a name, one distilled sentence,
// and optional context for voters who won't open the repo. The server
// attributes the submission to the signed-in participant; there is no name
// field to fill.
export default function ProposeForm({ cycleId }: { cycleId: number }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const [repoUrl, setRepoUrl] = useState("");
  const [sitTitle, setSitTitle] = useState("");
  const [statementText, setStatementText] = useState("");
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  // Accept bare "github.com/org/repo" pastes by prefixing https://.
  const normalizedRepoUrl = (() => {
    const raw = repoUrl.trim();
    if (!raw) return "";
    return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  })();
  const repoUrlValid = (() => {
    if (!normalizedRepoUrl) return false;
    if (normalizedRepoUrl.length > 500) return false;
    try {
      new URL(normalizedRepoUrl);
      return true;
    } catch {
      return false;
    }
  })();

  const canSubmit =
    repoUrlValid && !!sitTitle.trim() && !!statementText.trim() && confirmed;

  async function handleSubmit() {
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/problem-statements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cycle_id: cycleId,
          statement_text: statementText.trim(),
          proposal_data: {
            situation: {
              title: sitTitle.trim(),
              description: description.trim() || undefined,
            },
            statement: {
              text: statementText.trim(),
              question: question.trim() || undefined,
              repo_url: normalizedRepoUrl,
            },
          },
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Failed to submit");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-card border border-teal/30 bg-teal/10 p-8">
        <h2 className="t-h3 text-ink">
          Problem situation submitted
        </h2>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-charcoal">
          Your problem situation is in. During the voting window, cycle
          participants read the gallery, open the maps, and allocate their
          votes; the top-voted situations become the cycle&rsquo;s pods, and
          pod registration opens after the shortlist is finalized.
        </p>
        <blockquote className="mt-5 max-w-lg rounded-card border border-teal/30 bg-white p-4">
          <div className="lbl mb-2">Your problem situation</div>
          {sitTitle.trim() && (
            <p className="mb-1 text-sm font-semibold text-ink">
              {sitTitle.trim()}
            </p>
          )}
          <p className="text-sm leading-relaxed text-charcoal">
            {statementText.trim()}
          </p>
          {question.trim() && (
            <p className="mt-2 text-sm italic leading-relaxed text-meta">
              {question.trim()}
            </p>
          )}
        </blockquote>
        <Link
          href={`/cycles/${cycleId}/proposals`}
          className="mr-3 mt-6 inline-block rounded-card bg-teal-deep px-3 py-2 text-xs font-semibold tracking-tight text-white transition-colors duration-150 hover:bg-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
        >
          See it in the gallery
        </Link>
        <Link
          href={`/cycles/${cycleId}`}
          className="mr-3 mt-6 inline-block rounded-card border border-ink/15 px-3 py-2 text-xs font-semibold tracking-tight text-charcoal transition-colors duration-150 hover:bg-ink/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
        >
          Back to the cycle
        </Link>
        <button
          onClick={() => {
            setSubmitted(false);
            setRepoUrl("");
            setSitTitle("");
            setStatementText("");
            setQuestion("");
            setDescription("");
            setConfirmed(false);
          }}
          className="mt-6 rounded-card bg-teal/10 px-3 py-2 text-xs font-semibold tracking-tight text-teal-deep transition-all duration-150 hover:bg-teal/20 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
        >
          Submit another problem situation
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Field
        label="Link to your map"
        hint="The GitHub repo your triad shares (or a link straight to your folder in it). This is the submission's spine — voters open it to see the situation, the paradox, and the evidence behind it."
        required
      >
        <input
          type="url"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          maxLength={500}
          placeholder="https://github.com/..."
          className={inputClass}
        />
        {repoUrl.trim() !== "" && !repoUrlValid && (
          <p className="mt-1 text-xs text-red">
            That doesn&rsquo;t look like a URL — check it and try again.
          </p>
        )}
      </Field>

      <Field
        label="Name the problem situation"
        hint="The title on your situation box in the Triangulator."
        required
      >
        <input
          type="text"
          value={sitTitle}
          onChange={(e) => setSitTitle(e.target.value)}
          maxLength={200}
          placeholder="A short name for this open condition"
          className={inputClass}
        />
      </Field>

      <Field
        label="Your problem situation, in one sentence"
        hint="The line the ballot and gallery lead with — distill it so a stranger pictures it."
        required
      >
        <textarea
          value={statementText}
          onChange={(e) => setStatementText(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="[Who, specifically] needs to [do what] because [what's actually in the way]..."
          className={textareaClass}
        />
        <CharCount value={statementText} max={2000} />
      </Field>

      <Field
        label="How might we…?"
        hint="Optional — the question your Research Pod would work to answer."
      >
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={2000}
          rows={2}
          placeholder="How might we..."
          className={textareaClass}
        />
      </Field>

      <Field
        label="Anything voters should know before they open the map?"
        hint="Optional — a few sentences of context: scale, what's been tried, who you need."
      >
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          rows={3}
          className={textareaClass}
        />
      </Field>

      <label className="flex cursor-pointer items-start gap-3 rounded-card border border-ink/10 bg-white p-4 text-sm text-charcoal transition-colors duration-150 hover:text-ink">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-ink/20 bg-white accent-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
        />
        <span>
          It names an open situation — no solution baked in — and the map
          holds the evidence.
        </span>
      </label>

      {error && (
        <p
          role="alert"
          className="rounded-card border border-red/20 bg-red/10 px-3 py-2 text-sm text-red"
        >
          {error}
        </p>
      )}

      <div className="flex items-center justify-end border-t border-ink/10 pt-6">
        <button
          onClick={handleSubmit}
          disabled={submitting || !canSubmit}
          className="btn btn-teal btn-sm"
        >
          {submitting ? "Submitting..." : "Submit problem situation"}
        </button>
      </div>
    </div>
  );
}

/* ── Shared helpers ──────────────────────────────────────────────── */

const inputClass =
  "block w-full rounded-card border border-ink/10 bg-white px-3 py-2 text-base text-ink placeholder:text-meta-soft transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal disabled:cursor-not-allowed disabled:opacity-50";

const textareaClass =
  "block w-full resize-none rounded-card border border-ink/10 bg-white px-3 py-2 text-base text-ink placeholder:text-meta-soft transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal disabled:cursor-not-allowed disabled:opacity-50";

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-charcoal">
        {label}
        {required && (
          <span className="ml-0.5 text-red" aria-hidden>
            *
          </span>
        )}
      </label>
      {hint && (
        <p className="text-xs leading-relaxed text-meta">{hint}</p>
      )}
      {children}
    </div>
  );
}

function CharCount({ value, max }: { value: string; max: number }) {
  return (
    <p className="mt-1 text-right text-xs text-meta tabular-nums">
      {value.length}/{max}
    </p>
  );
}
