import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdmin, isOwner, isLabLead, type UserRoles } from "./roles";

/**
 * The single write path for authority grants (docs auth unification). Every
 * role grant/revoke goes through here so that (a) provenance (`granted_by`) is
 * always stamped and (b) delegation ATTENUATES — you can only grant what your
 * own authority permits, within your scope:
 *   - owner is owner-only to grant (the DB guard_owner_grant trigger, 00064,
 *     is the backstop);
 *   - admin / developer / observer / staff / tester and lab_lead are
 *     admin-or-owner (HQ appoints lab leads);
 *   - pod-scoped roles (poderator / co_lead / member) are admin OR the lab
 *     lead of the pod's lab;
 *   - project-scoped roles (dri / contributor) are admin OR a project DRI.
 * For the scoped roles the async resource check (which lab? whose project?)
 * lives at the call site (lib/auth/lab.ts, lib/auth/projects.ts); the caller
 * passes `scopeAuthorized: true` once it has verified the actor's scoped
 * authority. Global-role attenuation is enforced here directly.
 *
 * Writes land in participant_roles — the source of truth the app and RLS both
 * read (00064). No self-escalation: the canGrant gate blocks a non-owner from
 * minting owner and a non-admin from minting admin.
 */

export type AuthorityRole =
  | "owner"
  | "admin"
  | "developer"
  | "observer"
  | "poderator"
  | "lab_lead"
  | "co_lead"
  | "member"
  | "dri"
  | "contributor"
  | "staff"
  | "tester";

export type ScopeKind = "global" | "pod" | "lab" | "project";

export type GrantScope = {
  cycleId?: number | null;
  podId?: number | null;
  labId?: number | null;
  projectId?: number | null;
};

export type GrantResult =
  | { ok: true; id: number | null; alreadyActive: boolean }
  | { ok: false; error: string; status: number };

/** Which scope column anchors each role. */
export const ROLE_SCOPE: Record<AuthorityRole, ScopeKind> = {
  owner: "global",
  admin: "global",
  developer: "global",
  observer: "global",
  staff: "global",
  tester: "global",
  lab_lead: "lab",
  poderator: "pod",
  co_lead: "pod",
  member: "pod",
  dri: "project",
  contributor: "project",
};

/**
 * Pure attenuation predicate: may `actor` grant `role` at `scope`? For scoped
 * roles a lab lead of the scope's lab qualifies; a caller that has verified a
 * finer scoped authority (e.g. project DRI) passes `scopeAuthorized`.
 */
export function canGrant(
  actor: UserRoles,
  role: AuthorityRole,
  scope: GrantScope = {},
  scopeAuthorized = false
): { ok: true } | { ok: false; error: string } {
  const admin = isAdmin(actor);
  const owner = isOwner(actor);
  switch (role) {
    case "owner":
      return owner ? { ok: true } : { ok: false, error: "Only an owner can grant owner." };
    case "admin":
    case "developer":
    case "observer":
    case "staff":
    case "tester":
      return admin
        ? { ok: true }
        : { ok: false, error: "Only an admin or owner can grant this role." };
    case "lab_lead":
      return admin
        ? { ok: true }
        : { ok: false, error: "Only an admin or owner can appoint a lab lead." };
    case "poderator":
    case "co_lead":
    case "member":
      if (admin) return { ok: true };
      if (scope.labId != null && isLabLead(actor, scope.labId)) return { ok: true };
      if (scopeAuthorized) return { ok: true };
      return { ok: false, error: "Only an admin or the lab's lead can grant this role." };
    case "dri":
    case "contributor":
      if (admin || scopeAuthorized) return { ok: true };
      return { ok: false, error: "Only an admin or a project DRI can grant this role." };
  }
}

function validateScope(role: AuthorityRole, scope: GrantScope): string | null {
  const kind = ROLE_SCOPE[role];
  const hasAny =
    scope.cycleId != null || scope.podId != null || scope.labId != null || scope.projectId != null;
  if (kind === "global" && hasAny) return `${role} is a global role and takes no scope.`;
  if (kind === "pod" && scope.podId == null) return `${role} requires a pod scope.`;
  if (kind === "lab" && scope.labId == null) return `${role} requires a lab scope.`;
  if (kind === "project" && scope.projectId == null) return `${role} requires a project scope.`;
  return null;
}

/** Grant a role. Idempotent — a matching active grant returns alreadyActive. */
export async function grantRole(
  client: SupabaseClient,
  params: {
    participantId: number;
    role: AuthorityRole;
    scope?: GrantScope;
    actor: UserRoles;
    note?: string;
    /** Caller has verified the actor's finer scoped authority (lab lead / DRI). */
    scopeAuthorized?: boolean;
  }
): Promise<GrantResult> {
  const { participantId, role, scope = {}, actor, note, scopeAuthorized = false } = params;

  const scopeError = validateScope(role, scope);
  if (scopeError) return { ok: false, error: scopeError, status: 400 };

  const gate = canGrant(actor, role, scope, scopeAuthorized);
  if (!gate.ok) return { ok: false, error: gate.error, status: 403 };

  // Idempotency against uq_proles_active (participant, role, all scopes).
  const { data: existing } = await client
    .from("participant_roles")
    .select("id")
    .eq("participant_id", participantId)
    .eq("role", role)
    .is("revoked_at", null)
    .is("cycle_id", scope.cycleId ?? null)
    .is("pod_id", scope.podId ?? null)
    .is("lab_id", scope.labId ?? null)
    .is("project_id", scope.projectId ?? null)
    .maybeSingle();
  if (existing) return { ok: true, id: existing.id, alreadyActive: true };

  const { data, error } = await client
    .from("participant_roles")
    .insert({
      participant_id: participantId,
      role,
      cycle_id: scope.cycleId ?? null,
      pod_id: scope.podId ?? null,
      lab_id: scope.labId ?? null,
      project_id: scope.projectId ?? null,
      granted_by: actor.participantId,
      note: note ?? null,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message, status: 500 };
  return { ok: true, id: data.id, alreadyActive: false };
}

/** Revoke a participant's active grant of a role at a scope (stamps revoked_by/at). */
export async function revokeRole(
  client: SupabaseClient,
  params: {
    participantId: number;
    role: AuthorityRole;
    scope?: GrantScope;
    actor: UserRoles;
  }
): Promise<GrantResult> {
  const { participantId, role, scope = {}, actor } = params;

  // Revoking requires the same authority that granting does.
  const gate = canGrant(actor, role, scope, true);
  if (!gate.ok) return { ok: false, error: gate.error, status: 403 };

  const { data, error } = await client
    .from("participant_roles")
    .update({ revoked_at: new Date().toISOString(), revoked_by: actor.participantId })
    .eq("participant_id", participantId)
    .eq("role", role)
    .is("revoked_at", null)
    .is("cycle_id", scope.cycleId ?? null)
    .is("pod_id", scope.podId ?? null)
    .is("lab_id", scope.labId ?? null)
    .is("project_id", scope.projectId ?? null)
    .select("id");

  if (error) return { ok: false, error: error.message, status: 500 };
  return { ok: true, id: data?.[0]?.id ?? null, alreadyActive: false };
}
