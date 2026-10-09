"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { STEPS, fill, stepHref, ui, AMBASSADOR_HOME } from "@/lib/ambassador/content";

/* The step page's one primary action: Done. It records the step, then opens
   a short "done" dialog — what you finished, the five dots, and one button
   onward (the next unfinished step, or Home and "You're ready" once all five
   are done). Esc or a backdrop click stays on the page. */
export default function StepDone({
  stepId,
  initialDone,
  sticky = true,
}: {
  stepId: string;
  initialDone: string[];
  sticky?: boolean;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [done, setDone] = useState<Set<string>>(new Set(initialDone));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const i = STEPS.findIndex((s) => s.id === stepId);
  const step = STEPS[i];
  const after = STEPS[i + 1];
  // Onward: the next unfinished step after this one, else any unfinished one.
  const order = [...STEPS.slice(i + 1), ...STEPS.slice(0, i)];
  const next = order.find((s) => !done.has(s.id)) ?? null;
  const count = STEPS.filter((s) => done.has(s.id)).length;

  const onDone = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/ambassadors/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step_id: stepId }),
    }).catch(() => null);
    setBusy(false);
    const json = res ? await res.json().catch(() => null) : null;
    if (!res?.ok || !json) {
      setError(json?.error ?? "Couldn't save that. Try again.");
      return;
    }
    setDone(new Set(json.done as string[]));
    router.refresh();
    if (dialog.current && typeof dialog.current.showModal === "function") dialog.current.showModal();
  };

  return (
    <>
      <div className={`amb-actionbar${sticky ? "" : " is-static"}`}>
        <span className="amb-actionbar-info">
          <span className="lbl">{after ? ui.step.next : ui.step.last}</span>
          <b>{after ? after.title : ui.step.pin}</b>
        </span>
        <button className="btn btn-teal" type="button" onClick={onDone} disabled={busy}>
          {ui.step.done} →
        </button>
      </div>
      {error && <p className="amb-error" role="alert">{error}</p>}

      <dialog
        ref={dialog}
        className="amb-dialog"
        aria-labelledby="done-title"
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current?.close();
        }}
      >
        <p className="lbl lbl-teal">{fill(ui.done.kicker, { n: i + 1, total: STEPS.length })}</p>
        <h2 id="done-title" className="t-h2" style={{ marginTop: 6 }}>
          {next ? fill(ui.done.title, { title: step.title }) : ui.done.lastTitle}
        </h2>
        <ol className="amb-dots" role="img" aria-label={fill(ui.done.progress, { n: count, total: STEPS.length })}>
          {STEPS.map((s) => (
            <li key={s.id} className={done.has(s.id) ? "on" : ""} />
          ))}
        </ol>
        {next ? (
          <div className="amb-panel">
            <span className="lbl">{ui.done.upNext}</span>
            <b style={{ display: "block", marginTop: 4 }}>{next.title}</b>
            <span className="t-small">{fill(ui.done.nextMeta, { min: next.readTime })}</span>
          </div>
        ) : (
          <div className="amb-panel" style={{ display: "flex", gap: 14, alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ambassador/button-400.webp" alt={ui.done.pinAlt} width={64} height={64} />
            <span>
              <strong>{ui.done.pinKicker}</strong>
              <br />
              {ui.done.pinBody}
            </span>
          </div>
        )}
        <a className="btn btn-teal btn-block" style={{ marginTop: 18 }} href={next ? stepHref(next.id) : AMBASSADOR_HOME} autoFocus>
          {next ? fill(ui.done.next, { title: next.title }) : ui.done.toHome} →
        </a>
        <p style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
          {next ? <a className="amb-linkbtn" href={AMBASSADOR_HOME}>{ui.done.home}</a> : <span />}
          <button type="button" className="amb-linkbtn" onClick={() => dialog.current?.close()}>
            {ui.done.stay}
          </button>
        </p>
      </dialog>
    </>
  );
}
