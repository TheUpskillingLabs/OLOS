import { createServiceClient } from "@/lib/supabase/server";
import type { CsvColumn } from "@/lib/export/csv";

// Contact export for everyone enrolled in a cycle → CSV (admin panel, People
// tab). Mirrors the field-survey export split: a service-role loader here plus a
// pure pivot for the route to serialize. Reads are service-role because
// cycle_enrollments is RLS-locked and the file carries participant PII, so the
// route that calls this must be admin-gated.

// Contact columns pulled from the embedded participants row.
const PARTICIPANT_CONTACT_COLUMNS =
  "first_name, last_name, preferred_name, email, phone_number, linkedin, slack_username, github_username, metro_slug, state, contact_consent, photo_video_consent";

export interface CycleContactRow {
  enrollment_status: string | null;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  email: string | null;
  phone_number: string | null;
  linkedin: string | null;
  slack_username: string | null;
  github_username: string | null;
  metro_slug: string | null;
  state: string | null;
  contact_consent: boolean | null;
  photo_video_consent: boolean | null;
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
    .select(`status, participants ( ${PARTICIPANT_CONTACT_COLUMNS} )`)
    .eq("cycle_id", cycleId);
  if (error) {
    return { cycle: { slug: cycle.slug, name: cycle.name }, rows: [], error };
  }

  const rows: CycleContactRow[] = (enrollments ?? []).map((e) => {
    // The participants embed is a to-one join; the untyped client returns it as
    // an object (older typings sometimes model it as an array — mirror the cast
    // used in app/api/cycles/[cycle_id]/participants/route.ts).
    const p = (e.participants as unknown) as Record<string, unknown> | null;
    const str = (v: unknown): string | null =>
      v == null ? null : String(v);
    const bool = (v: unknown): boolean | null =>
      v == null ? null : Boolean(v);
    return {
      enrollment_status: str(e.status),
      first_name: str(p?.first_name),
      last_name: str(p?.last_name),
      preferred_name: str(p?.preferred_name),
      email: str(p?.email),
      phone_number: str(p?.phone_number),
      linkedin: str(p?.linkedin),
      slack_username: str(p?.slack_username),
      github_username: str(p?.github_username),
      metro_slug: str(p?.metro_slug),
      state: str(p?.state),
      contact_consent: bool(p?.contact_consent),
      photo_video_consent: bool(p?.photo_video_consent),
    };
  });

  return { cycle: { slug: cycle.slug, name: cycle.name }, rows, error: null };
}

/**
 * Pivot contact rows into flat CSV columns + records. Rows are already keyed to
 * match the columns, so this only fixes column order/headers and sorts by name
 * for a stable file. Boolean consent flags render as yes/no via `formatCsvValue`.
 */
export function buildCycleContactsTable(rows: CycleContactRow[]): {
  columns: CsvColumn[];
  records: Record<string, unknown>[];
} {
  const columns: CsvColumn[] = [
    { key: "first_name", header: "First name" },
    { key: "last_name", header: "Last name" },
    { key: "preferred_name", header: "Preferred name" },
    { key: "email", header: "Email" },
    { key: "phone_number", header: "Phone" },
    { key: "linkedin", header: "LinkedIn" },
    { key: "slack_username", header: "Slack" },
    { key: "github_username", header: "GitHub" },
    { key: "metro_slug", header: "Metro" },
    { key: "state", header: "State" },
    { key: "enrollment_status", header: "Enrollment status" },
    { key: "contact_consent", header: "Contact consent" },
    { key: "photo_video_consent", header: "Photo/video consent" },
  ];

  const sorted = [...rows].sort((a, b) => {
    const byLast = (a.last_name ?? "").localeCompare(b.last_name ?? "");
    if (byLast !== 0) return byLast;
    return (a.first_name ?? "").localeCompare(b.first_name ?? "");
  });

  // CycleContactRow is structurally a Record<string, unknown> for toCsv; the
  // cast bridges the interface (no implicit index signature) to that shape.
  return { columns, records: sorted as unknown as Record<string, unknown>[] };
}
