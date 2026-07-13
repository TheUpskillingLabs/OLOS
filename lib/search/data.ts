/**
 * Global search corpus fetch — the single place visibility guards and
 * column allowlists live. Server-only (service client).
 *
 * Reads go through the SERVICE client with the same display-column
 * allowlist posture as /directory (the "00044 decision"): participants RLS
 * never widens, no PII column is selected, and every visibility rule is
 * applied manually here:
 *
 *   participants  is_test=false · is_staff=false · archived_at IS NULL
 *   pods          status IN (forming, active)   — dissolved/inactive are history
 *   projects      status IN (forming, active)   — inactive = owner-archived
 *   events        status = published            — archived events 404 (mandatory)
 *   metros (labs) archived_at IS NULL           — waitlist labs stay listed
 *   cycles        mode = open · status ≠ draft  — org cycles are internal
 *
 * With `q` set (the suggest path) each query is ilike-filtered and capped
 * at SUGGEST_FETCH_LIMITS; without it (the /search page) the full slim
 * corpus is returned. Failed sub-queries are logged and skipped — partial
 * results beat a 500 on a read-aggregation surface.
 */

import { createServiceClient } from "@/lib/supabase/server";
import {
  cycleDoc,
  eventDoc,
  labDoc,
  personDoc,
  podDoc,
  projectDoc,
  type CycleRow,
  type EventRow,
  type MetroRow,
  type PersonRow,
  type PodRow,
  type ProjectRow,
} from "./mappers";
import { SUGGEST_FETCH_LIMITS } from "./order";
import type { SearchCorpus } from "./types";

export interface FetchSearchDocsOptions {
  /** Pre-sanitized query (sanitizeQuery) — when set, queries are ilike-
   *  filtered and capped for the typeahead. */
  q?: string;
  /** "Now" for the upcoming/past event split; defaults to Date.now(). */
  nowMs?: number;
}

export async function fetchSearchDocs(
  opts: FetchSearchDocsOptions = {}
): Promise<SearchCorpus> {
  const { q } = opts;
  const nowMs = opts.nowMs ?? Date.now();
  const like = q ? `%${q}%` : null;
  const service = createServiceClient();

  let people = service
    .from("participants")
    .select(
      "id, handle, preferred_name, first_name, last_name, headline, profile_image_url, created_at"
    )
    .eq("is_test", false)
    .eq("is_staff", false)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (like) {
    people = people
      .or(
        `preferred_name.ilike.${like},first_name.ilike.${like},last_name.ilike.${like},headline.ilike.${like}`
      )
      .limit(SUGGEST_FETCH_LIMITS.person);
  }

  let pods = service
    .from("pods")
    .select("id, name, status, created_at, problem_statements(statement_text)")
    .in("status", ["forming", "active"])
    .order("status", { ascending: true }) // "active" < "forming"
    .order("created_at", { ascending: false });
  if (like) {
    pods = pods.ilike("name", like).limit(SUGGEST_FETCH_LIMITS.pod);
  }

  let projects = service
    .from("projects")
    .select("id, name, status, created_at, solution_proposals(name)")
    .in("status", ["forming", "active"])
    .order("status", { ascending: true })
    .order("created_at", { ascending: false });
  if (like) {
    projects = projects.ilike("name", like).limit(SUGGEST_FETCH_LIMITS.project);
  }

  let events = service
    .from("events")
    .select(
      "id, slug, name, kind, start_at, end_at, location_type, location_name, host"
    )
    .eq("status", "published")
    // Recent/upcoming first so a capped fetch window prefers what members
    // are actually looking for; orderKey re-splits upcoming vs past.
    .order("start_at", { ascending: false });
  if (like) {
    events = events
      .or(
        `name.ilike.${like},location_name.ilike.${like},host.ilike.${like},kind.ilike.${like}`
      )
      .limit(SUGGEST_FETCH_LIMITS.event);
  }

  let labs = service
    .from("metros")
    .select("id, slug, name, st, status, blurb, partner")
    .is("archived_at", null)
    .order("status", { ascending: true }) // "active" < "waitlist"
    .order("name", { ascending: true });
  if (like) {
    labs = labs
      .or(`name.ilike.${like},blurb.ilike.${like},partner.ilike.${like}`)
      .limit(SUGGEST_FETCH_LIMITS.lab);
  }

  let cycles = service
    .from("cycles")
    .select("id, name, slug, status, start_date, description, what_you_build")
    .eq("mode", "open")
    .neq("status", "draft")
    .order("start_date", { ascending: false });
  if (like) {
    cycles = cycles
      .or(
        `name.ilike.${like},slug.ilike.${like},description.ilike.${like},what_you_build.ilike.${like}`
      )
      .limit(SUGGEST_FETCH_LIMITS.cycle);
  }

  const [peopleRes, podsRes, projectsRes, eventsRes, labsRes, cyclesRes] =
    await Promise.all([people, pods, projects, events, labs, cycles]);

  for (const [label, res] of [
    ["participants", peopleRes],
    ["pods", podsRes],
    ["projects", projectsRes],
    ["events", eventsRes],
    ["metros", labsRes],
    ["cycles", cyclesRes],
  ] as const) {
    if (res.error) {
      console.error(`[search] ${label} query failed:`, res.error.message);
    }
  }

  return {
    person: ((peopleRes.data ?? []) as PersonRow[]).map(personDoc),
    pod: ((podsRes.data ?? []) as unknown as PodRow[]).map(podDoc),
    project: ((projectsRes.data ?? []) as unknown as ProjectRow[]).map(
      projectDoc
    ),
    event: ((eventsRes.data ?? []) as EventRow[]).map((row) =>
      eventDoc(row, nowMs)
    ),
    lab: ((labsRes.data ?? []) as MetroRow[]).map(labDoc),
    cycle: ((cyclesRes.data ?? []) as CycleRow[]).map(cycleDoc),
  };
}
