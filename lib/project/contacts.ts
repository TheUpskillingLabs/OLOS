import { createServiceClient } from "@/lib/supabase/server";
import {
  PARTICIPANT_CONTACT_SELECT,
  flattenParticipant,
  buildContactsTable,
  type ContactParticipant,
} from "@/lib/export/contacts";

// Contact export for everyone on a project → CSV (project page, members
// section). A service-role loader (project_memberships embeds participant PII)
// plus the shared pivot; the route that calls this is role-gated
// (admin / the pod's poderator / the pod's lab lead).

export interface ProjectContactRow extends ContactParticipant {
  membership_status: string | null;
}

/**
 * The project's identity for the download filename + the pod it belongs to,
 * which the route resolves to a lab for lab-lead authorization. Returns
 * `scope: null` when the id doesn't exist so the caller can 404.
 */
export async function getProjectScope(projectId: number): Promise<{
  scope: { name: string | null; pod_id: number | null } | null;
  error: unknown;
}> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("projects")
    .select("name, pod_id")
    .eq("id", projectId)
    .maybeSingle();
  if (error) return { scope: null, error };
  if (!data) return { scope: null, error: null };
  return {
    scope: {
      name: data.name == null ? null : String(data.name),
      pod_id: data.pod_id == null ? null : Number(data.pod_id),
    },
    error: null,
  };
}

/**
 * Load the contact roster for a project: every member (no test/staff filter —
 * include everyone), flattened to one row per person. `membership_status` is
 * derived from `project_memberships.left_at` — active while it's NULL, inactive
 * once the member has left (00001 soft-delete).
 */
export async function getProjectContacts(projectId: number): Promise<{
  rows: ProjectContactRow[];
  error: unknown;
}> {
  const supabase = createServiceClient();
  const { data: memberships, error } = await supabase
    .from("project_memberships")
    .select(`left_at, participants ( ${PARTICIPANT_CONTACT_SELECT} )`)
    .eq("project_id", projectId);
  if (error) return { rows: [], error };

  const rows: ProjectContactRow[] = (memberships ?? []).map((m) => ({
    ...flattenParticipant(m.participants),
    membership_status: m.left_at == null ? "active" : "inactive",
  }));

  return { rows, error: null };
}

/**
 * Pivot contact rows into flat CSV columns + records: the shared base columns,
 * then membership status, then consent flags. Sorted by name via the shared
 * helper; consent booleans render as yes/no.
 */
export function buildProjectContactsTable(rows: ProjectContactRow[]) {
  return buildContactsTable(rows, [
    { key: "membership_status", header: "Membership status" },
  ]);
}
