/**
 * seed-cycle.mjs
 *
 * Drives a full pod + project lifecycle end-to-end so the flow can be verified
 * against a running app or asserted at the DB level. Seeds a namespaced test
 * cycle ("ZZ_SEED_VERIFY"), then exercises the fixes from the
 * pod/project-creation hardening work:
 *   - 1a  project re-registration after withdrawal (reactivation, not re-insert)
 *   - 1c  pod-vote upsert (re-allocate) + withdraw (delete)
 *   - T3  failed-formation: dissolve under-min pods/projects + reconcile enrollments
 *
 * Usage (from the repo root, with .env.local pointing at the DEV project):
 *   node scripts/seed-cycle.mjs            # seed + run assertions + teardown
 *   node scripts/seed-cycle.mjs --keep     # seed + assert, leave data for manual app walkthrough
 *   node scripts/seed-cycle.mjs --teardown # remove all ZZ_SEED_VERIFY data and exit
 *   node scripts/seed-cycle.mjs --dry-run  # print what would happen, touch nothing
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local
 * (falls back to process.env). Refuses to run against the prod project ref.
 *
 * Safety: everything is namespaced under the cycle name ZZ_SEED_VERIFY and
 * participant emails matching zzseed+%@example.test, so --teardown is precise.
 * The cycle is created with status='draft' because the DB enforces a single
 * active/open cycle (partial unique index one_active_open_cycle).
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const MARKER = "ZZ_SEED_VERIFY";
const EMAIL_LIKE = "zzseed+%@example.test";
const PROD_REF = "cdbgkgkjnomjnpicaxqe"; // OLOS-prod — never touch

const args = new Set(process.argv.slice(2));
const DRY = args.has("--dry-run");
const KEEP = args.has("--keep");
const TEARDOWN_ONLY = args.has("--teardown");

// ── env ────────────────────────────────────────────────────────────────────
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
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
if (URL.includes(PROD_REF)) {
  console.error("Refusing to run against the prod project. This script is dev-only.");
  process.exit(1);
}

const db = createClient(URL, KEY, { auth: { persistSession: false } });

// ── assertion helpers ────────────────────────────────────────────────────────
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

async function teardown() {
  const { data: cycle } = await db.from("cycles").select("id").eq("name", MARKER).maybeSingle();
  if (cycle) {
    const cid = cycle.id;
    await db.from("project_votes").delete().eq("cycle_id", cid);
    await db.from("project_memberships").delete().eq("cycle_id", cid);
    await db.from("projects").delete().eq("cycle_id", cid);
    await db.from("solution_proposals").delete().eq("cycle_id", cid);
    const { data: pods } = await db.from("pods").select("id").eq("cycle_id", cid);
    for (const p of pods ?? []) await db.from("pod_memberships").delete().eq("pod_id", p.id);
    await db.from("pods").delete().eq("cycle_id", cid);
    await db.from("votes").delete().eq("cycle_id", cid);
    await db.from("problem_statements").delete().eq("cycle_id", cid);
    await db.from("cycle_enrollments").delete().eq("cycle_id", cid);
    await db.from("cycle_config").delete().eq("cycle_id", cid);
    await db.from("cycles").delete().eq("id", cid);
  }
  // Clean up seeded participants and their permission rows (the [ACCESS] block
  // grants a labs_lead permission set; participant_permissions may not cascade).
  const { data: seededParts } = await db.from("participants").select("id").like("email", EMAIL_LIKE);
  const seededIds = (seededParts ?? []).map((p) => p.id);
  if (seededIds.length) {
    await db.from("participant_permissions").delete().in("participant_id", seededIds);
  }
  await db.from("participants").delete().like("email", EMAIL_LIKE);
}

async function main() {
  if (TEARDOWN_ONLY) {
    if (DRY) return console.log("[dry-run] would remove all ZZ_SEED_VERIFY data.");
    await teardown();
    return console.log("Teardown complete.");
  }
  if (DRY) {
    return console.log(
      "[dry-run] would seed cycle ZZ_SEED_VERIFY (draft), 6 participants, 2 pods, 2 projects,\n" +
        "then assert 1a reactivation, 1c vote upsert/withdraw, T3 resolve-formation, then " +
        (KEEP ? "keep the data." : "tear down.")
    );
  }

  // Start clean.
  await teardown();

  // ── seed base hierarchy ────────────────────────────────────────────────────
  const { data: cycle } = await db
    .from("cycles")
    .insert({ name: MARKER, start_date: new Date().toISOString(), end_date: new Date(Date.now() + 90 * 864e5).toISOString(), status: "draft" })
    .select("id")
    .single();
  const cid = cycle.id;

  // Registration windows already closed, so the failed-formation resolver is eligible.
  const past = new Date(Date.now() - 864e5).toISOString();
  await db.from("cycle_config").insert({
    cycle_id: cid, submitter_votes: 3, non_submitter_votes: 1, vote_threshold: 1,
    max_pods: 8, pod_min: 2, pod_limit: 2, project_submitter_votes: 3, project_vote_threshold: 1,
    max_projects: 8, project_min: 2, project_max: 7,
    pod_registration_close: past, project_registration_close: past,
  });

  const parts = [];
  for (let i = 1; i <= 6; i++) {
    const { data } = await db
      .from("participants")
      .insert({ google_id: `zzseed-${i}`, email: `zzseed+${i}@example.test`, first_name: "Seed", last_name: `User${i}` })
      .select("id")
      .single();
    parts.push(data.id);
  }
  await db.from("cycle_enrollments").insert(parts.map((pid) => ({ participant_id: pid, cycle_id: cid, status: "active" })));

  const { data: ps } = await db.from("problem_statements").insert({ cycle_id: cid, participant_id: parts[0], statement_text: "ZZ seed problem statement" }).select("id").single();

  const { data: pod1 } = await db.from("pods").insert({ cycle_id: cid, problem_statement_id: ps.id, name: "ZZ Pod One", status: "active" }).select("id").single();
  const { data: pod2 } = await db.from("pods").insert({ cycle_id: cid, problem_statement_id: ps.id, name: "ZZ Pod Two", status: "forming" }).select("id").single();
  await db.from("pod_memberships").insert([
    { participant_id: parts[0], pod_id: pod1.id },
    { participant_id: parts[1], pod_id: pod1.id },
    { participant_id: parts[2], pod_id: pod2.id }, // pod2 under pod_min -> T3 dissolves
  ]);

  const { data: sp } = await db.from("solution_proposals").insert({ cycle_id: cid, pod_id: pod1.id, participant_id: parts[0], name: "ZZ Solution", summary: "ZZ summary", proposal_data: { description: "ZZ desc" } }).select("id").single();

  const { data: prj1 } = await db.from("projects").insert({ cycle_id: cid, pod_id: pod1.id, solution_proposal_id: sp.id, name: "ZZ Project One", status: "active" }).select("id").single();
  const { data: prj2 } = await db.from("projects").insert({ cycle_id: cid, pod_id: pod1.id, solution_proposal_id: sp.id, name: "ZZ Project Two", status: "forming" }).select("id").single();
  await db.from("project_memberships").insert([
    { participant_id: parts[0], project_id: prj1.id, cycle_id: cid },
    { participant_id: parts[1], project_id: prj1.id, cycle_id: cid },
    { participant_id: parts[2], project_id: prj2.id, cycle_id: cid }, // prj2 under project_min -> T3 dissolves
  ]);

  console.log(`Seeded cycle ${cid}: 6 participants, pods ${pod1.id}/${pod2.id}, projects ${prj1.id}/${prj2.id}.`);

  // ── 1a: project reactivation after withdrawal ──────────────────────────────
  console.log("\n[1a] project re-registration after withdrawal");
  await db.from("project_memberships").update({ left_at: new Date().toISOString() }).eq("project_id", prj1.id).eq("participant_id", parts[1]);
  const { data: origRow } = await db.from("project_memberships").select("registered_at").eq("project_id", prj1.id).eq("participant_id", parts[1]).single();
  const reinsert = await db.from("project_memberships").insert({ participant_id: parts[1], project_id: prj1.id, cycle_id: cid });
  assert("old plain re-insert is rejected by UNIQUE(participant_id, project_id)", !!reinsert.error, reinsert.error ? "" : "insert unexpectedly succeeded");
  const { data: react } = await db.from("project_memberships").update({ left_at: null }).eq("project_id", prj1.id).eq("participant_id", parts[1]).select("registered_at").single();
  assert("reactivation clears left_at and preserves registered_at", react && react.registered_at === origRow.registered_at);

  // ── 1c: pod vote upsert + withdraw ─────────────────────────────────────────
  console.log("\n[1c] pod vote upsert (re-allocate) + withdraw");
  await db.from("votes").delete().eq("problem_statement_id", ps.id).eq("voter_id", parts[0]);
  await db.from("votes").insert({ cycle_id: cid, voter_id: parts[0], problem_statement_id: ps.id, vote_count: 2 });
  await db.from("votes").upsert({ cycle_id: cid, voter_id: parts[0], problem_statement_id: ps.id, vote_count: 3 }, { onConflict: "voter_id,problem_statement_id,cycle_id" });
  const { data: after } = await db.from("votes").select("vote_count").eq("problem_statement_id", ps.id).eq("voter_id", parts[0]);
  assert("upsert keeps one row and updates 2 -> 3", after.length === 1 && after[0].vote_count === 3, JSON.stringify(after));
  await db.from("votes").delete().eq("cycle_id", cid).eq("voter_id", parts[0]).eq("problem_statement_id", ps.id);
  const { count: voteCount } = await db.from("votes").select("id", { count: "exact", head: true }).eq("problem_statement_id", ps.id).eq("voter_id", parts[0]);
  assert("withdraw deletes the row", voteCount === 0);

  // ── 4a: project vote upsert + withdraw (unified onto the pod model) ─────────
  console.log("\n[4a] project vote upsert (re-allocate) + withdraw");
  await db.from("project_votes").delete().eq("solution_proposal_id", sp.id).eq("voter_id", parts[0]);
  await db.from("project_votes").insert({ cycle_id: cid, pod_id: pod1.id, voter_id: parts[0], solution_proposal_id: sp.id, vote_count: 1 });
  await db.from("project_votes").upsert({ cycle_id: cid, pod_id: pod1.id, voter_id: parts[0], solution_proposal_id: sp.id, vote_count: 3 }, { onConflict: "voter_id,solution_proposal_id,pod_id" });
  const { data: pvAfter } = await db.from("project_votes").select("vote_count").eq("solution_proposal_id", sp.id).eq("voter_id", parts[0]);
  assert("project upsert keeps one row and updates 1 -> 3", pvAfter.length === 1 && pvAfter[0].vote_count === 3, JSON.stringify(pvAfter));
  await db.from("project_votes").delete().eq("pod_id", pod1.id).eq("voter_id", parts[0]).eq("solution_proposal_id", sp.id);
  const { count: pvCount } = await db.from("project_votes").select("id", { count: "exact", head: true }).eq("solution_proposal_id", sp.id).eq("voter_id", parts[0]);
  assert("project withdraw deletes the row", pvCount === 0);

  // ── ADMIN: project status override + membership cap + cycle metro ───────────
  console.log("\n[ADMIN] project status override + 1-per-cycle cap + metro");
  const { data: prj3 } = await db.from("projects").insert({ cycle_id: cid, pod_id: pod1.id, solution_proposal_id: sp.id, name: "ZZ Project Three", status: "forming" }).select("id").single();
  await db.from("projects").update({ status: "active", updated_at: new Date().toISOString() }).eq("id", prj3.id).eq("status", "forming");
  const { data: prj3row } = await db.from("projects").select("status").eq("id", prj3.id).single();
  assert("admin project status override forming -> active", prj3row.status === "active");

  await db.from("project_memberships").insert({ participant_id: parts[4], project_id: prj3.id, cycle_id: cid });
  const dup = await db.from("project_memberships").insert({ participant_id: parts[4], project_id: prj1.id, cycle_id: cid });
  assert("1-project-per-cycle cap enforced by partial unique index", !!dup.error);

  await db.from("cycles").update({ metro_slug: "dc" }).eq("id", cid);
  const { data: cyc } = await db.from("cycles").select("metro_slug").eq("id", cid).single();
  assert("cycle.metro_slug set/read", cyc.metro_slug === "dc");

  // ── ACCESS: labs_lead metro-scoped cycle management ─────────────────────────
  // Mirrors lib/auth/cycle-access.ts::canManageCycle at the data level: a labs
  // lead (pods:write, no cycles:write) with a metro may manage same-metro
  // cycles only. The authenticated HTTP path is exercised separately by
  // scripts/verify-labs-lead-access.mjs.
  console.log("\n[ACCESS] labs_lead metro-scoped cycle management");
  const { data: lead } = await db
    .from("participants")
    .insert({ google_id: "zzseed-lead", email: "zzseed+lead@example.test", first_name: "Seed", last_name: "Lead", metro_slug: "dc" })
    .select("id, metro_slug")
    .single();
  const labsLeadPerms = ["pods:read", "pods:write", "participants:read", "pulse_checks:read"];
  await db.from("participant_permissions").insert(
    labsLeadPerms.map((permission) => ({ participant_id: lead.id, permission }))
  );
  const { data: permRows } = await db
    .from("participant_permissions")
    .select("permission")
    .eq("participant_id", lead.id)
    .is("revoked_at", null);
  const permSet = new Set((permRows ?? []).map((r) => r.permission));

  // Faithful mirror of canManageLifecycle / isFullCycleAdmin / canManageCycle.
  const canManageLifecycle = permSet.has("pods:write");
  const isFullCycleAdmin = permSet.has("cycles:write");
  const canManageCycle = (cycleMetro) =>
    canManageLifecycle &&
    (isFullCycleAdmin ||
      (!!cycleMetro && !!lead.metro_slug && cycleMetro === lead.metro_slug));

  assert("labs_lead has pods:write but not cycles:write", canManageLifecycle && !isFullCycleAdmin);
  assert("labs_lead can manage a same-metro cycle (dc == dc)", canManageCycle("dc") === true);
  assert("labs_lead cannot manage a different-metro cycle (baltimore)", canManageCycle("baltimore") === false);
  assert("labs_lead cannot manage a metro-less cycle", canManageCycle(null) === false);

  // ── T3: resolve-formation (dissolve under-min + reconcile) ──────────────────
  console.log("\n[T3] failed-formation resolution");
  // pods
  const { data: formingPods } = await db.from("pods").select("id").eq("cycle_id", cid).eq("status", "forming");
  let podsDissolved = 0;
  for (const pod of formingPods ?? []) {
    const { count } = await db.from("pod_memberships").select("id", { count: "exact", head: true }).eq("pod_id", pod.id).is("inactive_at", null);
    if ((count ?? 0) < 2) {
      const { data } = await db.from("pods").update({ status: "inactive", updated_at: new Date().toISOString() }).eq("id", pod.id).eq("status", "forming").select("id").maybeSingle();
      if (data) podsDissolved++;
    }
  }
  // reconcile enrollments (active iff active membership in an active pod)
  for (const pid of parts) {
    const { data: mems } = await db.from("pod_memberships").select("pods!inner(cycle_id,status)").eq("participant_id", pid).is("inactive_at", null);
    const active = (mems ?? []).some((m) => m.pods && m.pods.cycle_id === cid && m.pods.status === "active");
    await db.from("cycle_enrollments").update({ status: active ? "active" : "inactive", inactive_date: active ? null : new Date().toISOString() }).eq("cycle_id", cid).eq("participant_id", pid);
  }
  // projects
  const { data: formingProjects } = await db.from("projects").select("id").eq("cycle_id", cid).eq("status", "forming");
  let projectsDissolved = 0;
  for (const project of formingProjects ?? []) {
    const { count } = await db.from("project_memberships").select("id", { count: "exact", head: true }).eq("project_id", project.id).is("left_at", null);
    if ((count ?? 0) < 2) {
      const { data } = await db.from("projects").update({ status: "inactive", updated_at: new Date().toISOString() }).eq("id", project.id).eq("status", "forming").select("id").maybeSingle();
      if (data) projectsDissolved++;
    }
  }
  assert("one under-min pod dissolved", podsDissolved === 1, `got ${podsDissolved}`);
  assert("one under-min project dissolved", projectsDissolved === 1, `got ${projectsDissolved}`);
  const { data: pod1Row } = await db.from("pods").select("status").eq("id", pod1.id).single();
  assert("full pod stays active", pod1Row.status === "active");
  const { data: enr3 } = await db.from("cycle_enrollments").select("status").eq("cycle_id", cid).eq("participant_id", parts[2]).single();
  assert("member of dissolved pod is demoted to inactive enrollment", enr3.status === "inactive");
  const { data: enr1 } = await db.from("cycle_enrollments").select("status").eq("cycle_id", cid).eq("participant_id", parts[0]).single();
  assert("member of active pod stays active", enr1.status === "active");

  // ── report + cleanup ───────────────────────────────────────────────────────
  console.log(`\n${pass} passed, ${fail} failed.`);
  if (!KEEP) {
    await teardown();
    console.log("Teardown complete.");
  } else {
    console.log("Data kept (--keep). Run with --teardown to remove.");
  }
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
