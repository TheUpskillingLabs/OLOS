"use client";

import { useEffect, useState } from "react";
import { story as storyCopy, ui, stepHref } from "@/lib/ambassador/content";
import { buildStory, wordStats } from "@/lib/ambassador/ask";
import { storyStore } from "./local-store";

/* Your 30-second why. It stays on this device: it's the ambassador's own
   words, for them to say out loud, not a record. */

/** The saved why, as an information panel (only the link inside presses). */
export function StoryCard() {
  const [draft, setDraft] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(storyStore.get().draft.trim());
  }, []);
  return (
    <section className="amb-panel">
      <h2 className="t-h3">{ui.page.yourWhy}</h2>
      {draft ? <p className="amb-story-text">{draft}</p> : <p className="t-small">{ui.page.noStoryYet}</p>}
      <a className="amb-linkbtn" href={stepHref("your-story")}>
        {draft ? ui.page.editYourStory : ui.page.writeYourStory} →
      </a>
    </section>
  );
}

/** Four short answers build the why, live. Once the ambassador edits the
 *  draft it's theirs, and the answers stop rewriting it. */
export function StoryBuilder() {
  const prompts = storyCopy.prompts;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState("");
  const [edited, setEdited] = useState(false);

  useEffect(() => {
    const s = storyStore.get();
    const built = buildStory(prompts.map((p) => s.answers[p.id] ?? ""));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnswers(s.answers);
    setDraft(s.draft || built);
    setEdited(Boolean(s.draft.trim()) && s.draft !== built);
  }, [prompts]);

  const persist = (a: Record<string, string>, d: string) => storyStore.save({ answers: a, draft: d });

  const onAnswer = (id: string, value: string) => {
    const a = { ...answers, [id]: value };
    const d = edited ? draft : buildStory(prompts.map((p) => a[p.id] ?? ""));
    setAnswers(a);
    setDraft(d);
    persist(a, d);
  };

  const onDraft = (value: string) => {
    setDraft(value);
    setEdited(Boolean(value.trim()));
    persist(answers, value);
  };

  const s = wordStats(draft);
  const band = s.words === 0 ? "" : s.words < 65 ? ui.story.bandShort : s.words <= 85 ? ui.story.bandOk : ui.story.bandLong;

  return (
    <form className="amb-stack" onSubmit={(e) => e.preventDefault()}>
      {prompts.map((p) => (
        <div className="field" key={p.id}>
          <label htmlFor={`q-${p.id}`}>{p.label}</label>
          <textarea
            id={`q-${p.id}`}
            rows={2}
            style={{ minHeight: 72 }}
            placeholder={p.example}
            value={answers[p.id] ?? ""}
            onChange={(e) => onAnswer(p.id, e.target.value)}
          />
        </div>
      ))}
      <div className="field">
        <label htmlFor="draft">{ui.story.draftLabel}</label>
        <textarea id="draft" rows={6} value={draft} onChange={(e) => onDraft(e.target.value)} aria-describedby="wordband" />
        <p className="amb-wordband" id="wordband" aria-live="polite">
          <b>{s.words}</b> {ui.story.words} ≈ <b>{s.seconds}</b> {ui.story.seconds} {band}
        </p>
      </div>
    </form>
  );
}
