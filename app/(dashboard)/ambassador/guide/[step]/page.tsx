import Link from "next/link";
import { notFound } from "next/navigation";
import { STEPS, fill, getStep, stepHref, ui, AMBASSADOR_HOME } from "@/lib/ambassador/content";
import { loadAmbassadorPage } from "@/lib/ambassador/page";
import { nextAmbassadorSession } from "@/lib/ambassador/session";
import StepBody from "@/app/components/ambassador/step-body";
import StepDone from "@/app/components/ambassador/step-done";
import { StoryBuilder } from "@/app/components/ambassador/story";
import PracticeDeck from "@/app/components/ambassador/practice-deck";

/* One step of the guide — The Labs, The Conversation, Your Story, The Room,
   Practice. Every step has the same shape: ← Home · Step n of 5 · title · the
   one-line summary · the step · Done. Wide screens add the five steps as a
   sticky rail. The guide is open to anyone signed in: applicants waiting on
   their coordinator read ahead. */

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  const s = getStep(step);
  return { title: s ? `${s.title} · Ambassador guide` : "Ambassador guide", description: s?.summary };
}

export default async function GuideStepPage({ params }: { params: Promise<{ step: string }> }) {
  const { step: id } = await params;
  const step = getStep(id);
  if (!step) notFound();

  const [{ progress }, session] = await Promise.all([loadAmbassadorPage(), nextAmbassadorSession()]);
  const n = STEPS.findIndex((s) => s.id === id) + 1;

  return (
    <div className="amb-step-layout">
      <aside className="amb-rail" aria-label={ui.nav.steps}>
        <ol className="amb-steps">
          {STEPS.map((s, i) => (
            <li key={s.id}>
              <Link
                href={stepHref(s.id)}
                className={`amb-step${progress.done.includes(s.id) ? " is-done" : ""}${s.id === id ? " is-current" : ""}`}
                aria-current={s.id === id ? "page" : undefined}
              >
                <span className="amb-step-n">{progress.done.includes(s.id) ? "✓" : i + 1}</span>
                <span className="amb-step-t"><b>{s.title}</b></span>
              </Link>
            </li>
          ))}
        </ol>
      </aside>

      <div className="amb">
        <header className="amb-head">
          <Link className="amb-back" href={AMBASSADOR_HOME}>← {ui.nav.home}</Link>
          <p className="lbl lbl-teal">{fill(ui.step.of, { n, total: STEPS.length, min: step.readTime })}</p>
          <h1 className="t-h1 text-ink" style={{ marginTop: 6 }}>{step.title}</h1>
          <p className="t-lede">{step.summary}</p>
          {step.placeholder && <span className="amb-placeholder">{ui.page.placeholder}</span>}
        </header>

        <article>
          {id === "practice" && <PracticeDeck />}
          <StepBody body={step.body} stepId={step.id} session={session} />
          {id === "your-story" && <StoryBuilder />}
          <StepDone stepId={step.id} initialDone={progress.done} sticky={id !== "practice"} />
        </article>
      </div>
    </div>
  );
}
