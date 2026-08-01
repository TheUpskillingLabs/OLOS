import { cache } from "react";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { resolveUserRoles, isAdmin, isOwner } from "@/lib/auth/roles";
import { isProdProject } from "@/lib/env/project";
import { SIMULATION_COOKIE } from "./simulation-cookie";

export { SIMULATION_COOKIE };

/**
 * Member-view simulation ("View as") — the read-only debugging lens.
 *
 * An admin picks a participant and the MEMBER surfaces render as that person:
 * their cycle, pod, enrollment, learning-log gate, nav. Nothing else changes.
 * Three properties hold by construction:
 *
 * 1. **Read-only.** Every mutation is blocked while the cookie is set — coarsely
 *    in `proxy.ts` (presence check, edge) and authoritatively in `withAuth`
 *    (signature-verified). The repo has no Server Actions, so every write is an
 *    `/api/*` request and passes through both.
 * 2. **Never an escalation.** The target must not hold owner/admin/developer, and
 *    the actor's own admin status is re-verified from Postgres on EVERY request —
 *    revoking an admin ends their in-flight simulations immediately.
 * 3. **Not an authority change.** `requireAdmin`/`requireOwner`/`requireLabLead`
 *    and every `/api/*` handler keep reading the REAL user. Simulation swaps who
 *    the member pages render for, not who the request is authorized as.
 *
 * Known divergence: `createClient()` still carries the actor's JWT, so Postgres
 * RLS (`auth.uid()`, `is_admin()`) still sees the admin. Member pages read almost
 * exclusively through `createServiceClient()` (RLS bypassed), so this is
 * invisible in practice; where it isn't, the admin's access is a superset, so a
 * simulated view can show slightly MORE than the member sees, never less.
 */

/** Cookie payload: target participant, actor auth id, absolute expiry (epoch seconds). */
interface SimPayload {
  p: number;
  a: string;
  exp: number;
}

/** How long a simulation lasts before the cookie stops verifying. */
export const SIMULATION_TTL_SECONDS = 60 * 60;

function signingKey(): string {
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — cannot sign simulation cookies."
    );
  }
  return key;
}

function hmac(body: string): string {
  return createHmac("sha256", signingKey()).update(body).digest("base64url");
}

/** `base64url(JSON payload).base64url(HMAC-SHA256)` — opaque and tamper-evident. */
export function signSimulation(payload: SimPayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  return `${body}.${hmac(body)}`;
}

/**
 * Verify a cookie value and return its payload, or null if it is malformed,
 * forged, or expired. Never throws on bad input — a garbage cookie simply means
 * "not simulating".
 */
export function verifySimulation(raw: string | undefined): SimPayload | null {
  if (!raw) return null;
  const dot = raw.indexOf(".");
  if (dot < 1) return null;

  const body = raw.slice(0, dot);
  const provided = Buffer.from(raw.slice(dot + 1), "base64url");
  const expected = Buffer.from(hmac(body), "base64url");
  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    return null;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (typeof payload !== "object" || payload === null) return null;
  const { p, a, exp } = payload as Record<string, unknown>;
  if (typeof p !== "number" || !Number.isInteger(p) || p <= 0) return null;
  if (typeof a !== "string" || a.length === 0) return null;
  if (typeof exp !== "number" || exp * 1000 <= Date.now()) return null;

  return { p, a, exp };
}

/** The signed cookie for this request, verified — or null. Memoized per render. */
export const readSimulationCookie = cache(
  async (): Promise<SimPayload | null> => {
    const store = await cookies();
    return verifySimulation(store.get(SIMULATION_COOKIE)?.value);
  }
);

export interface SimulationTarget {
  participantId: number;
  authUserId: string;
  email: string | null;
  displayName: string;
}

export interface SimulationContext {
  /** The real signed-in admin driving the simulation. */
  actorAuthUserId: string;
  actorParticipantId: number | null;
  target: SimulationTarget;
}

/** Roles that may never be simulated — simulating one would be an escalation. */
const UNSIMULATABLE_ROLES = ["owner", "admin", "developer"];

/**
 * Is `participantId` a legal simulation target? Shared by the guard below and
 * the POST endpoint so both answer the question the same way.
 *
 * Rejects: missing row, a participant who has never signed in (no
 * `auth_user_id` — every member page resolves identity by that column, so the
 * simulated view would silently render empty), and anyone holding an authority
 * role.
 */
export async function loadSimulationTarget(
  service: ReturnType<typeof createServiceClient>,
  participantId: number
): Promise<SimulationTarget | null> {
  const [{ data: participant }, { data: roleRows }] = await Promise.all([
    service
      .from("participants")
      .select("id, auth_user_id, email, preferred_name, first_name, last_name")
      .eq("id", participantId)
      .maybeSingle(),
    service
      .from("participant_roles")
      .select("role")
      .eq("participant_id", participantId)
      .in("role", UNSIMULATABLE_ROLES)
      .is("revoked_at", null)
      .limit(1),
  ]);

  if (!participant?.auth_user_id) return null;
  if (roleRows && roleRows.length > 0) return null;

  return {
    participantId: participant.id,
    authUserId: participant.auth_user_id,
    email: participant.email ?? null,
    displayName:
      participant.preferred_name ||
      [participant.first_name, participant.last_name].filter(Boolean).join(" ") ||
      participant.email ||
      `Participant ${participant.id}`,
  };
}

/**
 * Close the audit row for the simulation this cookie payload describes.
 *
 * Scoped to the actor as well as the target, so two admins simulating the same
 * member don't stamp each other's row; the most recent open row wins, so an
 * admin who simulated the same person twice doesn't back-date the earlier one.
 *
 * Best-effort by design: the cookie is what authorizes a simulation, so an
 * un-stamped row (expired cookie, closed tab) grants nothing — it just reads as
 * "ended at an unknown time".
 */
export async function stampSimulationEnd(
  service: ReturnType<typeof createServiceClient>,
  payload: { p: number; a: string }
): Promise<void> {
  const { data: actor } = await service
    .from("participants")
    .select("id")
    .eq("auth_user_id", payload.a)
    .maybeSingle();

  let query = service
    .from("simulation_sessions")
    .select("id")
    .eq("target_participant_id", payload.p)
    .is("ended_at", null);
  // An actor with no participants row can't have opened a row with a non-null
  // actor id, so match the NULL rather than dropping the filter.
  query = actor
    ? query.eq("actor_participant_id", actor.id)
    : query.is("actor_participant_id", null);

  const { data: open } = await query
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!open) return;

  await service
    .from("simulation_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", open.id);
}

/**
 * The authoritative simulation check, re-run on every request. Returns null
 * unless ALL of the following hold:
 *
 *   1. the cookie verifies and has not expired;
 *   2. it was issued to the account that is signed in right now (a copied
 *      cookie is inert in anyone else's session);
 *   3. that account is still an admin — and still an owner, when this
 *      deployment points at the production database;
 *   4. the target is still a legal target (see `loadSimulationTarget`).
 *
 * Memoized per render, so a page and its layout share one round-trip.
 */
export const simulationContext = cache(
  async (): Promise<SimulationContext | null> => {
    const payload = await readSimulationCookie();
    if (!payload) return null;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || user.id !== payload.a) return null;

    const service = createServiceClient();
    const actorRoles = await resolveUserRoles(service, user.id);
    if (!isAdmin(actorRoles)) return null;
    if (isProdProject() && !isOwner(actorRoles)) return null;

    const target = await loadSimulationTarget(service, payload.p);
    if (!target) return null;

    return {
      actorAuthUserId: user.id,
      actorParticipantId: actorRoles.participantId,
      target,
    };
  }
);

/**
 * The identity the MEMBER surfaces should render for: the simulated target when
 * a simulation is active, otherwise the real signed-in user.
 *
 * Drop-in replacement for the
 * `const { data: { user } } = await supabase.auth.getUser()` preamble every
 * `app/(dashboard)` page opens with — same nullable `User` shape, same
 * `user.id` / `user.email` / `user.user_metadata` reads.
 *
 * Do NOT use this to authorize anything. Authority gates read the real user.
 */
export const effectiveUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const sim = await simulationContext();
  if (!sim) return user;

  // A synthetic user standing in for the target. `user_metadata` is empty on
  // purpose — we do not have their Google profile, and every consumer already
  // falls back to `participants.profile_image_url` then to initials.
  return {
    ...user,
    id: sim.target.authUserId,
    email: sim.target.email ?? undefined,
    user_metadata: {},
  } as User;
});
