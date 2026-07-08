/**
 * check-embeds.mjs
 *
 * Smoke-tests the app's embed-heavy PostgREST selects against a live
 * database. Embeds are a runtime contract with PostgREST that unit tests,
 * typecheck, and build cannot verify — e.g. a table with two FKs to the
 * same target (project_roles → participants) makes a bare `participants(...)`
 * embed fail with PGRST201 only when the query actually runs.
 *
 * Usage (from the repo root):
 *   node scripts/check-embeds.mjs
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from
 * .env.local, falling back to the process environment. Exits non-zero if
 * any select is rejected, so it can gate a deploy by hand. Not part of
 * `npm test` because it needs live credentials.
 *
 * Note: uses raw fetch against PostgREST — works with both old JWT-format
 * service role keys and Supabase's new sb_secret_ opaque key format.
 */

import { readFileSync } from "fs";

// ── Load .env.local ─────────────────────────────────────────────────────────
function loadEnv() {
  try {
    const raw = readFileSync(".env.local", "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!(key in process.env)) process.env[key] = val;
    }
    console.log("\x1b[2mLoaded .env.local\x1b[0m");
  } catch {
    console.warn("⚠  .env.local not found — falling back to process env");
  }
}
loadEnv();

const BASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!BASE_URL || !SERVICE_KEY) {
  console.error("❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
};

// ── The embeds under contract ───────────────────────────────────────────────
// Each entry mirrors a real select in the app (source comment). Keep the
// select strings in sync when the app's queries change; a check here failing
// means that page 500s or silently renders empty at runtime.
const CHECKS = [
  {
    // app/(dashboard)/projects/[project_id]/page.tsx — contributors ladder.
    // project_roles has TWO FKs to participants (participant_id, invited_by):
    // the embed must name the FK or PostgREST rejects it with PGRST201.
    table: "project_roles",
    select:
      "participant_id, role, created_at, participants!project_roles_participant_id_fkey(first_name, last_name, preferred_name)",
  },
  {
    // app/(dashboard)/projects/[project_id]/page.tsx — project members.
    table: "project_memberships",
    select:
      "participant_id, registered_at, left_at, participants(first_name, last_name, preferred_name)",
  },
  {
    // app/(dashboard)/dashboard/page.tsx — org workstream memberships.
    table: "pod_memberships",
    select: "id, pod_id, pods!inner(id, name, status, workstream_id)",
  },
  {
    // app/(dashboard)/admin/people/page.tsx — enrollment chips.
    table: "cycle_enrollments",
    select: "participant_id, status, cycle_id, cycles(name, mode)",
  },
  {
    // app/(dashboard)/admin/people/page.tsx — moderating chips.
    table: "moderator_assignments",
    select: "participant_id, pod_id, pods(name, cycles(mode))",
  },
  {
    // app/(dashboard)/admin/people/page.tsx — invitations list.
    table: "invitations",
    select: "id, email, status, cycle_id, pod_id, cycles(name, mode)",
  },
  {
    // app/(dashboard)/admin/cycles/[cycle_id]/page.tsx — co-lead names.
    table: "moderator_assignments",
    select:
      "participant_id, pod_id, assigned_at, participants(first_name, last_name, preferred_name)",
  },
  {
    // app/(dashboard)/admin/people/page.tsx — pod picker options.
    table: "pods",
    select: "id, name, cycle_id, cycles(name, mode)",
  },
  {
    // app/api/labs/[lab_id]/leads + admin/labs pages — lab_leads has TWO
    // FKs to participants (participant_id, invited_by-style assigned_by):
    // the embed must name the FK (same PGRST201 shape as project_roles).
    table: "lab_leads",
    select:
      "participant_id, assigned_at, participants!lab_leads_participant_id_fkey(first_name, last_name, preferred_name, email)",
  },
  {
    // admin cycle workspace header — lab badge.
    table: "cycles",
    select: "id, name, mode, lab_id, metros(name)",
  },
];

// ── Run ─────────────────────────────────────────────────────────────────────
const ok = (s) => `\x1b[32m✔\x1b[0m  ${s}`;
const fail = (s) => `\x1b[31m✘\x1b[0m  ${s}`;

let failures = 0;
for (const check of CHECKS) {
  const qs = new URLSearchParams({ select: check.select, limit: "1" });
  const url = `${BASE_URL}/rest/v1/${check.table}?${qs}`;
  const res = await fetch(url, { headers: HEADERS });
  if (res.ok) {
    console.log(ok(`${check.table} — embed accepted`));
  } else {
    failures++;
    const body = await res.text();
    console.error(fail(`${check.table} — ${res.status} ${res.statusText}`));
    console.error(`   select: ${check.select}`);
    console.error(`   ${body}`);
  }
}

if (failures) {
  console.error(`\n❌  ${failures} embed check(s) failed`);
  process.exit(1);
}
console.log("\n\x1b[32mAll embed checks passed.\x1b[0m");
