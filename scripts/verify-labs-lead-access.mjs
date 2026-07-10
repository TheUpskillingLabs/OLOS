/**
 * Authenticated end-to-end verification for the metro-scoped labs_lead access
 * model — the HTTP counterpart to the [ACCESS] block in seed-cycle.mjs, which
 * only asserts the predicate at the data level.
 *
 * This seeds a real password auth user, grants it the labs_lead permission set
 * + a metro, signs it in through @supabase/ssr (so the exact sb-<ref>-auth-token
 * cookie the server decodes is produced for us — no hand-rolled base64/chunking),
 * and drives the running app over HTTP:
 *
 *   1. no cookie                       → 401  (withAuth)
 *   2. labs lead, DIFFERENT-metro proj → 403  (requireCycleManagement)
 *   3. labs lead, SAME-metro project   → 200  (gate passes; forming→active)
 *   4. labs lead, admin-only route     → 403  (withAdminAuth / cycles:write)
 *
 * Usage:
 *   npm run dev                                   # in one shell (or set APP_URL)
 *   node scripts/verify-labs-lead-access.mjs      # seed + assert + teardown
 *   node scripts/verify-labs-lead-access.mjs --teardown
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and
 * SUPABASE_SERVICE_ROLE_KEY from .env.local (falls back to process.env).
 * Refuses to run against the prod project ref. Everything is namespaced under
 * the ZZ_AUTH_VERIFY cycles and zzauth+%@example.test emails so teardown is
 * precise.
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const MARKER = "ZZ_AUTH_VERIFY";
const EMAIL_LIKE = "zzauth+%@example.test";
const LEAD_EMAIL = "zzauth+lead@example.test";
const LEAD_PASSWORD = "zz-seed-Passw0rd!";
const PROD_REF = "cdbgkgkjnomjnpicaxqe";

const args = new Set(process.argv.slice(2));
const TEARDOWN_ONLY = args.has("--teardown");

function loadEnvFile(path) {
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      const k = t.slice(0, i).trim();
      if (!process.env[k]) process.env[k] = t.slice(i + 1).trim();
    }
  } catch {
    /* file optional */
  }
}
loadEnvFile(".env.local");

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = process.env.APP_URL || "http://localhost:3000";
if (!URL || !ANON || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
if (URL.includes(PROD_REF)) {
  console.error("Refusing to run against the prod project. This script is dev-only.");
  process.exit(1);
}

const db = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

let pass = 0;
let fail = 0;
function assert(label, ok, detail = "") {
  if (ok) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function findLeadAuthUser() {
  // admin.listUsers is paginated; the seed set is tiny so page 1 suffices.
  const { data } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  return (data?.users ?? []).find((u) => u.email === LEAD_EMAIL) ?? null;
}

async function teardown() {
  const { data: cycles } = await db.from("cycles").select("id").like("name", `${MARKER}%`);
  for (const c of cycles ?? []) {
    const cid = c.id;
    await db.from("project_memberships").delete().eq("cycle_id", cid);
    await db.from("projects").delete().eq("cycle_id", cid);
    await db.from("solution_proposals").delete().eq("cycle_id", cid);
    const { data: pods } = await db.from("pods").select("id").eq("cycle_id", cid);
    for (const p of pods ?? []) await db.from("pod_memberships").delete().eq("pod_id", p.id);
    await db.from("pods").delete().eq("cycle_id", cid);
    await db.from("problem_statements").delete().eq("cycle_id", cid);
    await db.from("cycle_enrollments").delete().eq("cycle_id", cid);
    await db.from("cycle_config").delete().eq("cycle_id", cid);
    await db.from("cycles").delete().eq("id", cid);
  }
  const { data: parts } = await db.from("participants").select("id").like("email", EMAIL_LIKE);
  const ids = (parts ?? []).map((p) => p.id);
  if (ids.length) await db.from("participant_permissions").delete().in("participant_id", ids);
  await db.from("participants").delete().like("email", EMAIL_LIKE);
  const authUser = await findLeadAuthUser();
  if (authUser) await db.auth.admin.deleteUser(authUser.id);
}

// Minimal cycle_config so the cycle rows are valid; the values are irrelevant to
// the access checks (they gate on metro_slug only).
function configFor(cid) {
  return {
    cycle_id: cid, submitter_votes: 3, non_submitter_votes: 1, vote_threshold: 1,
    max_pods: 8, pod_min: 2, pod_limit: 2, project_submitter_votes: 3, project_vote_threshold: 1,
    max_projects: 8, project_min: 2, project_max: 7,
  };
}

async function seedCycle(metro, authorId) {
  const { data: cycle } = await db
    .from("cycles")
    .insert({ name: `${MARKER}_${metro.toUpperCase()}`, start_date: new Date().toISOString(), end_date: new Date(Date.now() + 90 * 864e5).toISOString(), status: "draft", metro_slug: metro })
    .select("id")
    .single();
  const cid = cycle.id;
  await db.from("cycle_config").insert(configFor(cid));
  const { data: ps } = await db.from("problem_statements").insert({ cycle_id: cid, participant_id: authorId, statement_text: `${MARKER} problem` }).select("id").single();
  const { data: pod } = await db.from("pods").insert({ cycle_id: cid, problem_statement_id: ps.id, name: `${MARKER} Pod`, status: "active" }).select("id").single();
  const { data: sp } = await db.from("solution_proposals").insert({ cycle_id: cid, pod_id: pod.id, participant_id: authorId, name: `${MARKER} Solution`, summary: "s", proposal_data: { description: "d" } }).select("id").single();
  const { data: project } = await db.from("projects").insert({ cycle_id: cid, pod_id: pod.id, solution_proposal_id: sp.id, name: `${MARKER} Project`, status: "forming" }).select("id").single();
  return { cid, projectId: project.id };
}

/** Sign the lead in through @supabase/ssr and return the Cookie header string. */
async function buildLeadCookie() {
  const jar = new Map();
  const ssr = createServerClient(URL, ANON, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (list) => { for (const { name, value } of list) jar.set(name, value); },
    },
  });
  const { error } = await ssr.auth.signInWithPassword({ email: LEAD_EMAIL, password: LEAD_PASSWORD });
  if (error) throw new Error(`signInWithPassword failed: ${error.message}`);
  if (jar.size === 0) throw new Error("no auth cookie was set by @supabase/ssr");
  return [...jar.entries()].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");
}

async function patchStatus(projectId, cookie) {
  const res = await fetch(`${BASE}/api/admin/projects/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify({ status: "active" }),
  });
  return res.status;
}

async function patchCycleStatus(cycleId, cookie) {
  const res = await fetch(`${BASE}/api/cycles/${cycleId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify({ status: "upcoming" }),
  });
  return res.status;
}

async function main() {
  if (TEARDOWN_ONLY) {
    await teardown();
    return console.log("Teardown complete.");
  }

  // Confirm the app is reachable before seeding, so a forgotten `npm run dev`
  // fails fast with a clear message instead of mid-run.
  try {
    await fetch(`${BASE}/api/cycles`, { method: "GET" });
  } catch {
    console.error(`Cannot reach the app at ${BASE}. Start it with "npm run dev" or set APP_URL.`);
    process.exit(1);
  }

  await teardown();

  // Auth user + participant (metro dc) + labs_lead permission set. Created first
  // because problem_statements / solution_proposals require a NOT NULL author.
  const { data: created, error: cErr } = await db.auth.admin.createUser({
    email: LEAD_EMAIL, password: LEAD_PASSWORD, email_confirm: true,
  });
  if (cErr) throw new Error(`createUser failed: ${cErr.message}`);
  const { data: lead } = await db
    .from("participants")
    .insert({ google_id: "zzauth-lead", email: LEAD_EMAIL, first_name: "Seed", last_name: "Lead", metro_slug: "dc", auth_user_id: created.user.id })
    .select("id")
    .single();
  await db.from("participant_permissions").insert(
    ["pods:read", "pods:write", "participants:read", "pulse_checks:read"].map((permission) => ({ participant_id: lead.id, permission }))
  );

  const dc = await seedCycle("dc", lead.id);
  const bal = await seedCycle("baltimore", lead.id);

  console.log(`Seeded dc cycle ${dc.cid} (project ${dc.projectId}), baltimore cycle ${bal.cid} (project ${bal.projectId}).`);

  const cookie = await buildLeadCookie();

  console.log("\n[HTTP] metro-scoped labs_lead access");
  const s1 = await patchStatus(dc.projectId, null);
  assert("no cookie → 401", s1 === 401, `got ${s1}`);

  const s2 = await patchStatus(bal.projectId, cookie);
  assert("labs lead, cross-metro project → 403", s2 === 403, `got ${s2}`);

  const s3 = await patchStatus(dc.projectId, cookie);
  assert("labs lead, same-metro project → 200", s3 === 200, `got ${s3}`);

  const s4 = await patchCycleStatus(dc.cid, cookie);
  assert("labs lead, admin-only cycle-status route → 403", s4 === 403, `got ${s4}`);

  console.log(`\n${pass} passed, ${fail} failed.`);
  await teardown();
  console.log("Teardown complete.");
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  try { await teardown(); } catch { /* best effort */ }
  process.exit(1);
});
