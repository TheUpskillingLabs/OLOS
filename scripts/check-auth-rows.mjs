/**
 * check-auth-rows.mjs
 *
 * Diagnoses why a user can't log in to prod by checking all the DB rows
 * the auth callback depends on.
 *
 * Usage (from the repo root):
 *   node scripts/check-auth-rows.mjs
 *   node scripts/check-auth-rows.mjs --email user@example.com
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.production.local.
 *
 * Note: uses raw fetch against PostgREST — works with both old JWT-format
 * service role keys and Supabase's new sb_secret_ opaque key format.
 */

import { readFileSync } from "fs";

// ── Load .env.production.local ─────────────────────────────────────────────
function loadEnv() {
  try {
    const raw = readFileSync(".env.production.local", "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      process.env[key] = val;
    }
    console.log("\x1b[2mLoaded .env.production.local\x1b[0m");
  } catch {
    console.warn("⚠  .env.production.local not found — falling back to process env");
  }
}
loadEnv();

const BASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const filterEmail = process.argv.includes("--email")
  ? process.argv[process.argv.indexOf("--email") + 1]
  : null;

if (!BASE_URL || !SERVICE_KEY) {
  console.error("❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

// ── Raw PostgREST fetch (bypasses supabase-js client quirks) ───────────────
const HEADERS = {
  "apikey": SERVICE_KEY,
  "Authorization": `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

async function pgQuery(table, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `${BASE_URL}/rest/v1/${table}${qs ? "?" + qs : ""}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText} — ${body}`);
  }
  return res.json();
}

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = (v) => (v == null ? "\x1b[2mnull\x1b[0m" : String(v));
const ok   = (s) => `\x1b[32m✔\x1b[0m  ${s}`;
const warn = (s) => `\x1b[33m⚠\x1b[0m  ${s}`;
const fail = (s) => `\x1b[31m✘\x1b[0m  ${s}`;

// ── 1. Participants ────────────────────────────────────────────────────────
console.log("\n\x1b[1m── participants ──────────────────────────────────────────\x1b[0m");

let participantParams = {
  select: "id,email,auth_user_id,first_name,last_name",
  order: "id",
};
if (filterEmail) {
  participantParams["email"] = `ilike.*${filterEmail}*`;
}

let participants;
try {
  participants = await pgQuery("participants", participantParams);
} catch (e) {
  console.error(fail("Query failed: " + e.message));
  console.error("\n  Hint: if you see 'permission denied', the service role key in");
  console.error("  .env.production.local may be in Supabase's new sb_secret_ format,");
  console.error("  which some PostgREST versions can't decode as a role claim.");
  console.error("  Fix: go to Supabase Studio → Project Settings → API and copy the");
  console.error("  service_role key (the long JWT starting with eyJ…) into .env.production.local.");
  process.exit(1);
}

if (!participants.length) {
  console.log(fail("No participants rows found" + (filterEmail ? ` matching '${filterEmail}'` : "")));
} else {
  for (const p of participants) {
    const authStatus = p.auth_user_id
      ? ok(`auth_user_id linked: ${p.auth_user_id}`)
      : warn("auth_user_id is NULL  ← first login will set this; fine if they haven't logged in yet");
    console.log(`\n  id=${p.id}  ${p.first_name ?? ""} ${p.last_name ?? ""}  <${p.email}>`);
    console.log(`  ${authStatus}`);
  }
}

const pIds = participants.map((p) => p.id);
if (!pIds.length) {
  console.log("\n(no participant ids to check further)\n");
  process.exit(0);
}

// ── 2. user_roles ──────────────────────────────────────────────────────────
console.log("\n\x1b[1m── user_roles ────────────────────────────────────────────\x1b[0m");
try {
  const roles = await pgQuery("user_roles", {
    select: "participant_id,role,granted_at,revoked_at",
    participant_id: `in.(${pIds.join(",")})`,
  });
  if (!roles.length) {
    console.log(warn("No user_roles rows — users land as plain participants (no admin/owner access)"));
  } else {
    for (const r of roles) {
      const revoked = r.revoked_at ? fail(`REVOKED at ${r.revoked_at}`) : ok("active");
      console.log(`  participant_id=${r.participant_id}  role=${r.role}  ${revoked}`);
    }
  }
} catch (e) {
  console.log(warn("Could not query user_roles: " + e.message));
}

// ── 3. participant_permissions ─────────────────────────────────────────────
console.log("\n\x1b[1m── participant_permissions ───────────────────────────────\x1b[0m");
try {
  const perms = await pgQuery("participant_permissions", {
    select: "participant_id,permission,revoked_at",
    participant_id: `in.(${pIds.join(",")})`,
  });
  if (!perms.length) {
    console.log(warn("No participant_permissions rows — role-gated actions won't work"));
  } else {
    for (const p of perms) {
      const revoked = p.revoked_at ? fail(`REVOKED at ${p.revoked_at}`) : ok("active");
      console.log(`  participant_id=${p.participant_id}  ${p.permission}  ${revoked}`);
    }
  }
} catch (e) {
  console.log(warn("Could not query participant_permissions: " + e.message));
}

// ── 4. cycle_enrollments ──────────────────────────────────────────────────
console.log("\n\x1b[1m── cycle_enrollments ─────────────────────────────────────\x1b[0m");
try {
  const enrollments = await pgQuery("cycle_enrollments", {
    select: "participant_id,cycle_id,status,enrolled_at",
    participant_id: `in.(${pIds.join(",")})`,
  });
  if (!enrollments.length) {
    console.log(warn("No cycle_enrollments — users won't have the 'participant' role"));
  } else {
    for (const e of enrollments) {
      const s = e.status === "active" ? ok(e.status) : warn(e.status);
      console.log(`  participant_id=${e.participant_id}  cycle_id=${e.cycle_id}  status=${s}`);
    }
  }
} catch (e) {
  console.log(warn("Could not query cycle_enrollments: " + e.message));
}

// ── 5. Pending invitations ─────────────────────────────────────────────────
console.log("\n\x1b[1m── invitations (pending, not expired) ────────────────────\x1b[0m");
try {
  const invParams = {
    select: "id,email,status,role_preset,expires_at,email_sent_at",
    status: "eq.pending",
    expires_at: `gt.${new Date().toISOString()}`,
  };
  if (filterEmail) invParams["email"] = `ilike.*${filterEmail}*`;
  const invitations = await pgQuery("invitations", invParams);
  if (!invitations.length) {
    console.log("  (none)");
  } else {
    for (const i of invitations) {
      console.log(`  id=${i.id}  <${i.email}>  preset=${fmt(i.role_preset)}  expires=${i.expires_at}`);
      console.log(`    email_sent_at=${fmt(i.email_sent_at)}`);
    }
  }
} catch (e) {
  console.log(warn("Could not query invitations: " + e.message));
}

// ── 6. Email casing check ─────────────────────────────────────────────────
if (filterEmail) {
  console.log("\n\x1b[1m── email casing check ────────────────────────────────────\x1b[0m");
  const exact = participants.find((p) => p.email === filterEmail);
  const caseMatch = participants.find(
    (p) => p.email.toLowerCase() === filterEmail.toLowerCase()
  );
  if (exact) {
    console.log(ok(`Exact match: '${exact.email}'`));
  } else if (caseMatch) {
    console.log(fail(`Case mismatch! DB has '${caseMatch.email}', you searched '${filterEmail}'`));
    console.log("  The callback uses .eq('email', email) which is case-sensitive in Postgres.");
    console.log("  Fix: UPDATE participants SET email = lower(email) WHERE id = " + caseMatch.id + ";");
  } else {
    console.log(fail(`No row for '${filterEmail}' — callback will redirect to /register, not let them in`));
  }
}

console.log("\n\x1b[2m──────────────────────────────────────────────────────────\x1b[0m\n");
