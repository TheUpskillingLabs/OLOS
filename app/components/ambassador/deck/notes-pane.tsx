"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { fill, ui } from "@/lib/ambassador/content";
import { DeckSlides, type AskInfo, type DeckSlide } from "./deck-slides";
import { Stage } from "./stage";

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.abs(sec) % 60).padStart(2, "0")}`;

type Pace = "ahead" | "behind" | "on";

/** Elapsed time against the talk shape's per-slide budgets. Click to reset. */
function usePace(slides: DeckSlide[], index: number) {
  const start = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    start.current = Date.now();
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - start.current) / 1000)), 500);
    return () => window.clearInterval(id);
  }, []);
  const reset = () => {
    start.current = Date.now();
    setElapsed(0);
  };
  const before = slides.slice(0, index).reduce((a, s) => a + s.seconds, 0);
  const total = slides.reduce((a, s) => a + s.seconds, 0);
  const by = elapsed - (before + (slides[index]?.seconds ?? 0));
  const state: Pace = before - elapsed > 20 ? "ahead" : by > 5 ? "behind" : "on";
  const template = { ahead: ui.present.paceAhead, behind: ui.present.paceBehind, on: ui.present.paceOn }[state];
  const text = fill(template, { t: mmss(Math.abs(state === "ahead" ? before - elapsed : by)), total: mmss(total) });
  return { elapsed, reset, state, text };
}

export function NotesPane({ slides, index, ask, onPrev, onNext, onOpenAudience }: {
  slides: DeckSlide[];
  index: number;
  ask: AskInfo;
  onPrev: () => void;
  onNext: () => void;
  onOpenAudience: () => void;
}) {
  const cur = slides[index];
  const next = slides[index + 1];
  const pace = usePace(slides, index);
  return (
    <aside className="deck-notes-pane on-dark">
      <div className="deck-np-top">
        <span className="deck-np-count">{index + 1} / {slides.length}</span>
        <button className="deck-np-timer" type="button" title={ui.present.resetTimer} aria-label={ui.present.resetTimer} onClick={pace.reset}>
          {mmss(pace.elapsed)}
        </button>
      </div>
      <p className="deck-np-pace" data-state={pace.state} role="status">{pace.text}</p>
      <div className="lbl">{ui.present.talkCue}</div>
      <p className="deck-np-cue">{cur.cue}</p>
      <p className="deck-np-notes">{cur.notes}</p>
      <div className="lbl">{ui.present.next}</div>
      <Stage className="deck-np-next" aria-hidden="true">
        <DeckSlides slides={slides} currentN={next?.n} ask={ask} />
      </Stage>
      {!next && <p className="deck-np-end">{ui.present.noNext}</p>}
      <div className="deck-np-btns">
        <button className="btn btn-ghost" type="button" onClick={onPrev}><ArrowLeft size={18} aria-hidden="true" /> {ui.page.previous}</button>
        <button className="btn btn-white" type="button" onClick={onNext}>{ui.present.next} <ArrowRight size={18} aria-hidden="true" /></button>
      </div>
      <button className="deck-see" type="button" onClick={onOpenAudience}>{ui.present.openAudience} →</button>
    </aside>
  );
}
