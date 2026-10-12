"use client";

import { useEffect, useState } from "react";
import { ui } from "@/lib/ambassador/content";
import { askMessage, smsHref } from "@/lib/ambassador/ask";
import type { AmbassadorSession } from "@/lib/ambassador/session";
import { askStore, profileStore, shareText, type Ask } from "./local-store";

/* "Who will you ask?" — three people you know, each with a dated invite that
   opens in your own messaging app. Names stay on this device; OLOS never
   sends anything and never sees the names. */
export default function AskList({ session }: { session: AmbassadorSession | null }) {
  const [me, setMe] = useState("");
  const [people, setPeople] = useState<Ask[]>([{ name: "" }, { name: "" }, { name: "" }]);

  useEffect(() => {
    const saved = askStore.get();
    // Hydrate from this device after mount (server renders empty).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMe(profileStore.get().me ?? "");
    setPeople([0, 1, 2].map((i) => saved[i] ?? { name: "" }));
  }, []);

  const save = (nextMe: string, next: Ask[]) => {
    setMe(nextMe);
    setPeople(next);
    askStore.set(next);
    profileStore.set({ me: nextMe.trim() || undefined });
  };

  const message = (them: string) => askMessage(ui.ask.message, ui.ask.messageNoDate, them, me.trim(), session);
  const preview = message(people.find((p) => p.name.trim())?.name.trim() ?? "");

  const send = async (i: number) => {
    const text = message(people[i].name.trim());
    if (await shareText(text, smsHref(text))) {
      const next = people.map((p, j) => (j === i ? { name: p.name.trim(), sent: Date.now() } : p));
      save(me, next);
    }
  };

  return (
    <section className="amb-panel" aria-labelledby="ask-title">
      <h2 id="ask-title" className="t-h3">{ui.ask.title}</h2>
      <p className="t-small">{ui.ask.lede}</p>
      <div className="field" style={{ marginTop: 12 }}>
        <label htmlFor="ask-me">{ui.ask.me}</label>
        <input id="ask-me" autoComplete="given-name" maxLength={40} value={me} onChange={(e) => save(e.target.value, people)} />
      </div>
      <ol className="amb-ask-list">
        {people.map((p, i) => {
          const label = `${ui.ask.person} ${i + 1}`;
          const sent = Boolean(p.sent);
          return (
            <li key={i}>
              <input
                aria-label={label}
                placeholder={label}
                maxLength={40}
                value={p.name}
                onChange={(e) => save(me, people.map((x, j) => (j === i ? { name: e.target.value } : x)))}
              />
              <button
                type="button"
                className="btn btn-teal btn-sm"
                disabled={!p.name.trim() || !me.trim()}
                onClick={() => send(i)}
              >
                {sent ? ui.ask.sent : ui.ask.send}
              </button>
            </li>
          );
        })}
      </ol>
      <details className="amb-ask-preview">
        <summary>{ui.ask.preview}</summary>
        <p className="t-body" style={{ marginTop: 8 }}>{preview}</p>
      </details>
    </section>
  );
}
