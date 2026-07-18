import type { CsvColumn } from "@/lib/export/csv";

// Shared contact-export core. Every group export (cycle, pod, lab, project, and
// the admin master lists) selects the same participant PII columns, flattens
// them the same way, and serializes through buildContactsTable → toCsv. The
// reads that feed these are service-role (participant PII) and each route is
// role-gated before it serializes.

/** Participant contact columns, as a PostgREST select fragment. */
export const PARTICIPANT_CONTACT_SELECT =
  "first_name, last_name, preferred_name, email, phone_number, linkedin, slack_username, github_username, metro_slug, state, contact_consent, photo_video_consent";

export interface ContactParticipant {
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

const str = (v: unknown): string | null => (v == null ? null : String(v));
const bool = (v: unknown): boolean | null => (v == null ? null : Boolean(v));

/**
 * Coerce a raw (untyped service-client) participants embed/row into the contact
 * fields. Accepts the object or null a to-one embed yields.
 */
export function flattenParticipant(raw: unknown): ContactParticipant {
  const p = (raw as Record<string, unknown> | null) ?? null;
  return {
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
}

export const BASE_CONTACT_COLUMNS: CsvColumn[] = [
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
];

export const CONSENT_COLUMNS: CsvColumn[] = [
  { key: "contact_consent", header: "Contact consent" },
  { key: "photo_video_consent", header: "Photo/video consent" },
];

/**
 * Sort rows by last name then first name and assemble columns as
 * BASE + middleColumns (group-specific, e.g. a status/role column) + CONSENT.
 * Rows are already keyed to match every column; toCsv renders booleans as
 * yes/no and null/missing keys as empty cells.
 */
export function buildContactsTable<T extends ContactParticipant>(
  rows: T[],
  middleColumns: CsvColumn[] = []
): { columns: CsvColumn[]; records: Record<string, unknown>[] } {
  const columns = [...BASE_CONTACT_COLUMNS, ...middleColumns, ...CONSENT_COLUMNS];
  const records = [...rows].sort((a, b) => {
    const byLast = (a.last_name ?? "").localeCompare(b.last_name ?? "");
    if (byLast !== 0) return byLast;
    return (a.first_name ?? "").localeCompare(b.first_name ?? "");
  });
  return { columns, records: records as unknown as Record<string, unknown>[] };
}

/** Slugify a group name for a download filename; falls back to `fallback`. */
export function contactsFilenameSlug(
  name: string | null | undefined,
  fallback: string
): string {
  const slug = (name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}
