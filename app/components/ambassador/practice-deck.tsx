"use client";

/* Practice — a card deck: read the situation, think, flip, rate.
   The first round is the core situations; "More situations" deals the rest.
   Reveal unlocks after a short think-first pause. Rate privately: swipe right
   / → "Had it", swipe left / ← "Not yet". "Not yet" cards come back first.
   Every gesture has a button and a key. Self-checks stay on this device
   (localStorage "ag.practice.v1") and are never shown as a score. */

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { fill, scenarios as rawScenarios, ui } from "@/lib/ambassador/content";
import {
  dealRound,
  hasMore,
  isRoundDone,
  swipeRating,
  visibleStack,
  type DeckCard,
  type SelfCheck,
  type SelfChecks,
} from "@/lib/ambassador/practice";
import "./practice-deck.css";

interface Scenario extends DeckCard {
  audience: string;
  mode: string;
  setup: string;
  goodResponse: string;
  why: string;
  placeholder?: boolean;
}

const SCENARIOS = rawScenarios as Scenario[];
const T = ui.practice;
const THINK_MS = 2500;
const LEAVE_MS = 280;
const STORAGE_KEY = "ag.practice.v1";

/* Same shape and failure handling as the prototype's store.ts: storage can be
   unavailable (private mode, blocked site data) and the deck must still work. */
function readChecks(): SelfChecks {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SelfChecks) : {};
  } catch {
    return {};
  }
}
function saveCheck(id: string, v: SelfCheck): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readChecks(), [id]: v }));
  } catch {
    /* storage unavailable: ratings simply aren't remembered */
  }
}

function label(map: Record<string, string>, key: string): string {
  return map[key] ?? key;
}

function Icon({ name, size }: { name: "close" | "eye" | "check"; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {name === "check" && <path d="m5 12.5 4.5 4.5L19 7.5" />}
      {name === "close" && <path d="M6 6l12 12M18 6 6 18" />}
      {name === "eye" && (
        <>
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

export default function PracticeDeck() {
  const [isCore, setIsCore] = useState(true);
  const [round, setRound] = useState<Scenario[]>(() => dealRound(SCENARIOS, {}, true));
  const [at, setAt] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [canFlip, setCanFlip] = useState(false);
  const [leaving, setLeaving] = useState<SelfCheck | null>(null);
  const [drag, setDrag] = useState<{ dx: number; active: boolean }>({ dx: 0, active: false });
  const [live, setLive] = useState("");
  const stateRef = useRef({ flipped, canFlip, leaving, round, at });
  const dragRef = useRef({ sx: 0, dx: 0, moved: false, active: false });
  const reduceRef = useRef(false);

  useEffect(() => {
    stateRef.current = { flipped, canFlip, leaving, round, at };
  });

  const deal = useCallback((core: boolean) => {
    setIsCore(core);
    setRound(dealRound(SCENARIOS, readChecks(), core));
    setAt(0);
    setFlipped(false);
    setCanFlip(false);
    setLeaving(null);
    setDrag({ dx: 0, active: false });
  }, []);

  // Once mounted, re-deal the core round so remembered "not yet" cards lead.
  useEffect(() => {
    reduceRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable on the client
    deal(true);
  }, [deal]);

  const done = isRoundDone(round, at);
  const top = done ? undefined : round[at];
  const topId = top?.id;

  // Think-first pause before Reveal unlocks; announce the situation.
  useEffect(() => {
    if (!topId) return;
    const card = round.find((c) => c.id === topId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- timer-driven unlock
    setLive(card?.setup ?? "");
    const id = window.setTimeout(() => setCanFlip(true), reduceRef.current ? 0 : THINK_MS);
    return () => window.clearTimeout(id);
  }, [topId, round]);

  const flip = useCallback(() => {
    const s = stateRef.current;
    const card = s.round[s.at];
    if (!card || !s.canFlip || s.leaving) return;
    const next = !s.flipped;
    setFlipped(next);
    if (next) setLive(card.goodResponse);
  }, []);

  const rate = useCallback((v: SelfCheck, fromDrag = false) => {
    const s = stateRef.current;
    const card = s.round[s.at];
    if (!card || !s.flipped || s.leaving) return;
    saveCheck(card.id, v);
    navigator.vibrate?.(8);
    setLeaving(v);
    if (!fromDrag) setDrag({ dx: 0, active: false });
    window.setTimeout(() => {
      setAt((a) => a + 1);
      setFlipped(false);
      setCanFlip(false);
      setLeaving(null);
      setDrag({ dx: 0, active: false });
    }, reduceRef.current ? 0 : LEAVE_MS);
  }, []);

  // Keys: Space/Enter flips (unless a button/link has focus), arrows rate.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === " " || e.key === "Enter") {
        if (!el?.closest("button, a")) {
          e.preventDefault();
          flip();
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        rate("had");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        rate("not");
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [flip, rate]);

  // Swipe on the top card.
  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!top || leaving) return;
    const card = (e.target as HTMLElement).closest(".pd-card");
    if (!card || card.getAttribute("data-top") !== "true") return;
    dragRef.current = { sx: e.clientX, dx: 0, moved: false, active: true };
    setDrag({ dx: 0, active: true });
    card.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d.active) return;
    d.dx = e.clientX - d.sx;
    if (Math.abs(d.dx) > 6) d.moved = true;
    setDrag({ dx: d.dx, active: true });
  }
  function onPointerEnd() {
    const d = dragRef.current;
    if (!d.active) return;
    d.active = false;
    if (!d.moved) {
      setDrag({ dx: 0, active: false });
      flip();
      return;
    }
    const v = flipped ? swipeRating(d.dx) : null;
    if (v) {
      setDrag({ dx: d.dx * 4, active: false });
      rate(v, true);
    } else {
      setDrag({ dx: 0, active: false });
    }
  }

  function cardStyle(k: number): React.CSSProperties {
    const style: React.CSSProperties = { zIndex: 10 - k };
    if (k !== 0) return style;
    if (leaving) {
      const dir = leaving === "had" ? 1 : -1;
      style.opacity = 0;
      style.transform = drag.dx
        ? `translateX(${drag.dx}px) rotate(${drag.dx / 8}deg)`
        : `translateX(${dir * 140}%) rotate(${dir * 18}deg)`;
    } else if (drag.dx) {
      style.transform = flipped ? `translateX(${drag.dx}px) rotate(${drag.dx / 18}deg)` : `translateX(${drag.dx * 0.15}px)`;
    }
    return style;
  }
  const stamp = (side: 1 | -1): number =>
    flipped && drag.active ? Math.max(0, Math.min(1, (side * drag.dx) / SWIPE_VISUAL)) : 0;

  const stack = visibleStack(round, at);
  const position = fill(T.position, { n: at + 1, total: round.length });

  return (
    <section className="pd" aria-label={T.card}>
      <p className="pd-count">{done ? "" : position}</p>

      <div
        className="pd-stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        {/* Painted back-to-front so the top card sits last in the DOM order
            of focusable things, but z-index keeps it visually first. */}
        {stack.map((s, k) => {
          const isTop = k === 0;
          const cls = [
            "pd-card",
            k ? `back${k}` : "",
            isTop && !canFlip && !leaving ? "thinking" : "",
            isTop && flipped ? "flipped" : "",
            isTop && drag.active ? "dragging" : "",
            isTop && leaving ? "gone" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <article
              key={s.id}
              className={cls}
              data-top={isTop ? "true" : undefined}
              style={cardStyle(k)}
              aria-roledescription={T.card}
              aria-hidden={isTop ? undefined : true}
              tabIndex={isTop ? 0 : -1}
            >
              <span className="pd-stamp had" aria-hidden="true" style={isTop ? { opacity: stamp(1) } : undefined}>{T.had}</span>
              <span className="pd-stamp not" aria-hidden="true" style={isTop ? { opacity: stamp(-1) } : undefined}>{T.notYet}</span>
              <div className="pd-flip">
                <div className="pd-face pd-front" aria-hidden={isTop && flipped ? true : undefined}>
                  <div className="pd-body">
                    <p className="pd-kicker">{label(T.modes, s.mode)} · {label(T.audiences, s.audience)}</p>
                    <p className="pd-setup">{s.setup}</p>
                    <p className="pd-hint">
                      <span>{T.prompt}</span>
                      <span className="pd-bar" aria-hidden="true"><i /></span>
                    </p>
                  </div>
                </div>
                <div className="pd-face pd-back" aria-hidden={isTop && flipped ? undefined : true}>
                  <div className="pd-body">
                    <p className="pd-label">{T.example}</p>
                    <p className="pd-answer">{s.goodResponse}</p>
                    <p className="pd-label">{T.why}</p>
                    <p className="pd-why">{s.why}</p>
                    {s.placeholder && <span className="pd-placeholder">{ui.page.placeholder}</span>}
                  </div>
                </div>
              </div>
            </article>
          );
        })}

        {done && (
          <div className="pd-done">
            <h2 className="t-h2">{T.roundTitle}</h2>
            <p className="t-body">{T.roundBody}</p>
            {isCore && hasMore(SCENARIOS) && (
              <button className="btn btn-ghost btn-block" type="button" onClick={() => deal(false)}>
                {T.more}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="pd-actions" hidden={done}>
        <span className="pd-btn-label">
          <button className="pd-btn" type="button" aria-label={T.notYet} disabled={!flipped || !!leaving} onClick={() => rate("not")}>
            <Icon name="close" size={26} />
          </button>
          {T.notYet}
        </span>
        <span className="pd-btn-label">
          <button className="pd-btn big" type="button" aria-label={flipped ? T.flipBack : T.reveal} disabled={!canFlip || !!leaving} onClick={flip}>
            <Icon name="eye" size={30} />
          </button>
          <span>{flipped ? T.flipBack : T.reveal}</span>
        </span>
        <span className="pd-btn-label">
          <button className="pd-btn had" type="button" aria-label={T.had} disabled={!flipped || !!leaving} onClick={() => rate("had")}>
            <Icon name="check" size={28} />
          </button>
          {T.had}
        </span>
      </div>
      <p className="pd-keys">{T.keys}</p>
      <p className="pd-sr" aria-live="polite">{done ? "" : `${position}. ${live}`}</p>
    </section>
  );
}

/** Drag distance at which the Had it / Not yet stamp reaches full strength. */
const SWIPE_VISUAL = 110;
