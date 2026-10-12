"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AMBASSADOR_HOME, AMBASSADOR_PRESENT, deck, ui } from "@/lib/ambassador/content";
import type { AmbassadorSession } from "@/lib/ambassador/session";
import { DeckSlides, type AskInfo } from "./deck-slides";
import { NotesPane } from "./notes-pane";
import { Stage } from "./stage";
import "./deck.css";

const CHANNEL = "ag-deck";
const NEXT_KEYS = ["ArrowRight", "ArrowDown", "PageDown", " ", "Enter", "n", "N"];
const PREV_KEYS = ["ArrowLeft", "ArrowUp", "PageUp", "Backspace", "p", "P"];

type Blank = "" | "black" | "white";

function askInfo(s: AmbassadorSession | undefined): AskInfo {
  if (!s) return { day: ui.present.comingSoon, where: "", expect: deck.askFallback, joinDate: ui.present.comingSoon };
  return {
    day: s.day,
    where: `${s.time} · ${s.place}`,
    expect: s.expect || deck.askFallback,
    joinDate: `${s.title} · ${s.day}, ${s.time}`,
  };
}

export function DeckClient({ sessions, short, notes, practice }: {
  sessions: AmbassadorSession[];
  short: boolean;
  notes: boolean;
  practice: boolean;
}) {
  const slides = useMemo(() => (short ? deck.slides.filter((s) => deck.shortSlides.includes(s.n)) : deck.slides), [short]);
  const ask = askInfo(sessions[0]);
  const [i, setI] = useState(0);
  const [blank, setBlank] = useState<Blank>("");
  const [controlsOn, setControlsOn] = useState(true);
  const [cuesOpen, setCuesOpen] = useState(false);
  const [canFs, setCanFs] = useState(false);
  const channel = useRef<BroadcastChannel | null>(null);
  const helpRef = useRef<HTMLDialogElement>(null);
  const idle = useRef<number | undefined>(undefined);
  const digits = useRef("");
  const swiped = useRef(false);
  const touch = useRef({ x: 0, y: 0, t: 0 });

  const last = slides.length - 1;
  const cur = slides[Math.min(i, last)];

  const show = useCallback((n: number, broadcast = true) => {
    const k = Math.max(0, Math.min(last, n));
    setI(k);
    history.replaceState(null, "", `${location.pathname}${location.search}#${slides[k].n}`);
    if (broadcast) channel.current?.postMessage({ type: "go", n: slides[k].n });
  }, [last, slides]);

  const wake = useCallback(() => {
    setControlsOn(true);
    window.clearTimeout(idle.current);
    idle.current = window.setTimeout(() => setControlsOn(false), 2500);
  }, []);

  const toggleFs = useCallback(() => {
    if (!document.fullscreenEnabled) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  }, []);

  const clearBlank = () => setBlank("");
  const toggleBlank = (mode: "black" | "white") => setBlank((b) => (b === mode ? "" : mode));

  // On mount: pick the slide from the hash, open the channel, learn about fullscreen.
  useEffect(() => {
    const fromHash = Number(location.hash.slice(1));
    const at = slides.findIndex((s) => s.n === fromHash);
    /* eslint-disable react-hooks/set-state-in-effect */
    if (at >= 0) setI(at);
    setCanFs(Boolean(document.fullscreenEnabled));
    /* eslint-enable react-hooks/set-state-in-effect */
    wake();
    if (!("BroadcastChannel" in window)) return;
    const ch = new BroadcastChannel(CHANNEL);
    channel.current = ch;
    // Windows on the same device stay in sync, so ?notes on a laptop drives the audience window.
    ch.onmessage = (e: MessageEvent<{ type?: string; n?: number }>) => {
      if (e.data?.type !== "go") return;
      const k = slides.findIndex((s) => s.n === e.data.n);
      // A ?short window ignores slides it doesn't have.
      if (k >= 0) {
        setI(k);
        history.replaceState(null, "", `${location.pathname}${location.search}#${e.data.n}`);
      }
    };
    return () => {
      ch.close();
      channel.current = null;
      window.clearTimeout(idle.current);
    };
  }, [slides, wake]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || helpRef.current?.open) return;
      const k = e.key;
      if (k === "Escape") {
        // The browser handles Esc itself while fullscreen; otherwise it leaves the deck.
        if (blank) clearBlank();
        else if (!document.fullscreenElement) window.location.assign(AMBASSADOR_HOME);
        return;
      }
      if (/^[0-9]$/.test(k)) { digits.current += k; return; }
      if (k === "Enter" && digits.current) {
        e.preventDefault();
        const want = Number(digits.current);
        const at = slides.findIndex((s) => s.n === want);
        show(at >= 0 ? at : Math.min(slides.length, want) - 1);
        digits.current = "";
        clearBlank();
        return;
      }
      digits.current = "";
      if (k === "b" || k === "B" || k === ".") { toggleBlank("black"); return; }
      if (k === "w" || k === "W" || k === ",") { toggleBlank("white"); return; }
      if (k === "?") { helpRef.current?.showModal(); return; }
      if (blank) clearBlank();
      if (NEXT_KEYS.includes(k)) {
        if (k === "Enter" && (e.target as HTMLElement).closest("button, a")) return;
        e.preventDefault(); show(i + 1);
      } else if (PREV_KEYS.includes(k)) {
        e.preventDefault(); show(i - 1);
      } else if (k === "Home") { e.preventDefault(); show(0); }
      else if (k === "End") { e.preventDefault(); show(last); }
      else if (k === "f" || k === "F") toggleFs();
      wake();
    };
    const onMove = (e: PointerEvent) => { if (e.pointerType === "mouse") wake(); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointermove", onMove);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointermove", onMove);
    };
  }, [i, blank, last, slides, show, toggleFs, wake]);

  const openAudience = () => {
    window.open(`${AMBASSADOR_PRESENT}${short ? "?short" : ""}#${cur.n}`, "ag-audience");
  };

  const counter = <span className="deck-hint-n">{i + 1} / {slides.length}</span>;
  const mode = `${notes ? " deck-mode-notes" : ""}${practice ? " deck-mode-practice" : ""}${controlsOn ? " deck-controls-on" : ""}`;

  return (
    <div className={`deck-root${mode}`}>
      <div className="deck-shell">
        <Stage
          aria-live="polite"
          onPointerDown={(e) => { touch.current = { x: e.clientX, y: e.clientY, t: Date.now() }; swiped.current = false; }}
          onPointerUp={(e) => {
            const dx = e.clientX - touch.current.x, dy = e.clientY - touch.current.y;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) && Date.now() - touch.current.t < 800) {
              swiped.current = true;
              show(dx < 0 ? i + 1 : i - 1);
            }
          }}
          onClick={(e) => {
            wake();
            if (swiped.current) return;
            const r = e.currentTarget.getBoundingClientRect();
            show(e.clientX - r.left < r.width / 3 ? i - 1 : i + 1);
          }}
        >
          <DeckSlides slides={slides} currentN={cur.n} ask={ask} hideInactive />
        </Stage>

        {practice && (
          <section className="deck-practice-cue">
            <div className="lbl">{ui.present.talkCue}</div>
            <p className="deck-pc-cue">{cur.cue}</p>
            <p className="deck-pc-notes">{cur.notes}</p>
          </section>
        )}

        {notes && (
          <NotesPane slides={slides} index={i} ask={ask} onPrev={() => show(i - 1)} onNext={() => show(i + 1)} onOpenAudience={openAudience} />
        )}

        {cuesOpen && !notes && !practice && (
          <section className="deck-cue-sheet">
            <div className="lbl">{counter} · {ui.present.talkCue}</div>
            <p className="deck-pc-cue">{cur.cue}</p>
          </section>
        )}

        <div className="deck-controls" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
          <Link className="deck-ctl" href={AMBASSADOR_HOME}>{ui.present.exit}</Link>
          <button className="deck-ctl deck-toggle-cues" type="button" aria-pressed={cuesOpen} onClick={() => setCuesOpen((v) => !v)}>
            {ui.present.cues}
          </button>
          {canFs && <button className="deck-ctl" type="button" onClick={toggleFs}>{ui.present.fullscreen}</button>}
          <button className="deck-ctl" type="button" aria-label={ui.present.keys} onClick={() => helpRef.current?.showModal()}>?</button>
        </div>

        {blank && <div className="deck-blank" data-mode={blank} onClick={clearBlank} />}

        <dialog ref={helpRef} className="deck-keys" aria-labelledby="deck-keys-h">
          <h2 id="deck-keys-h" className="t-h3">{ui.present.keys}</h2>
          <dl className="deck-keys-list">
            {ui.present.keyListItems.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
          <form method="dialog"><button className="btn btn-ink btn-sm">{ui.present.close}</button></form>
        </dialog>

        <p className="deck-hint">{counter} · {ui.present.hint}</p>
      </div>
    </div>
  );
}
