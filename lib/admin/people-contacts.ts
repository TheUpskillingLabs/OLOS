import { createServiceClient } from "@/lib/supabase/server";
import type { CsvColumn } from "@/lib/export/csv";
import {
  PARTICIPANT_CONTACT_SELECT,
  flattenParticipant,
  buildContactsTable,
  type ContactParticipant,
} from "@/lib/export/contacts";

// Global-admin master contact exports: (1) everyone in `participants`, and
// (2) everyone holding an active authority role, one row per person with their
// distinct roles aggregated. Both read service-role (participant PII) via the
// shared contact core; the routes that call these loaders are admin-gated.

/**
 * Load every person in the org (no test/staff filter — the admin People tab
 * lists everyone), flattened to one contact row each.
 */
export async function getAllPeopleContacts(): Promise<{
  rows: ContactParticipant[];
  error: unknown;
}> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("participants")
    .select(PARTICIPANT_CONTACT_SELECT);
  if (error) return { rows: [], error };

  const rows: ContactParticipant[] = (data ?? []).map((p) =>
    flattenParticipant(p)
  );
  return { rows, error: null };
}

/**
 * Pivot the all-people rows into CSV columns + records: the shared base + consent
 * columns, no group-specific middle column. Sorted by name via the shared helper.
 */
export function buildAllPeopleContactsTable(rows: ContactParticipant[]): {
  columns: CsvColumn[];
  records: Record<string, unknown>[];
} {
  return buildContactsTable(rows);
}

/**
 * Authority roles = the operational (non-member) roles in `participant_roles`.
 * Member roles (upskiller/volunteer/mentor/events) and the project IC ladder
 * (co_lead/member/dri/contributor/staff/tester) are excluded — this export is
 * the roster of people who hold power in the org.
 */
const AUTHORITY_ROLES = new Set([
  "owner",
  "admin",
  "developer",
  "observer",
  "lab_lead",
  "poderator",
]);

export interface AuthorityContactRow extends ContactParticipant {
  /** The person's distinct active authority roles, e.g. "admin; lab_lead". */
  roles: string;
}

/**
 * Load everyone who holds at least one active authority role. Reads
 * `participant_roles` (active ⟺ `revoked_at IS NULL`) embedding the participant
 * PII, filters to authority roles, and dedupes to one row per participant with
 * their distinct roles aggregated into a semicolon-joined string. The embed is
 * disambiguated to the `participant_id` FK — `participant_roles` also FKs
 * `participants` via `granted_by`/`revoked_by`, so a bare embed is ambiguous.
 */
export async function getAuthorityRoleContacts(): Promise<{
  rows: AuthorityContactRow[];
  error: unknown;
}> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("participant_roles")
    .select(
      `participant_id, role, participants!participant_roles_participant_id_fkey ( ${PARTICIPANT_CONTACT_SELECT} )`
    )
    .is("revoked_at", null);
  if (error) return { rows: [], error };

  // One entry per participant; collect the distinct authority roles they hold.
  const byParticipant = new Map<
    number,
    { contact: ContactParticipant; roles: Set<string> }
  >();
  for (const r of (data ?? []) as {
    participant_id: number | null;
    role: string | null;
    participants: unknown;
  }[]) {
    if (r.participant_id == null || r.role == null) continue;
    if (!AUTHORITY_ROLES.has(r.role)) continue;
    let entry = byParticipant.get(r.participant_id);
    if (!entry) {
      entry = { contact: flattenParticipant(r.participants), roles: new Set() };
      byParticipant.set(r.participant_id, entry);
    }
    entry.roles.add(r.role);
  }

  const rows: AuthorityContactRow[] = Array.from(byParticipant.values()).map(
    ({ contact, roles }) => ({
      ...contact,
      roles: Array.from(roles).sort().join("; "),
    })
  );
  return { rows, error: null };
}

/**
 * Pivot the authority rows into CSV columns + records: the shared base columns,
 * then a Roles column, then consent flags. Sorted by name via the shared helper.
 */
export function buildAuthorityContactsTable(rows: AuthorityContactRow[]): {
  columns: CsvColumn[];
  records: Record<string, unknown>[];
} {
  return buildContactsTable(rows, [{ key: "roles", header: "Roles" }]);
}
