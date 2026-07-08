/* Local Lab membership — the spine (docs/LOCAL_LABS.md).
 *
 * A member's `participants.metro_id` is their ACTIVE lab (or NULL). Joining an
 * active lab sets it; joining or starting a waitlist leaves it NULL and writes
 * a `metro_waitlist_signups` row. Active-lab membership is the hard gate for
 * all cycle participation — pods are local, so you must belong to a running
 * lab to register, vote, or form pods.
 *
 * These are thin server helpers that take a Supabase client (service-role at
 * every call site today) so routes stay consistent and testable.
 */

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface LabRow {
  id: number;
  slug: string;
  name: string;
  st: string | null;
  status: "active" | "waitlist";
}

const norm = (s: string | null | undefined): string =>
  (s ?? "").trim().toLowerCase();

/** Slugify a lab name into a-z0-9 with single dashes. Empty → "lab". */
function slugifyLab(input: string): string {
  const s = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return s || "lab";
}

/**
 * 403 unless `participantId` belongs to an ACTIVE lab. The gate for cycle
 * registration/join/interest: a waitlisted or lab-less member cannot take part
 * in a cycle until their local lab goes active. Returns null when allowed.
 */
export async function requireActiveLabMembership(
  client: SupabaseClient,
  participantId: number | null
): Promise<NextResponse | null> {
  if (!participantId) {
    return NextResponse.json(
      { error: "Not a registered participant", redirect: "/register" },
      { status: 403 }
    );
  }

  const { data: me } = await client
    .from("participants")
    .select("metro_id")
    .eq("id", participantId)
    .maybeSingle();

  const blocked = () =>
    NextResponse.json(
      {
        error:
          "Join an active Local Lab to take part in a cycle. Your lab isn't running yet — you're on its waitlist.",
        redirect: "/local-labs",
      },
      { status: 403 }
    );

  if (!me?.metro_id) return blocked();

  const { data: lab } = await client
    .from("metros")
    .select("id, status")
    .eq("id", me.metro_id)
    .maybeSingle();

  if (!lab || lab.status !== "active") return blocked();
  return null;
}

/**
 * Find or create the waitlist lab for a city/state ("start a waitlist"). Dedup
 * is case-insensitive on (name, st): an existing lab — active OR waitlist — is
 * returned as-is (never a duplicate); otherwise a new `status='waitlist'` row
 * is inserted with a collision-free slug. Callers add the participant to
 * `metro_waitlist_signups` separately.
 */
export async function findOrCreateWaitlistLab(
  client: SupabaseClient,
  input: { city: string; st?: string | null }
): Promise<{ lab?: LabRow; error?: string }> {
  const name = input.city.trim();
  if (!name) return { error: "A city is required to start a waitlist" };
  const st = (input.st ?? "").trim().toUpperCase() || null;

  const { data: all, error: readErr } = await client
    .from("metros")
    .select("id, slug, name, st, status");
  if (readErr) return { error: readErr.message };
  const metros = (all ?? []) as LabRow[];

  const existing = metros.find(
    (m) => norm(m.name) === norm(name) && norm(m.st) === norm(st)
  );
  if (existing) return { lab: existing };

  const base = slugifyLab(st ? `${name}-${st}` : name);
  const taken = new Set(metros.map((m) => m.slug));
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;

  // One retry on a slug race (another concurrent start-a-waitlist).
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: created, error } = await client
      .from("metros")
      .insert({ slug, name, st, status: "waitlist" })
      .select("id, slug, name, st, status")
      .single();
    if (!error && created) return { lab: created as LabRow };
    if (error?.code === "23505") {
      slug = `${base}-${Math.max(2, taken.size + attempt + 2)}`;
      continue;
    }
    return { error: error?.message ?? "Could not create the waitlist lab" };
  }
  return { error: "Could not create the waitlist lab" };
}

/**
 * Set a participant's active-lab membership (upholds the invariant that
 * `metro_id` references only ACTIVE labs). Rejects a waitlist/missing lab.
 */
export async function setActiveLabMembership(
  client: SupabaseClient,
  participantId: number,
  metroId: number
): Promise<{ lab?: LabRow; error?: string }> {
  const { data: lab } = await client
    .from("metros")
    .select("id, slug, name, st, status")
    .eq("id", metroId)
    .maybeSingle();

  if (!lab) return { error: "Lab not found" };
  if (lab.status !== "active") return { error: "That lab isn't active yet" };

  const { error } = await client
    .from("participants")
    .update({ metro_id: lab.id, metro_slug: lab.slug })
    .eq("id", participantId);
  if (error) return { error: error.message };

  return { lab: lab as LabRow };
}
