import { createServiceClient } from "@/lib/supabase/server";
import type { CsvColumn } from "@/lib/export/csv";
import {
  PARTICIPANT_CONTACT_SELECT,
  flattenParticipant,
  buildContactsTable,
  type ContactParticipant,
} from "@/lib/export/contacts";

// Contact export for every member of a pod → CSV (member pod page, poderator
// per-pod view, admin pod-management drawer). A service-role loader (pod
// membership PII) plus the shared pivot; the route that calls this re-checks
// authorization (admin, the pod's poderator, or the pod's lab lead).

export interface PodContactRow extends ContactParticipant {
  membership_status: string | null;
}

/**
 * Load the pod's identity used to authorize the export and name the download:
 * its display name, owning cycle, and authoritative lab (lab_id, migration
 * 00067 — may be null). Returns `scope: null` when no such pod exists so the
 * caller can 404.
 */
export async function getPodScope(podId: number): Promise<{
  scope: { name: string | null; cycle_id: number | null; lab_id: number | null } | null;
  error: unknown;
}> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("pods")
    .select("name, cycle_id, lab_id")
    .eq("id", podId)
    .maybeSingle();
  if (error) return { scope: null, error };
  if (!data) return { scope: null, error: null };
  return {
    scope: {
      name: (data.name as string | null) ?? null,
      cycle_id: (data.cycle_id as number | null) ?? null,
      lab_id: (data.lab_id as number | null) ?? null,
    },
    error: null,
  };
}

/**
 * Load the contact roster for a pod: every member (no test/staff filter —
 * include everyone), flattened to one row per person with a membership status
 * derived from the soft-delete column (active ⟺ inactive_at IS NULL).
 */
export async function getPodContacts(
  podId: number
): Promise<{ rows: PodContactRow[]; error: unknown }> {
  const supabase = createServiceClient();

  const { data: memberships, error } = await supabase
    .from("pod_memberships")
    .select(`inactive_at, participants ( ${PARTICIPANT_CONTACT_SELECT} )`)
    .eq("pod_id", podId);
  if (error) return { rows: [], error };

  const rows: PodContactRow[] = (memberships ?? []).map((m) => ({
    ...flattenParticipant(m.participants),
    membership_status: m.inactive_at == null ? "active" : "inactive",
  }));

  return { rows, error: null };
}

/**
 * Pivot contact rows into flat CSV columns + records: the shared base columns,
 * then membership status, then consent flags. Sorted by name via the shared
 * helper; consent booleans render as yes/no.
 */
export function buildPodContactsTable(rows: PodContactRow[]): {
  columns: CsvColumn[];
  records: Record<string, unknown>[];
} {
  return buildContactsTable(rows, [
    { key: "membership_status", header: "Membership status" },
  ]);
}
