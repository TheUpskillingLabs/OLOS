import { createServiceClient } from "@/lib/supabase/server";
import type { CsvColumn } from "@/lib/export/csv";
import {
  PARTICIPANT_CONTACT_SELECT,
  flattenParticipant,
  buildContactsTable,
  type ContactParticipant,
} from "@/lib/export/contacts";

// Contact export for everyone who belongs to a lab → CSV (lab-lead workspace
// and the HQ per-lab drill-in). A "lab" IS a metros row; membership is
// participants.metro_id = <labId>, so there is no join table and no per-group
// status column. The reads are service-role because the file carries
// participant PII; the routes that call these are role-gated (admin or the
// lab's lead) before serializing.

/** One contact row per lab member — no lab-specific extra fields. */
export type LabContactRow = ContactParticipant;

export interface LabScopeResult {
  /** The lab's identity for the download filename; null when no such lab. */
  lab: { slug: string; name: string } | null;
  /** A DB error to hand to `dbError`; null on success (including "not found"). */
  error: unknown;
}

export interface LabContactsResult {
  rows: LabContactRow[];
  /** A DB error to hand to `dbError`; null on success. */
  error: unknown;
}

/**
 * Resolve the lab's identity (slug + name) for the download filename. Returns
 * `lab: null` when the id doesn't exist so the caller can 404.
 */
export async function getLabScope(labId: number): Promise<LabScopeResult> {
  const supabase = createServiceClient();

  const { data: lab, error } = await supabase
    .from("metros")
    .select("slug, name")
    .eq("id", labId)
    .maybeSingle();
  if (error) return { lab: null, error };
  if (!lab) return { lab: null, error: null };

  return { lab: { slug: lab.slug, name: lab.name }, error: null };
}

/**
 * Load the contact roster for a lab: every participant whose metro is this lab
 * (no test/staff filter — the export includes everyone), flattened to one row
 * per person.
 */
export async function getLabContacts(
  labId: number
): Promise<LabContactsResult> {
  const supabase = createServiceClient();

  const { data: participants, error } = await supabase
    .from("participants")
    .select(PARTICIPANT_CONTACT_SELECT)
    .eq("metro_id", labId);
  if (error) return { rows: [], error };

  const rows: LabContactRow[] = (participants ?? []).map((p) =>
    flattenParticipant(p)
  );

  return { rows, error: null };
}

/**
 * Pivot contact rows into flat CSV columns + records: the shared base columns
 * then consent flags (labs have no per-group status column). Sorted by name via
 * the shared helper; consent booleans render as yes/no.
 */
export function buildLabContactsTable(rows: LabContactRow[]): {
  columns: CsvColumn[];
  records: Record<string, unknown>[];
} {
  return buildContactsTable(rows);
}
