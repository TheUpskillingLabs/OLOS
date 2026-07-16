import { createServiceClient } from "@/lib/supabase/server";
import type { CsvColumn } from "@/lib/export/csv";
import {
  PARTICIPANT_CONTACT_SELECT,
  flattenParticipant,
  buildContactsTable,
  type ContactParticipant,
} from "@/lib/export/contacts";

// Contact export for everyone enrolled in a cycle → CSV (admin panel, People
// tab). A service-role loader (cycle_enrollments is RLS-locked and the file
// carries participant PII) plus the shared pivot; the route that calls this is
// admin-gated.

export interface CycleContactRow extends ContactParticipant {
  enrollment_status: string | null;
}

export interface CycleContactsResult {
  /** The cycle's identity for the download filename; null when no such cycle. */
  cycle: { slug: string; name: string } | null;
  rows: CycleContactRow[];
  /** A DB error to hand to `dbError`; null on success (including "not found"). */
  error: unknown;
}

/**
 * Load the contact roster for a cycle: every enrolled participant (no
 * test/staff filter — matches the admin People tab exactly), flattened to one
 * row per person. Returns `cycle: null` when the id doesn't exist so the caller
 * can 404.
 */
export async function getCycleContacts(
  cycleId: number
): Promise<CycleContactsResult> {
  const supabase = createServiceClient();

  const { data: cycle, error: cycleError } = await supabase
    .from("cycles")
    .select("slug, name")
    .eq("id", cycleId)
    .maybeSingle();
  if (cycleError) return { cycle: null, rows: [], error: cycleError };
  if (!cycle) return { cycle: null, rows: [], error: null };

  const { data: enrollments, error } = await supabase
    .from("cycle_enrollments")
    .select(`status, participants ( ${PARTICIPANT_CONTACT_SELECT} )`)
    .eq("cycle_id", cycleId);
  if (error) {
    return { cycle: { slug: cycle.slug, name: cycle.name }, rows: [], error };
  }

  const rows: CycleContactRow[] = (enrollments ?? []).map((e) => ({
    ...flattenParticipant(e.participants),
    enrollment_status: e.status == null ? null : String(e.status),
  }));

  return { cycle: { slug: cycle.slug, name: cycle.name }, rows, error: null };
}

/**
 * Pivot contact rows into flat CSV columns + records: the shared base columns,
 * then enrollment status, then consent flags. Sorted by name via the shared
 * helper; consent booleans render as yes/no.
 */
export function buildCycleContactsTable(rows: CycleContactRow[]): {
  columns: CsvColumn[];
  records: Record<string, unknown>[];
} {
  return buildContactsTable(rows, [
    { key: "enrollment_status", header: "Enrollment status" },
  ]);
}
