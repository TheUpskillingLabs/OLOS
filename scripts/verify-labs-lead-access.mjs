/**
 * Authenticated end-to-end verification for the HQ / Local-Lab access model —
 * the HTTP counterpart to the [ACCESS] block in seed-cycle.mjs.
 *
 * Seeds a real password auth user, grants it the labs_lead permission set + a
 * metro (dc), signs it in through @supabase/ssr (so the exact sb-<ref>-auth-token
 * cookie the server decodes is produced for us), and drives the running app:
 *
 *   Pod/project management (lab boundary is on the pod/project):
 *     - no cookie                                   → 401
 *     - lead, SAME-lab project in a shared HQ cycle → 200 (forming→active)
 *     - lead, OTHER-lab project in the same cycle   → 403
 *   Cycle config (only your own lab's cycle):
 *     - lead configures own dc local cycle          → 200
 *     - lead configures a shared HQ-open cycle      → 403
 *     - lead configures another lab's (bal) cycle   → 403
 *     - lead configures an HQ-internal/org cycle    → 403
 *   Cycle create:
 *     - lead creates a cycle (forced to their lab)  → 201, metro_slug = dc
 *
 * Usage:
 *   npm run dev                               # or set APP_URL
 *   node scripts/verify-labs-lead-access.mjs  # seed + assert + teardown
 *   node scripts/verify-labs-lead-access.mjs --teardown
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY /
 * SUPABASE_SERVICE_ROLE_KEY from .env.local. Refuses to run against prod.
 * Everything is namespaced under ZZ_AUTH_VERIFY cycles + zzauth+%@example.test.
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

function configFor(cid) {
  return {
    cycle_id: cid, submitter_votes: 3, non_submitter_votes: 1, vote_threshold: 1,
    max_pods: 8, pod_min: 2, pod_limit: 2, project_submitter_votes: 3, project_vote_threshold: 1,
    max_projects: 8, project_min: 2, project_max: 7,
  };
}

async function seedCycle(suffix, { metro = null, internal = false } = {}) {
  const { data: cycle } = await db
    .from("cycles")
    .insert({
      name: `${MARKER}_${suffix}`,
      start_date: new Date().toISOString(),
      end_date: new Date(Date.now() + 90 * 864e5).toISOString(),
      status: "draft",
      metro_slug: metro,
      is_hq_internal: internal,
    })
    .select("id")
    .single();
  await db.from("cycle_config").insert(configFor(cycle.id));
  return cycle.id;
}

/** A pod (+ forming project) stamped with a lab, inside cycle `cid`. */
async function seedLabPod(cid, authorId, metro) {
  const { data: ps } = await db.from("problem_statements").insert({ cycle_id: cid, participant_id: authorId, statement_text: `${MARKER} problem` }).select("id").single();
  const { data: pod } = await db.from("pods").insert({ cycle_id: cid, problem_statement_id: ps.id, name: `${MARKER} ${metro} Pod`, status: "active", metro_slug: metro }).select("id").single();
  const { data: project } = await db.from("projects").insert({ cycle_id: cid, pod_id: pod.id, name: `${MARKER} ${metro} Project`, status: "forming", metro_slug: metro }).select("id").single();
  return { podId: pod.id, projectId: project.id };
}

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

function req(method, path, cookie, body) {
  return fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then((r) => r.status);
}

async function main() {
  if (TEARDOWN_ONLY) {
    await teardown();
    return console.log("Teardown complete.");
  }

  try {
    await fetch(`${BASE}/api/cycles`, { method: "GET" });
  } catch {
    console.error(`Cannot reach the app at ${BASE}. Start it with "npm run dev" or set APP_URL.`);
    process.exit(1);
  }

  await teardown();

  // Lead auth user + participant (dc) + labs_lead perms. Created first because
  // problem_statements require a NOT NULL author.
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

  // Shared HQ-open cycle with one dc pod/project and one baltimore pod/project.
  const hqOpen = await seedCycle("HQOPEN", { metro: null, internal: false });
  const dcEntities = await seedLabPod(hqOpen, lead.id, "dc");
  const balEntities = await seedLabPod(hqOpen, lead.id, "baltimore");

  // A dc local cycle (lead's own), a baltimore local cycle, an HQ-internal cycle.
  const dcLocal = await seedCycle("DCLOCAL", { metro: "dc", internal: false });
  const balLocal = await seedCycle("BALLOCAL", { metro: "baltimore", internal: false });
  const orgCycle = await seedCycle("ORG", { metro: null, internal: true });

  console.log(
    `Seeded HQ-open ${hqOpen} (dc proj ${dcEntities.projectId}, bal proj ${balEntities.projectId}); ` +
      `dcLocal ${dcLocal}, balLocal ${balLocal}, org ${orgCycle}.`
  );

  const cookie = await buildLeadCookie();

  console.log("\n[HTTP] pod/project management (lab boundary on the entity)");
  assert("no cookie → 401", (await req("PATCH", `/api/admin/projects/${dcEntities.projectId}`, null, { status: "active" })) === 401);
  const s2 = await req("PATCH", `/api/admin/projects/${dcEntities.projectId}`, cookie, { status: "active" });
  assert("lead, same-lab project in a shared HQ cycle → 200", s2 === 200, `got ${s2}`);
  const s3 = await req("PATCH", `/api/admin/projects/${balEntities.projectId}`, cookie, { status: "active" });
  assert("lead, other-lab project in the same cycle → 403", s3 === 403, `got ${s3}`);

  console.log("\n[HTTP] cycle config (only your own lab's cycle)");
  const c1 = await req("PATCH", `/api/cycles/${dcLocal}/config`, cookie, { vote_threshold: 2 });
  assert("lead configures own dc local cycle → 200", c1 === 200, `got ${c1}`);
  const c2 = await req("PATCH", `/api/cycles/${hqOpen}/config`, cookie, { vote_threshold: 2 });
  assert("lead configures a shared HQ-open cycle → 403", c2 === 403, `got ${c2}`);
  const c3 = await req("PATCH", `/api/cycles/${balLocal}/config`, cookie, { vote_threshold: 2 });
  assert("lead configures another lab's cycle → 403", c3 === 403, `got ${c3}`);
  const c4 = await req("PATCH", `/api/cycles/${orgCycle}/config`, cookie, { vote_threshold: 2 });
  assert("lead configures an HQ-internal cycle → 403", c4 === 403, `got ${c4}`);

  console.log("\n[HTTP] cycle create (forced to the lead's own lab)");
  const createRes = await fetch(`${BASE}/api/cycles`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      name: `${MARKER}_LEADMADE`,
      start_date: new Date().toISOString(),
      end_date: new Date(Date.now() + 60 * 864e5).toISOString(),
      // Attempt to smuggle another lab / HQ-open — must be ignored.
      metro_slug: "baltimore",
      is_hq_internal: true,
    }),
  });
  assert("lead creates a cycle → 201", createRes.status === 201, `got ${createRes.status}`);
  if (createRes.status === 201) {
    const made = await createRes.json();
    assert("created cycle is forced to the lead's lab (dc)", made.metro_slug === "dc", `got ${made.metro_slug}`);
    assert("created cycle is not HQ-internal", made.is_hq_internal === false, `got ${made.is_hq_internal}`);
  }

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
