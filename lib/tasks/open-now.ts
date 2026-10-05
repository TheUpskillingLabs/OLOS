/* "Still open" — the between-cycles list of things worth doing now (#412;
   docs/requirements/between-cycles-dashboard.md §2).

   Every row comes from live data and disappears when its source is empty;
   the Learning Library row is always last, so the list is never empty and
   never a dead end. Rows are not dismissible: they come and go with their
   source. Pure module: no Supabase. */

import type { Task } from "./types";
import { PRIORITY, TASK_COPY } from "./definitions";
import { openNowTaskKey } from "./keys";
import { fmtDate } from "@/lib/content/format";

export interface OpenNowInputs {
  /** Upcoming public events, soonest first (the wrapper filters to the next
      30 days); at most two are shown. */
  events: { slug: string; name: string; start_at: string; location_name: string | null }[];
  /** The most recent finished open cycle, for "See what {cycle} built". */
  lookBackCycle: { id: number; name: string } | null;
  /** An open field survey. */
  openSurvey: { share_slug: string; title: string } | null;
  /** The newest published member story with a slug. */
  story: { slug: string; name: string } | null;
}

export const OPEN_NOW_MAX_EVENTS = 2;

export function buildOpenNowRows(input: OpenNowInputs): Task[] {
  const copy = TASK_COPY.openNow;
  const rows: Task[] = [];
  const base = (
    defId: string,
    instanceKey: string,
    title: string,
    href: string,
    cta: string,
    detail?: string
  ): Task => ({
    defId,
    kind: "open_now",
    instanceKey,
    title,
    detail,
    href,
    cta,
    deadline: null,
    priority: PRIORITY.openNowBase + rows.length,
    tone: "default",
    blocking: false,
    dismissible: false,
    done: false,
    surface: "open_now",
  });

  for (const e of input.events.slice(0, OPEN_NOW_MAX_EVENTS)) {
    const when = fmtDate(e.start_at);
    rows.push(
      base(
        "open_now:event",
        openNowTaskKey("event", e.slug),
        e.name,
        `/events/${e.slug}`,
        copy.event.cta,
        e.location_name ? `${when} · ${e.location_name}` : when
      )
    );
  }
  rows.push(
    base(
      "open_now:events",
      openNowTaskKey("event"),
      copy.allEvents.title,
      "/events",
      copy.allEvents.cta,
      copy.allEvents.detail
    )
  );
  if (input.lookBackCycle) {
    rows.push(
      base(
        "open_now:look_back",
        openNowTaskKey("look_back", input.lookBackCycle.id),
        copy.lookBack.title(input.lookBackCycle.name),
        `/cycles/${input.lookBackCycle.id}`,
        copy.lookBack.cta,
        copy.lookBack.detail
      )
    );
  }
  if (input.openSurvey) {
    rows.push(
      base(
        "open_now:survey",
        openNowTaskKey("survey", input.openSurvey.share_slug),
        copy.survey.title,
        `/survey/${input.openSurvey.share_slug}`,
        copy.survey.cta,
        copy.survey.detail
      )
    );
  }
  if (input.story) {
    rows.push(
      base(
        "open_now:story",
        openNowTaskKey("story", input.story.slug),
        copy.story.title(input.story.name),
        `/stories/${input.story.slug}`,
        copy.story.cta,
        copy.story.detail
      )
    );
  }
  rows.push(
    base(
      "open_now:library",
      openNowTaskKey("library"),
      copy.library.title,
      "/learning",
      copy.library.cta,
      copy.library.detail
    )
  );
  return rows;
}
