import type { SupabaseClient } from "@supabase/supabase-js";

/* Luma events integration (backend doc §3) — server-side only. LUMA_API_KEY
   must never reach the client; that is why the prototype shipped mock data.

   Luma is the source of truth for ALL events (owner decision, July 2026):
   the events table is a cache of the Luma calendar, and the site never
   invents events Luma doesn't have. Concretely:
   - Luma owns existence + the fields it knows: name, times, location,
     cover image, event URL, and the initial description.
   - OLOS keeps local presentation annotations layered on Luma rows — slug
     (the URL), kind/anchor tagging, grad, cost/host display, editorial
     body/gallery. The sync NEVER overwrites those, so ✦ anchors and edited
     copy survive every run.
   - Reconciliation: a published FUTURE event missing from a successful
     fetch was cancelled or unlisted on Luma — it gets archived here (past
     rows stay as history; Luma's listing may not include them).
   - RSVPs taken on the site are forwarded to Luma as guests (addLumaGuest)
     so attendance, confirmations, and calendar invites live in Luma.

   The API base is overridable because the Luma reference 403'd automated
   fetching during planning (backend doc §1.6) — if the documented base is
   wrong, fix it with an env var instead of a deploy. */

const LUMA_API_BASE =
  process.env.LUMA_API_BASE || "https://public-api.luma.com/v1";

// Luma's documented list-events shape, held loosely: entries may nest the
// event under .event or be the event itself.
interface LumaEvent {
  api_id: string;
  name: string;
  description?: string | null;
  start_at: string; // ISO 8601 UTC instant
  end_at?: string | null;
  timezone?: string | null;
  cover_url?: string | null;
  url?: string | null;
  meeting_url?: string | null;
  geo_address_json?: {
    name?: string | null;
    place_name?: string | null;
    full_address?: string | null;
    address?: string | null;
    city?: string | null;
  } | null;
}

export function lumaEnabled(): boolean {
  return Boolean(process.env.LUMA_API_KEY);
}

async function lumaGet(path: string): Promise<unknown> {
  const res = await fetch(`${LUMA_API_BASE}${path}`, {
    headers: {
      accept: "application/json",
      "x-luma-api-key": process.env.LUMA_API_KEY as string,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Luma API ${res.status} on ${path}: ${body.slice(0, 300)}`
    );
  }
  return res.json();
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/* Fetch every event on the calendar, following pagination. Returns the raw
   Luma event objects. */
export async function fetchLumaEvents(): Promise<LumaEvent[]> {
  const events: LumaEvent[] = [];
  let cursor: string | null = null;

  // 200 req/min rate limit is far above anything a paginated listing needs;
  // the page cap is a runaway guard, not a throughput concern.
  for (let page = 0; page < 50; page++) {
    const qs = new URLSearchParams({ pagination_limit: "100" });
    if (cursor) qs.set("pagination_cursor", cursor);
    const data = asRecord(await lumaGet(`/calendar/list-events?${qs}`));
    if (!data) break;

    const entries = Array.isArray(data.entries) ? data.entries : [];
    for (const entry of entries) {
      const rec = asRecord(entry);
      if (!rec) continue;
      const ev = asRecord(rec.event) ?? rec; // nested or flat
      if (typeof ev.api_id === "string" && typeof ev.name === "string") {
        events.push(ev as unknown as LumaEvent);
      }
    }

    cursor = typeof data.next_cursor === "string" ? data.next_cursor : null;
    if (!data.has_more || !cursor) break;
  }

  return events;
}

/* The events table stores local wall time rendered as written (00033);
   Luma sends UTC instants plus the event's IANA timezone. */
export function toWallTime(iso: string, timezone?: string | null): string {
  const tz = timezone || "America/New_York";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "event"
  );
}

function locationOf(ev: LumaEvent): {
  location_type: "in_person" | "virtual";
  location_name: string;
} {
  const geo = ev.geo_address_json;
  if (geo) {
    const name =
      geo.name || geo.place_name || geo.full_address || geo.address || geo.city;
    if (name) return { location_type: "in_person", location_name: name };
  }
  return { location_type: "virtual", location_name: "Online" };
}

// A short plain lede for rows the sync creates (the detail page's t-lede);
// editors refine it later. Cut at a sentence or word boundary.
function ledeOf(description?: string | null): string | null {
  if (!description) return null;
  const text = description.replace(/\s+/g, " ").trim();
  if (text.length <= 280) return text || null;
  const cut = text.slice(0, 280);
  const sentence = cut.lastIndexOf(". ");
  return sentence > 120 ? cut.slice(0, sentence + 1) : `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

const GRAD_ROTATION = ["m-teal", "m-forest", "m-navy"];

/* Forward a site RSVP to Luma so the guest list lives there. Callers treat
   this as best-effort: the local event_rsvps row is already saved, and a
   Luma hiccup must never cost someone their spot. Members register with
   their real name; the registration parity rule (owner decision) is that
   only signed-in members take this path — they signed the Participant
   Agreement (photo clause included) at signup, so skipping Luma's
   registration questions is legitimate for them and only them. */
export async function addLumaGuest(
  eventApiId: string,
  email: string,
  name?: string
): Promise<void> {
  const res = await fetch(`${LUMA_API_BASE}/event/add-guests`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-luma-api-key": process.env.LUMA_API_KEY as string,
    },
    body: JSON.stringify({
      event_api_id: eventApiId,
      guests: [name ? { email, name } : { email }],
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Luma add-guests ${res.status} for ${eventApiId}: ${body.slice(0, 300)}`
    );
  }
}

/* Pull an event's guest list (paginated, defensive shape like list-events). */
export async function fetchLumaGuests(
  eventApiId: string
): Promise<{ email: string; approval_status: string | null }[]> {
  const guests: { email: string; approval_status: string | null }[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < 50; page++) {
    const qs = new URLSearchParams({
      event_api_id: eventApiId,
      pagination_limit: "100",
    });
    if (cursor) qs.set("pagination_cursor", cursor);
    const data = asRecord(await lumaGet(`/event/get-guests?${qs}`));
    if (!data) break;

    const entries = Array.isArray(data.entries) ? data.entries : [];
    for (const entry of entries) {
      const rec = asRecord(entry);
      if (!rec) continue;
      const g = asRecord(rec.guest) ?? rec;
      const email =
        typeof g.email === "string"
          ? g.email
          : typeof g.user_email === "string"
            ? g.user_email
            : null;
      if (!email) continue;
      guests.push({
        email: email.toLowerCase(),
        approval_status:
          typeof g.approval_status === "string" ? g.approval_status : null,
      });
    }

    cursor = typeof data.next_cursor === "string" ? data.next_cursor : null;
    if (!data.has_more || !cursor) break;
  }

  return guests;
}

export interface LumaSyncSummary {
  fetched: number;
  created: number;
  updated: number;
  archived: number;
  guests_mirrored: number;
  errors: string[];
}

export async function syncLumaEvents(
  supabase: SupabaseClient
): Promise<LumaSyncSummary> {
  const lumaEvents = await fetchLumaEvents();
  const summary: LumaSyncSummary = {
    fetched: lumaEvents.length,
    created: 0,
    updated: 0,
    archived: 0,
    guests_mirrored: 0,
    errors: [],
  };
  // An empty fetch is left alone on purpose: reconciliation only runs on a
  // non-trivial listing, so an API hiccup or shape change can never empty
  // the public events section in one tick.
  if (lumaEvents.length === 0) return summary;

  const { data: existingRows, error: readError } = await supabase
    .from("events")
    .select("id, api_id, slug, status, start_at");
  if (readError) throw new Error(`events read failed: ${readError.message}`);

  const byApiId = new Map(
    (existingRows ?? [])
      .filter((r) => r.api_id)
      .map((r) => [r.api_id as string, r])
  );
  const takenSlugs = new Set((existingRows ?? []).map((r) => r.slug as string));
  const syncedAt = new Date().toISOString();

  for (const [i, ev] of lumaEvents.entries()) {
    try {
      const lumaFields = {
        name: ev.name,
        start_at: toWallTime(ev.start_at, ev.timezone),
        end_at: ev.end_at ? toWallTime(ev.end_at, ev.timezone) : null,
        ...locationOf(ev),
        img: ev.cover_url || null,
        luma_url: ev.url || null,
        synced_at: syncedAt,
        updated_at: syncedAt,
      };

      const existing = byApiId.get(ev.api_id);
      if (existing) {
        const { error } = await supabase
          .from("events")
          .update(lumaFields)
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
        summary.updated++;
      } else {
        let slug = slugify(ev.name);
        if (takenSlugs.has(slug)) slug = `${slug}-${ev.api_id.slice(-6).toLowerCase()}`;
        takenSlugs.add(slug);

        const { error } = await supabase.from("events").insert({
          api_id: ev.api_id,
          slug,
          ...lumaFields,
          description: ledeOf(ev.description),
          grad: GRAD_ROTATION[i % GRAD_ROTATION.length],
          status: "published",
          anchor: false,
        });
        if (error) throw new Error(error.message);
        summary.created++;
      }
    } catch (e) {
      summary.errors.push(
        `${ev.api_id} (${ev.name}): ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  // Reconcile: Luma is the source of truth for ALL events — any published
  // future row Luma didn't return (cancelled, unlisted, or a leftover seed)
  // leaves the site. Archived, not deleted: history and RSVP rows survive,
  // and un-archiving is one status flip.
  const lumaIds = new Set(lumaEvents.map((ev) => ev.api_id));
  const orphans = (existingRows ?? []).filter(
    (r) =>
      r.status === "published" &&
      !lumaIds.has(r.api_id as string) &&
      new Date(r.start_at).getTime() > Date.now()
  );
  for (const row of orphans) {
    const { error } = await supabase
      .from("events")
      .update({ status: "archived", updated_at: syncedAt })
      .eq("id", row.id);
    if (error) {
      summary.errors.push(`archive ${row.slug}: ${error.message}`);
    } else {
      summary.archived++;
    }
  }

  // Mirror Luma's guest lists into event_rsvps for upcoming events, so a
  // registration made on Luma directly shows as "You're going" in-app —
  // registration parity runs both ways. Additive only: rows are never
  // deleted here (an in-app RSVP whose Luma forward failed must survive).
  // 'approved'/'going' means registered; invited/declined/waitlisted don't
  // count. A missing status field counts (defensive against shape drift).
  const { data: lumaRows } = await supabase
    .from("events")
    .select("id, api_id, start_at")
    .in(
      "api_id",
      lumaEvents.map((ev) => ev.api_id)
    );
  const idByApiId = new Map(
    (lumaRows ?? []).map((r) => [r.api_id as string, r.id as number])
  );
  const upcoming = lumaEvents.filter(
    (ev) => new Date(ev.start_at).getTime() > Date.now() && idByApiId.has(ev.api_id)
  );
  for (const ev of upcoming) {
    try {
      const guests = await fetchLumaGuests(ev.api_id);
      const registered = guests.filter(
        (g) =>
          g.approval_status === null ||
          ["approved", "going"].includes(g.approval_status)
      );
      if (registered.length === 0) continue;
      const { error } = await supabase.from("event_rsvps").upsert(
        registered.map((g) => ({
          event_id: idByApiId.get(ev.api_id),
          email: g.email,
        })),
        { onConflict: "event_id,email", ignoreDuplicates: true }
      );
      if (error) throw new Error(error.message);
      summary.guests_mirrored += registered.length;
    } catch (e) {
      summary.errors.push(
        `guests ${ev.api_id} (${ev.name}): ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  return summary;
}
