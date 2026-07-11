#!/usr/bin/env node
// Seed a fresh, DRIVABLE test cycle in the DEV Supabase project for manual /
// group testing (see docs/testing-plan-cycle-uat.md).
//
// Unlike supabase/seed.sql — whose cycle is a finished snapshot (all phase
// windows in the past, pods and projects already created, so the Dev-tab Testing controls
// widget reads "Cycle complete" and both finalize buttons 409) — the cycle
// this script creates is ready to walk from the beginning:
//
//   - status 'draft', every phase window unset → the admin Dev-tab Testing controls
//     widget starts at "Start first phase"
//   - no pods, no projects → both finalize steps have work to do
//   - small-cohort config (pod_min=3, project_min=2, thresholds sized for
//     5–12 humans) so a test group can trip every rule in one session
//   - optional fake enrolled participants (--fake-participants N) for
//     padding vote tallies; real testers enroll themselves through the app
//
// Usage:
//   npm run seed:test-cycle                          # create (no fakes)
//   npm run seed:test-cycle -- --fake-participants 4
//   npm run seed:test-cycle -- --cleanup <cycle_id>  # tear one down
//
// Cleanup deletes the cycle and EVERYTHING attached to it (memberships,
// projects, pods, votes, statements, proposals, enrollments, config) plus any
// fake participants this script created (matched by their tagged emails).
// Real participants' rows are never deleted — only their enrollments in the
// deleted cycle. Refuses to touch a cycle whose name doesn't start with
// "TEST" as a guard against deleting a real cycle.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const DEV_URL = "https://cethihabtddiujzayaxe.supabase.co";
const PROD_REF = "cdbgkgkjnomjnpicaxqe";

function loadDotEnvFallback() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    const raw = readFileSync(new URL("../../.env.development.local", import.meta.url), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // fall through to the explicit-env error below
  }
}

loadDotEnvFallback();

const url =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || DEV_URL;
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

if (!serviceKey) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is not set (env var or .env.development.local).");
  process.exit(1);
}
if (url.includes(PROD_REF)) {
  console.error("Refusing to run against the PROD Supabase project (docs/environments.md).");
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });
const args = process.argv.slice(2);

// ------------------------------------------------------------------ cleanup

async function cleanup(cycleId) {
  const { data: cycle } = await db
    .from("cycles")
    .select("id, name")
    .eq("id", cycleId)
    .maybeSingle();
  if (!cycle) {
    console.error(`Cycle #${cycleId} not found.`);
    process.exit(1);
  }
  if (!/^TEST/i.test(cycle.name)) {
    console.error(
      `Refusing: cycle #${cycleId} is named "${cycle.name}" — cleanup only deletes cycles whose name starts with "TEST".`
    );
    process.exit(1);
  }

  console.log(`Deleting test cycle #${cycleId} ("${cycle.name}") and all attached rows…`);
  await db.from("project_memberships").delete().eq("cycle_id", cycleId);
  await db.from("projects").delete().eq("cycle_id", cycleId);
  await db.from("project_votes").delete().eq("cycle_id", cycleId);
  await db.from("solution_proposals").delete().eq("cycle_id", cycleId);
  const { data: podRows } = await db.from("pods").select("id").eq("cycle_id", cycleId);
  const podIds = (podRows ?? []).map((p) => p.id);
  if (podIds.length) {
    await db.from("moderator_assignments").delete().in("pod_id", podIds);
    await db.from("pod_memberships").delete().in("pod_id", podIds);
  }
  await db.from("pods").delete().eq("cycle_id", cycleId);
  await db.from("votes").delete().eq("cycle_id", cycleId);
  await db.from("problem_statements").delete().eq("cycle_id", cycleId);
  await db.from("access_revocations").delete().eq("cycle_id", cycleId);
  // Cycle-scoped rows a UAT session may have produced (tables may not exist
  // on every environment — ignore missing-table errors).
  for (const table of ["pulse_checks", "nominations", "cycle_agreements", "invitations"]) {
    const { error } = await db.from(table).delete().eq("cycle_id", cycleId);
    if (error && !/does not exist|schema cache/i.test(error.message)) {
      console.warn(`  warning: could not clear ${table}: ${error.message}`);
    }
  }
  await db.from("cycle_enrollments").delete().eq("cycle_id", cycleId);
  await db.from("cycle_config").delete().eq("cycle_id", cycleId);
  const { error } = await db.from("cycles").delete().eq("id", cycleId);
  if (error) {
    console.error(`Failed to delete cycle row: ${error.message}`);
    process.exit(1);
  }

  // Fake participants created by this script are tagged by email domain and
  // are only deletable once their FK rows above are gone. Scoped to this
  // cycle's tag so parallel test cycles don't clobber each other.
  const { data: fakes } = await db
    .from("participants")
    .select("id, email")
    .like("email", `%+cycle${cycleId}@seed-test.olos.invalid`);
  if (fakes?.length) {
    await db.from("participants").delete().in("id", fakes.map((f) => f.id));
    console.log(`Deleted ${fakes.length} fake participants.`);
  }
  console.log("Done.");
}

// -------------------------------------------------------------------- seed

async function seed(fakeCount) {
  const today = new Date().toISOString().slice(0, 10);
  const DAY = 86_400_000;

  const { data: cycle, error: cycleError } = await db
    .from("cycles")
    .insert({
      name: `TEST cycle — seeded ${today}`,
      start_date: new Date().toISOString(),
      end_date: new Date(Date.now() + 91 * DAY).toISOString(),
      // 'draft': dev carries out-of-band one_active_open_cycle /
      // one_upcoming_open_cycle unique indexes, and the Testing controls'' first
      // advance flips draft cycles to active anyway.
      status: "draft",
      description:
        "Seeded by scripts/ops/seed-test-cycle.mjs for group testing. Safe to delete.",
    })
    .select()
    .single();
  if (cycleError) {
    console.error(`Failed to create cycle: ${cycleError.message}`);
    process.exit(1);
  }

  // Small-cohort parameters per docs/testing-plan-cycle-uat.md: sized so a
  // 5–12 person group can hit both "meets threshold" and "misses threshold"
  // outcomes, activate one pod naturally, and leave one pod under-min for
  // the force-activate step. Phase windows stay NULL — the Testing controls
  // widget drives them.
  const { error: configError } = await db.from("cycle_config").insert({
    cycle_id: cycle.id,
    vote_threshold: 3,
    max_pods: 2,
    pod_min: 3,
    project_vote_threshold: 2,
    max_projects: 2,
    project_min: 2,
    project_max: 5,
    submitter_votes: 5,
    non_submitter_votes: 3,
  });
  if (configError) {
    console.error(`Failed to create cycle_config: ${configError.message}`);
    await db.from("cycles").delete().eq("id", cycle.id);
    process.exit(1);
  }

  const fakes = [];
  for (let i = 0; i < fakeCount; i++) {
    const { data: p, error } = await db
      .from("participants")
      .insert({
        google_id: `seed-test-c${cycle.id}-p${i}`,
        email: `fake-tester-${i}+cycle${cycle.id}@seed-test.olos.invalid`,
        first_name: `Fake${i}`,
        last_name: "Tester",
      })
      .select("id")
      .single();
    if (error) {
      console.error(`Failed to create fake participant ${i}: ${error.message}`);
      continue;
    }
    await db.from("cycle_enrollments").insert({
      participant_id: p.id,
      cycle_id: cycle.id,
    });
    fakes.push(p.id);
  }

  console.log(`
Created test cycle #${cycle.id}: "${cycle.name}"
  - status: draft, phase windows unset → Testing controls show "Start first phase"
  - config: vote_threshold=3 max_pods=2 pod_min=3 | project_vote_threshold=2 max_projects=2 project_min=2 project_max=5
  - fake enrolled participants: ${fakes.length}${fakes.length ? ` (ids ${fakes.join(", ")})` : ""}

Next steps (facilitator):
  1. Open /admin/cycles/${cycle.id} as an admin.
  2. Have testers sign in and register; enroll them in this cycle.
  3. Drive the session per docs/testing-plan-cycle-uat.md.

Tear down afterwards:
  npm run seed:test-cycle -- --cleanup ${cycle.id}
`);
}

// -------------------------------------------------------------------- main

const cleanupIdx = args.indexOf("--cleanup");
if (cleanupIdx !== -1) {
  const id = parseInt(args[cleanupIdx + 1], 10);
  if (!Number.isInteger(id)) {
    console.error("Usage: npm run seed:test-cycle -- --cleanup <cycle_id>");
    process.exit(1);
  }
  await cleanup(id);
} else {
  const fakeIdx = args.indexOf("--fake-participants");
  const fakeCount =
    fakeIdx !== -1 ? Math.max(0, parseInt(args[fakeIdx + 1], 10) || 0) : 0;
  await seed(fakeCount);
}
