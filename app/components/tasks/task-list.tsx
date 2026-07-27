"use client";

import { useEffect, useState } from "react";
import type { Task } from "@/lib/tasks/types";
import { windowTaskKey, surveyShareTaskKey } from "@/lib/tasks/keys";
import type { WindowKey } from "@/lib/cycles/windows";
import { CYCLE_WINDOWS } from "@/lib/cycles/windows";
import TaskCard, { spansGrid } from "./task-card";

/* The Up-next queue — ONE component tree serving both breakpoints
   (app/components/tasks/CLAUDE.md): a horizontal snap-scroll strip on
   phones, a 2-col grid on md+, switched purely in CSS. The same tasks in
   the same order on every form factor, by construction — this replaces the
   old desktop-only UpNext cards + the separately hand-built mobile strip.

   Dismissals are DB-persisted (task_dismissals via POST /api/tasks/dismiss).
   The server already filtered dismissed tasks before render, so there is no
   read-localStorage-before-paint flash guard anymore — SSR renders the true
   list; dismissing removes optimistically and posts in the background. */

const LEGACY_KEYS = [
  "olos.dismissedTodos.v1",
  "olos.whatsNextDismissed.v1",
  "olos.setupChecklistClicked.v1",
] as const;

async function postDismissal(taskKey: string): Promise<void> {
  try {
    await fetch("/api/tasks/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_key: taskKey }),
    });
  } catch {
    /* best effort — the card is already hidden locally; worst case it
       reappears next visit */
  }
}

/** One-time migration of the legacy localStorage dismissal store: the old
    bare ids ("voting", "share-survey") map onto occurrence keys for the
    CURRENT cycle/survey (the only occurrence they could have meant), get
    POSTed to the DB store, and the legacy keys are deleted. The
    what's-next and Slack-clicked stores start fresh (weekly auto-expiry /
    one extra click). Delete this shim a cycle after it ships. */
function migrateLegacyDismissals(
  activeCycleId: number | null,
  surveyId: number | null,
  hideLocally: (keys: string[]) => void
): void {
  try {
    const raw = localStorage.getItem(LEGACY_KEYS[0]);
    if (raw) {
      const ids = JSON.parse(raw) as string[];
      const windowKeys = new Set(CYCLE_WINDOWS.map((w) => w.key as string));
      const mapped: string[] = [];
      for (const id of ids) {
        if (windowKeys.has(id) && activeCycleId != null) {
          mapped.push(windowTaskKey(id as WindowKey, activeCycleId));
        } else if (id === "share-survey" && surveyId != null) {
          mapped.push(surveyShareTaskKey(surveyId));
        }
      }
      if (mapped.length > 0) {
        hideLocally(mapped);
        void Promise.all(mapped.map(postDismissal));
      }
    }
    for (const k of LEGACY_KEYS) localStorage.removeItem(k);
  } catch {
    /* no store — nothing to migrate */
  }
}

export default function TaskList({
  tasks,
  activeCycleId = null,
  surveyId = null,
  heading = "Up next",
}: {
  /** Queue tasks, pre-sorted and pre-filtered of DB-dismissed keys. */
  tasks: Task[];
  /** For the legacy localStorage migration shim. */
  activeCycleId?: number | null;
  surveyId?: number | null;
  heading?: string;
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    migrateLegacyDismissals(activeCycleId, surveyId, (keys) =>
      setDismissed((prev) => new Set([...prev, ...keys]))
    );
  }, [activeCycleId, surveyId]);

  const dismiss = (task: Task) => {
    setDismissed((prev) => new Set(prev).add(task.instanceKey));
    void postDismissal(task.instanceKey);
  };

  const visible = tasks.filter((t) => !dismissed.has(t.instanceKey));
  if (visible.length === 0) return null;

  return (
    <section className="mb-8" aria-label={heading}>
      <h2 className="t-h3 mb-4 text-ink max-md:sr-only">{heading}</h2>
      <ul className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 md:mx-0 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:p-0">
        {visible.map((t) => (
          <li
            key={t.instanceKey}
            className={`w-64 shrink-0 snap-start md:w-auto md:shrink ${
              spansGrid(t) ? "md:col-span-2" : ""
            }`}
          >
            <TaskCard task={t} onDismiss={t.dismissible ? dismiss : undefined} />
          </li>
        ))}
      </ul>
    </section>
  );
}
