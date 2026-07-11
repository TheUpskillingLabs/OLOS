#!/usr/bin/env node
// Live end-to-end walk of the full cycle lifecycle against the DEV Supabase
// project, at the data layer:
//
//   create cycle + config → enroll participants → problem statements → votes
//   → finalize pods (threshold + max_pods cap) → pod registration
//   (forming → active flip at pod_min + enrollment reconciliation)
//   → force-activate an under-min pod → solution proposals → project votes
//   → finalize projects (threshold + shortlist cap) → project registration
//   (1-per-cycle unique index, withdraw/re-register, forming → active flip)
//
// Everything this script creates is uniquely tagged and deleted in a
// `finally` block (FK-safe order), even when a step fails. Pass --keep to
// leave the data in place for inspection in the admin UI.
//
// What this proves: the dev database schema + constraints + the intended
// flow semantics (thresholds, caps, unique indexes, soft deletes, status
// flips) compose end-to-end. Route-handler logic (auth, windows, RLS under
// user-bound clients) is covered by the unit tests and the UAT plan in
// docs/testing-plan-cycle-uat.md — this script uses the service role, so it
// intentionally mirrors the selection/activation logic of
// lib/voting/tally.ts, lib/projects/shortlist.ts, lib/llm/names.ts
// (nameFallback) and lib/enrollment/reconciler.ts inline. If those rules
// change, update this script alongside them.
//
// Usage:
//   SUPABASE_SERVICE_ROLE_KEY=... npm run verify:cycle [-- --keep]
//
// The Supabase URL defaults to the OLOS-dev project (docs/environments.md);
// override with SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL. Running against the
// prod project is refused outright.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const DEV_URL = "https://cethihabtddiujzayaxe.supabase.co";
const PROD_REF = "cdbgkgkjnomjnpicaxqe";

// ---------------------------------------------------------------- env setup

function loadDotEnvFallback() {
  // Convenience for local runs: pull missing vars from .env.development.local
  // (the file docs/environments.md tells every developer to create).
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    const raw = readFileSync(new URL("../../.env.development.local", import.meta.url), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // no .env file — env vars must be set directly
  }
}

loadDotEnvFallback();

const url =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || DEV_URL;
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

if (!serviceKey) {
  console.error(
    "SUPABASE_SERVICE_ROLE_KEY is not set (env var or .env.development.local)."
  );
  process.exit(1);
}
if (url.includes(PROD_REF)) {
  console.error(
    "Refusing to run against the PROD Supabase project. All test data goes in dev (docs/environments.md)."
  );
  process.exit(1);
}

const keep = process.argv.includes("--keep");
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

// ------------------------------------------------------------ tiny harness

let passCount = 0;
let failCount = 0;
const failures = [];

function check(label, condition, detail = "") {
  if (condition) {
    passCount++;
    console.log(`  ✓ ${label}`);
  } else {
    failCount++;
    failures.push(label);
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function step(title) {
  console.log(`\n== ${title}`);
}

async function insertOne(table, row, select = "*") {
  const { data, error } = await db.from(table).insert(row).select(select).single();
  if (error) throw new Error(`insert into ${table} failed: ${error.message}`);
  return data;
}

// Mirrors lib/llm/names.ts nameFallback (the offline naming path — this
// script never calls Anthropic).
function nameFallback(text) {
  const trimmed = text.trim();
  if (trimmed.length <= 40) return trimmed;
  return trimmed.slice(0, 40).replace(/\s+\S*$/, "").trim();
}

// Mirrors lib/voting/tally.ts selectPodStatements / lib/projects/shortlist.ts
// selectShortlistProposals ranking: votes desc, created_at asc tiebreak,
// >= threshold, slice to cap.
function rankAndSelect(votes, idField, metaById, threshold, cap) {
  const tally = {};
  for (const v of votes) tally[v[idField]] = (tally[v[idField]] || 0) + v.vote_count;
  const ranked = Object.entries(tally)
    .map(([id, total]) => ({
      id: Number(id),
      total_votes: total,
      created_at: metaById[id]?.created_at || "",
      text: metaById[id]?.text || "",
    }))
    .sort((a, b) =>
      b.total_votes !== a.total_votes
        ? b.total_votes - a.total_votes
        : a.created_at.localeCompare(b.created_at)
    );
  const eligible = ranked.filter((r) => r.total_votes >= threshold);
  return { ranked, eligible, toCreate: eligible.slice(0, cap) };
}

// --------------------------------------------------------------- main walk

const runTag = `cycle-e2e-${Date.now()}`;
console.log(`Cycle e2e walk against ${url}`);
console.log(`Run tag: ${runTag}${keep ? " (--keep: no cleanup)" : ""}`);

// Everything created, for FK-safe cleanup.
const created = {
  cycleId: null,
  participantIds: [],
};

const CONFIG = {
  // Small-cohort numbers so a 6-participant walk exercises every rule.
  vote_threshold: 3,
  max_pods: 2,
  pod_min: 3,
  project_vote_threshold: 2,
  max_projects: 2,
  project_min: 2,
  project_max: 3,
  submitter_votes: 5,
  non_submitter_votes: 3,
};

async function run() {
  const now = Date.now();
  const iso = (offsetMs) => new Date(now + offsetMs).toISOString();
  const HOUR = 3_600_000;
  const DAY = 24 * HOUR;

  // -- 1. Cycle + config -----------------------------------------------
  step("1. Create cycle + config");
  // status 'draft': the dev DB carries out-of-band partial unique indexes
  // (one_active_open_cycle / one_upcoming_open_cycle — not in migrations)
  // that reject additional 'active'/'upcoming' cycles. None of the walk's
  // assertions depend on cycle status.
  const cycle = await insertOne("cycles", {
    name: `TEST ${runTag}`,
    start_date: iso(-2 * DAY),
    end_date: iso(90 * DAY),
    status: "draft",
  });
  created.cycleId = cycle.id;
  check(`cycle #${cycle.id} created`, !!cycle.id);

  const config = await insertOne("cycle_config", {
    cycle_id: cycle.id,
    ...CONFIG,
    // Coherent windows: phases 1–2 already closed (their outcomes are what
    // we finalize), pods/solutions/projects currently open.
    problem_statement_open: iso(-2 * DAY),
    problem_statement_close: iso(-1 * DAY),
    voting_open: iso(-1 * DAY),
    voting_close: iso(-1 * HOUR),
    pod_registration_open: iso(-1 * HOUR),
    pod_registration_close: iso(5 * DAY),
    solution_proposal_open: iso(-1 * HOUR),
    solution_proposal_close: iso(5 * DAY),
    solution_voting_open: iso(-1 * HOUR),
    solution_voting_close: iso(-1), // closed: finalize gate requires it
    project_registration_open: iso(-1 * HOUR),
    project_registration_close: iso(5 * DAY),
  });
  check("cycle_config created", !!config.id);

  // -- 2. Participants + enrollments ------------------------------------
  step("2. Create 6 participants and enroll them");
  const participants = [];
  for (let i = 0; i < 6; i++) {
    const p = await insertOne("participants", {
      google_id: `${runTag}-p${i}`,
      email: `${runTag}-p${i}@test.olos.invalid`,
      first_name: `Tester${i}`,
      last_name: "CycleE2E",
    });
    participants.push(p);
    created.participantIds.push(p.id);
  }
  check("6 participants created", participants.length === 6);

  for (const p of participants) {
    await insertOne("cycle_enrollments", {
      participant_id: p.id,
      cycle_id: cycle.id,
    });
  }
  const { data: enrollments } = await db
    .from("cycle_enrollments")
    .select("participant_id, status")
    .eq("cycle_id", cycle.id);
  check(
    "enrollments default to 'inactive' (self-service pre-pod state)",
    enrollments.length === 6 && enrollments.every((e) => e.status === "inactive"),
    JSON.stringify(enrollments)
  );

  // -- 3. Problem statements --------------------------------------------
  step("3. Submit problem statements");
  const statementTexts = [
    "Improve neighborhood solar adoption through shared bulk purchasing",
    "Reduce food waste from local restaurants with a redistribution network",
    "Map heat islands across the city for tree-planting priorities",
    "Community tool library",
  ];
  const statements = [];
  for (let i = 0; i < statementTexts.length; i++) {
    const s = await insertOne("problem_statements", {
      cycle_id: cycle.id,
      participant_id: participants[i].id,
      statement_text: statementTexts[i],
    });
    statements.push(s);
  }
  check("4 problem statements created", statements.length === 4);

  // -- 4. Votes -----------------------------------------------------------
  step("4. Cast votes (engineered tallies: 5 / 4 / 3 / 1, threshold 3)");
  // S0=5 (eligible), S1=4 (eligible), S2=3 (eligible-at-threshold but capped
  // out by max_pods=2), S3=1 (below threshold).
  const votePlan = [
    [0, 0, 3], [1, 0, 2],          // S0: 5
    [2, 1, 3], [3, 1, 1],          // S1: 4
    [4, 2, 2], [5, 2, 1],          // S2: 3
    [5, 3, 1],                     // S3: 1
  ];
  for (const [voter, stmt, count] of votePlan) {
    await insertOne("votes", {
      cycle_id: cycle.id,
      voter_id: participants[voter].id,
      problem_statement_id: statements[stmt].id,
      vote_count: count,
    });
  }
  check("7 vote rows inserted", true);

  const { error: dupVoteError } = await db.from("votes").insert({
    cycle_id: cycle.id,
    voter_id: participants[0].id,
    problem_statement_id: statements[0].id,
    vote_count: 1,
  });
  check(
    "duplicate (voter, statement, cycle) vote rejected by unique constraint",
    dupVoteError?.code === "23505",
    dupVoteError ? dupVoteError.message : "insert unexpectedly succeeded"
  );

  // -- 5. Finalize voting → pods ----------------------------------------
  step("5. Finalize voting → create pods (threshold + max_pods cap)");
  const { data: voteRows } = await db
    .from("votes")
    .select("problem_statement_id, vote_count")
    .eq("cycle_id", cycle.id);
  const stmtMeta = Object.fromEntries(
    statements.map((s) => [s.id, { created_at: s.created_at, text: s.statement_text }])
  );
  const podSelection = rankAndSelect(
    voteRows,
    "problem_statement_id",
    stmtMeta,
    CONFIG.vote_threshold,
    CONFIG.max_pods
  );
  check(
    "3 statements eligible, 2 selected (max_pods cap binds)",
    podSelection.eligible.length === 3 && podSelection.toCreate.length === 2
  );
  check(
    "winners ranked S0 then S1",
    podSelection.toCreate[0]?.id === statements[0].id &&
      podSelection.toCreate[1]?.id === statements[1].id
  );

  const pods = [];
  for (const win of podSelection.toCreate) {
    const pod = await insertOne("pods", {
      cycle_id: cycle.id,
      problem_statement_id: win.id,
      name: nameFallback(win.text),
      status: "forming",
    });
    pods.push(pod);
  }
  check(
    "2 pods created as 'forming' with ≤40-char word-boundary names",
    pods.length === 2 &&
      pods.every((p) => p.status === "forming" && p.name.length <= 40)
  );

  // Idempotency guard semantics (the finalize routes bail when rows exist):
  const { count: podCount } = await db
    .from("pods")
    .select("id", { count: "exact", head: true })
    .eq("cycle_id", cycle.id);
  check("idempotency guard would trip on re-finalize (pod count > 0)", podCount === 2);

  // -- 6. Pod registration + activation ----------------------------------
  step("6. Pod registration (pod_min flip + enrollment reconciliation)");
  const [podA, podB] = pods;
  // P0-P2 join pod A (reaches pod_min=3), P3-P4 join pod B (stays under).
  for (const idx of [0, 1, 2]) {
    await insertOne("pod_memberships", {
      participant_id: participants[idx].id,
      pod_id: podA.id,
    });
  }
  for (const idx of [3, 4]) {
    await insertOne("pod_memberships", {
      participant_id: participants[idx].id,
      pod_id: podB.id,
    });
  }

  // Mirror the register route's activation: count active members, flip at
  // pod_min, then reconcile members' enrollments (reconciler semantics:
  // active pod membership in an active pod ⇒ enrollment 'active').
  async function activateIfAtMin(pod) {
    const { count } = await db
      .from("pod_memberships")
      .select("id", { count: "exact", head: true })
      .eq("pod_id", pod.id)
      .is("inactive_at", null);
    if (count >= CONFIG.pod_min) {
      await db.from("pods").update({ status: "active", updated_at: new Date().toISOString() }).eq("id", pod.id);
      const { data: members } = await db
        .from("pod_memberships")
        .select("participant_id")
        .eq("pod_id", pod.id)
        .is("inactive_at", null);
      for (const m of members) {
        await db
          .from("cycle_enrollments")
          .update({ status: "active", inactive_date: null })
          .eq("participant_id", m.participant_id)
          .eq("cycle_id", cycle.id);
      }
      return true;
    }
    return false;
  }

  const aFlipped = await activateIfAtMin(podA);
  const bFlipped = await activateIfAtMin(podB);
  check("pod A flipped forming → active at pod_min", aFlipped === true);
  check("pod B stayed forming below pod_min", bFlipped === false);

  const { data: postRegEnrollments } = await db
    .from("cycle_enrollments")
    .select("participant_id, status")
    .eq("cycle_id", cycle.id);
  const statusOf = (idx) =>
    postRegEnrollments.find((e) => e.participant_id === participants[idx].id)?.status;
  check(
    "pod A members' enrollments reconciled to 'active'",
    [0, 1, 2].every((i) => statusOf(i) === "active")
  );
  check(
    "pod B members (under-min) still 'inactive'",
    [3, 4].every((i) => statusOf(i) === "inactive")
  );
  check("never-joined participant still 'inactive'", statusOf(5) === "inactive");

  // -- 7. Admin force-activate the under-min pod --------------------------
  step("7. Force-activate pod B (admin PATCH semantics) + reconcile");
  await db.from("pods").update({ status: "active", updated_at: new Date().toISOString() }).eq("id", podB.id);
  for (const idx of [3, 4]) {
    await db
      .from("cycle_enrollments")
      .update({ status: "active", inactive_date: null })
      .eq("participant_id", participants[idx].id)
      .eq("cycle_id", cycle.id);
  }
  const { data: podBRow } = await db.from("pods").select("status").eq("id", podB.id).single();
  check("pod B active after force-activate", podBRow.status === "active");

  // -- 8. Solution proposals ----------------------------------------------
  step("8. Submit solution proposals (pod A)");
  const proposalDescriptions = [
    "Build a shared solar purchasing coordination app for three neighborhoods",
    "Create a door-to-door solar ambassador training kit",
    "Publish a static comparison site for local solar installers",
  ];
  const proposals = [];
  for (let i = 0; i < proposalDescriptions.length; i++) {
    const sp = await insertOne("solution_proposals", {
      cycle_id: cycle.id,
      pod_id: podA.id,
      participant_id: participants[i].id,
      proposal_text: "",
      proposal_data: { description: proposalDescriptions[i] },
    });
    proposals.push(sp);
  }
  check("3 solution proposals created", proposals.length === 3);

  // -- 9. Project votes ----------------------------------------------------
  step("9. Cast project votes (engineered tallies: 3 / 2 / 1, threshold 2)");
  const projectVotePlan = [
    [0, 0, 2], [1, 0, 1],          // SP0: 3
    [2, 1, 2],                     // SP1: 2 (at threshold)
    [1, 2, 1],                     // SP2: 1 (below)
  ];
  for (const [voter, prop, count] of projectVotePlan) {
    await insertOne("project_votes", {
      cycle_id: cycle.id,
      pod_id: podA.id,
      voter_id: participants[voter].id,
      solution_proposal_id: proposals[prop].id,
      vote_count: count,
    });
  }
  const { error: dupProjectVoteError } = await db.from("project_votes").insert({
    cycle_id: cycle.id,
    pod_id: podA.id,
    voter_id: participants[0].id,
    solution_proposal_id: proposals[0].id,
    vote_count: 1,
  });
  check(
    "duplicate (voter, proposal, pod) project vote rejected",
    dupProjectVoteError?.code === "23505",
    dupProjectVoteError ? dupProjectVoteError.message : "insert unexpectedly succeeded"
  );

  // -- 10. Finalize projects ----------------------------------------------
  step("10. Finalize projects (threshold + shortlist cap)");
  const { count: activeEnrollmentCount } = await db
    .from("cycle_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("cycle_id", cycle.id)
    .eq("status", "active");
  check("5 active enrollments feed the shortlist cap", activeEnrollmentCount === 5);

  // cap = min(max_projects=2, floor(5 / project_min=2)) = 2
  const shortlistCap = Math.min(
    CONFIG.max_projects,
    Math.floor(activeEnrollmentCount / Math.max(1, CONFIG.project_min))
  );
  check("shortlist cap computes to 2", shortlistCap === 2);

  const { data: projectVoteRows } = await db
    .from("project_votes")
    .select("solution_proposal_id, vote_count")
    .eq("pod_id", podA.id);
  const propMeta = Object.fromEntries(
    proposals.map((p, i) => [
      p.id,
      { created_at: p.created_at, text: proposalDescriptions[i] },
    ])
  );
  const projectSelection = rankAndSelect(
    projectVoteRows,
    "solution_proposal_id",
    propMeta,
    CONFIG.project_vote_threshold,
    shortlistCap
  );
  check(
    "2 proposals eligible (below-threshold SP2 excluded), 2 selected",
    projectSelection.eligible.length === 2 && projectSelection.toCreate.length === 2
  );

  const projects = [];
  for (const win of projectSelection.toCreate) {
    const project = await insertOne("projects", {
      cycle_id: cycle.id,
      pod_id: podA.id,
      solution_proposal_id: win.id,
      name: nameFallback(win.text),
      status: "forming",
    });
    projects.push(project);
  }
  check(
    "2 projects created as 'forming' with ≤40-char names",
    projects.length === 2 &&
      projects.every((p) => p.status === "forming" && p.name.length <= 40)
  );

  // -- 11. Project registration ---------------------------------------------
  step("11. Project registration (1-per-cycle index + activation flip)");
  const [projX, projY] = projects;
  await insertOne("project_memberships", {
    participant_id: participants[0].id,
    project_id: projX.id,
    cycle_id: cycle.id,
  });
  await insertOne("project_memberships", {
    participant_id: participants[1].id,
    project_id: projX.id,
    cycle_id: cycle.id,
  });
  const p2Membership = await insertOne("project_memberships", {
    participant_id: participants[2].id,
    project_id: projY.id,
    cycle_id: cycle.id,
  });

  // Second ACTIVE registration in the same cycle must trip the partial
  // unique index one_active_project_per_cycle.
  const { error: dupProjectRegError } = await db.from("project_memberships").insert({
    participant_id: participants[2].id,
    project_id: projX.id,
    cycle_id: cycle.id,
  });
  check(
    "second active project registration in cycle rejected (partial unique index)",
    dupProjectRegError?.code === "23505",
    dupProjectRegError ? dupProjectRegError.message : "insert unexpectedly succeeded"
  );

  // Withdraw (soft delete) then re-register elsewhere — must be allowed.
  await db
    .from("project_memberships")
    .update({ left_at: new Date().toISOString() })
    .eq("id", p2Membership.id);
  const { error: reRegError } = await db.from("project_memberships").insert({
    participant_id: participants[2].id,
    project_id: projX.id,
    cycle_id: cycle.id,
  });
  check(
    "withdraw (left_at) then re-register in another project allowed",
    !reRegError,
    reRegError?.message
  );

  // Activation flip at project_min (mirrors the register route).
  const { count: projXMembers } = await db
    .from("project_memberships")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projX.id)
    .is("left_at", null);
  if (projXMembers >= CONFIG.project_min) {
    await db
      .from("projects")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", projX.id)
      .eq("status", "forming");
  }
  const { data: projXRow } = await db.from("projects").select("status").eq("id", projX.id).single();
  check(
    `project X flipped forming → active at project_min (${projXMembers} members)`,
    projXRow.status === "active"
  );
  const { data: projYRow } = await db.from("projects").select("status").eq("id", projY.id).single();
  check("project Y (0 active members) still forming", projYRow.status === "forming");
}

// ---------------------------------------------------------------- cleanup

async function cleanup() {
  if (keep) {
    console.log(
      `\n--keep set: leaving cycle #${created.cycleId} in place. ` +
        `Clean up later with: npm run seed:test-cycle -- --cleanup ${created.cycleId}`
    );
    return;
  }
  console.log("\n== Cleanup (FK-safe order)");
  const c = created.cycleId;
  try {
    if (c) {
      await db.from("project_memberships").delete().eq("cycle_id", c);
      await db.from("projects").delete().eq("cycle_id", c);
      await db.from("project_votes").delete().eq("cycle_id", c);
      await db.from("solution_proposals").delete().eq("cycle_id", c);
      const { data: podRows } = await db.from("pods").select("id").eq("cycle_id", c);
      const podIds = (podRows ?? []).map((p) => p.id);
      if (podIds.length) {
        await db.from("moderator_assignments").delete().in("pod_id", podIds);
        await db.from("pod_memberships").delete().in("pod_id", podIds);
      }
      await db.from("pods").delete().eq("cycle_id", c);
      await db.from("votes").delete().eq("cycle_id", c);
      await db.from("problem_statements").delete().eq("cycle_id", c);
      await db.from("access_revocations").delete().eq("cycle_id", c);
      await db.from("cycle_enrollments").delete().eq("cycle_id", c);
      await db.from("cycle_config").delete().eq("cycle_id", c);
      await db.from("cycles").delete().eq("id", c);
    }
    if (created.participantIds.length) {
      await db.from("participants").delete().in("id", created.participantIds);
    }
    console.log("  ✓ all test rows deleted");
  } catch (err) {
    console.error(
      `  ✗ cleanup incomplete for cycle #${c}: ${err.message}\n` +
        `    Re-run cleanup with: npm run seed:test-cycle -- --cleanup ${c}`
    );
    process.exitCode = 1;
  }
}

// ------------------------------------------------------------------- main

try {
  await run();
} catch (err) {
  failCount++;
  failures.push(`aborted: ${err.message}`);
  console.error(`\nABORTED: ${err.message}`);
} finally {
  await cleanup();
}

console.log(`\n${"=".repeat(60)}`);
console.log(`RESULT: ${passCount} passed, ${failCount} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  FAILED: ${f}`);
  process.exitCode = 1;
} else {
  console.log("Full cycle walk PASSED: pods and projects create end-to-end.");
}
