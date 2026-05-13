/**
 * Bulk magic-link invite generator (ROADMAP §1.8 / ISSUE-W1-008).
 *
 * Inserts an `invitations` row per active enrollment in a target cycle and
 * dispatches the branded magic-link email via Resend. Invitations are
 * "bulk-flavored": cycle_id is set; pod_id, role_preset, permissions are NULL.
 * That makes acceptance idempotent — `fulfillInvitation()` no-ops materially
 * for already-enrolled participants and just marks the invitation accepted.
 *
 * Safety contract (mirrors scripts/migration/CLAUDE.md):
 *   - dry-run by default; --commit required to write or send
 *   - prod-host guard requires --prod + typed cycle-name confirmation
 *   - idempotent: skips rows with a non-expired pending bulk invite already
 *   - PII-safe logs: indices, IDs, counts, outcomes — never emails or names
 *   - per-row failures append to summary; run continues
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/ops/send-bulk-invites.ts \
 *     --cycle-id 1 --dry-run
 *
 *   npx tsx --env-file=.env.local scripts/ops/send-bulk-invites.ts \
 *     --cycle-id 1 --commit --prod --limit 1 --only-email someone@example.com
 */

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import {
  invitationEmailHtml,
  invitationEmailText,
} from "@/lib/email/invitation-template";
import { createInterface } from "node:readline/promises";

const PROD_PROJECT_REF = "cethihabtddiujzayaxe";
const DEFAULT_APP_URL = "https://olos.theupskillinglabs.org";
const EMAIL_SUBJECT = "You're invited to The Upskilling Labs";
const PER_ROW_DELAY_MS = 200;

type Args = {
  cycleId: number;
  dryRun: boolean;
  commit: boolean;
  prod: boolean;
  limit: number | null;
  onlyEmail: string | null;
  includePending: boolean;
  appUrl: string | null;
  invitedBy: number | null;
};

type TargetRow = {
  participantId: number;
  email: string;
  hasAuthUser: boolean;
  hasLivePending: boolean;
  hasAcceptedInvite: boolean;
};

type RowOutcome =
  | { kind: "sent"; participantId: number; invitationId: number }
  | { kind: "skipped"; participantId: number; reason: string }
  | { kind: "failed"; participantId: number; phase: string; error: string };

function parseArgs(argv: string[]): Args {
  const args: Args = {
    cycleId: 0,
    dryRun: true,
    commit: false,
    prod: false,
    limit: null,
    onlyEmail: null,
    includePending: false,
    appUrl: null,
    invitedBy: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--cycle-id":
        args.cycleId = Number(argv[++i]);
        break;
      case "--dry-run":
        args.dryRun = true;
        args.commit = false;
        break;
      case "--commit":
        args.commit = true;
        args.dryRun = false;
        break;
      case "--prod":
        args.prod = true;
        break;
      case "--limit":
        args.limit = Number(argv[++i]);
        break;
      case "--only-email":
        args.onlyEmail = argv[++i].toLowerCase();
        break;
      case "--include-pending":
        args.includePending = true;
        break;
      case "--app-url":
        args.appUrl = argv[++i];
        break;
      case "--invited-by":
        args.invitedBy = Number(argv[++i]);
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      default:
        die(`Unknown flag: ${a}. Use --help for usage.`);
    }
  }

  if (!Number.isInteger(args.cycleId) || args.cycleId <= 0) {
    die("--cycle-id <n> is required (positive integer).");
  }
  if (args.limit !== null && (!Number.isInteger(args.limit) || args.limit <= 0)) {
    die("--limit must be a positive integer when set.");
  }
  if (args.invitedBy !== null && (!Number.isInteger(args.invitedBy) || args.invitedBy <= 0)) {
    die("--invited-by must be a positive integer when set.");
  }
  return args;
}

function printHelp() {
  process.stdout.write(`Bulk magic-link invite generator (#46 / §1.8)

Required:
  --cycle-id <n>          Target cycle id

Mode:
  --dry-run               (default) plan only — no DB writes, no Resend calls
  --commit                actually insert + send
  --prod                  required when SUPABASE_URL points at production

Filtering:
  --limit <n>             process at most N rows
  --only-email <addr>     restrict target list to one address (sanity sends)
  --include-pending       do not skip rows with a live pending bulk invite

Actor:
  --invited-by <pid>      participant_id to record as the inviter
                          (default: first OWNER_EMAILS entry resolved to a participant)

Other:
  --app-url <url>         override magic-link host (default: NEXT_PUBLIC_APP_URL or ${DEFAULT_APP_URL})
  -h, --help              show this help

Run with --env-file=.env.local so env vars load:
  npx tsx --env-file=.env.local scripts/ops/send-bulk-invites.ts --cycle-id 1 --dry-run
`);
}

function die(msg: string): never {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(2);
}

function isProdUrl(url: string | undefined): boolean {
  if (!url) return false;
  return url.includes(PROD_PROJECT_REF);
}

async function confirmProd(cycleName: string): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  process.stdout.write(
    `\nproduction guard: type the cycle name exactly to proceed.\n` +
      `expected: ${cycleName}\n> `
  );
  const answer = (await rl.question("")).trim();
  rl.close();
  if (answer !== cycleName) {
    die("cycle-name confirmation did not match. aborting.");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const envAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const appUrl = args.appUrl ?? envAppUrl ?? DEFAULT_APP_URL;

  if (!supabaseUrl) {
    die(
      "NEXT_PUBLIC_SUPABASE_URL is not set. Did you forget --env-file=.env.local?"
    );
  }
  if (!serviceKey) die("SUPABASE_SERVICE_ROLE_KEY is not set.");
  if (args.commit && !resendKey) die("RESEND_API_KEY is not set (required for --commit).");

  const targetingProd = isProdUrl(supabaseUrl);
  if (targetingProd && !args.prod) {
    die(
      "SUPABASE_URL targets production but --prod was not passed. " +
        "Re-run with --prod (and a typed cycle-name confirmation will be required for --commit)."
    );
  }
  if (!targetingProd && args.prod) {
    die("--prod was passed but SUPABASE_URL does not target the production project.");
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 0. Resolve the inviter participant_id. invitations.invited_by is NOT NULL.
  let invitedBy: number;
  if (args.invitedBy !== null) {
    const { data: pRow, error: pErr } = await supabase
      .from("participants")
      .select("id")
      .eq("id", args.invitedBy)
      .maybeSingle();
    if (pErr) die(`--invited-by lookup failed: ${pErr.message}`);
    if (!pRow) die(`--invited-by participant ${args.invitedBy} not found.`);
    invitedBy = args.invitedBy;
  } else {
    const ownerEmailsRaw = process.env.OWNER_EMAILS;
    if (!ownerEmailsRaw) {
      die(
        "no --invited-by passed and OWNER_EMAILS env var is unset. " +
          "set OWNER_EMAILS or pass --invited-by <participant_id>."
      );
    }
    const ownerEmails = ownerEmailsRaw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (ownerEmails.length === 0) {
      die("OWNER_EMAILS is set but contains no addresses.");
    }
    const { data: ownerRow, error: ownerErr } = await supabase
      .from("participants")
      .select("id, email")
      .in("email", ownerEmails)
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (ownerErr) die(`OWNER_EMAILS participant lookup failed: ${ownerErr.message}`);
    if (!ownerRow) {
      die(
        "no participants row matches any OWNER_EMAILS entry. " +
          "an owner must have signed in once before bulk runs."
      );
    }
    invitedBy = ownerRow.id as number;
  }

  // 1. Verify cycle exists.
  const { data: cycle, error: cycleErr } = await supabase
    .from("cycles")
    .select("id, name")
    .eq("id", args.cycleId)
    .maybeSingle();
  if (cycleErr) die(`cycle lookup failed: ${cycleErr.message}`);
  if (!cycle) die(`cycle ${args.cycleId} not found.`);
  const cycleName = cycle.name as string;

  process.stdout.write(
    `\nbulk-invite plan\n` +
      `  cycle_id:        ${args.cycleId}\n` +
      `  cycle_name:      ${cycleName}\n` +
      `  mode:            ${args.commit ? "COMMIT" : "dry-run"}\n` +
      `  targeting_prod:  ${targetingProd}\n` +
      `  app_url:         ${appUrl}\n` +
      `  invited_by:      participant_id=${invitedBy}${args.invitedBy === null ? " (resolved from OWNER_EMAILS)" : ""}\n` +
      `  limit:           ${args.limit ?? "(none)"}\n` +
      `  only_email:      ${args.onlyEmail ? "(set)" : "(none)"}\n` +
      `  include_pending: ${args.includePending}\n`
  );

  // 2. Fetch active enrollments + participant rows.
  const { data: enrollRows, error: enrollErr } = await supabase
    .from("cycle_enrollments")
    .select("participant_id, status, participants!inner(id, email, auth_user_id)")
    .eq("cycle_id", args.cycleId)
    .eq("status", "active")
    .order("participant_id", { ascending: true });
  if (enrollErr) die(`enrollment query failed: ${enrollErr.message}`);
  if (!enrollRows || enrollRows.length === 0) {
    process.stdout.write("\nno active enrollments for this cycle. nothing to do.\n");
    return;
  }

  type EnrollmentJoin = {
    participant_id: number;
    participants: { id: number; email: string; auth_user_id: string | null };
  };

  let rowsRaw: EnrollmentJoin[] = (enrollRows as unknown as EnrollmentJoin[]).map(
    (r) => ({
      participant_id: r.participant_id,
      participants: r.participants,
    })
  );

  if (args.onlyEmail) {
    const target = args.onlyEmail;
    rowsRaw = rowsRaw.filter((r) => r.participants.email.toLowerCase() === target);
    if (rowsRaw.length === 0) {
      die(`--only-email did not match any active enrollment in cycle ${args.cycleId}.`);
    }
  }

  // 3. Annotate with idempotency facts: live pending bulk invite + accepted invite.
  const emails = rowsRaw.map((r) => r.participants.email.toLowerCase());
  const nowIso = new Date().toISOString();
  const { data: priorInvites, error: priorErr } = await supabase
    .from("invitations")
    .select("email, cycle_id, role_preset, status, expires_at")
    .in("email", emails)
    .eq("cycle_id", args.cycleId);
  if (priorErr) die(`prior-invite query failed: ${priorErr.message}`);

  const livePendingByEmail = new Set<string>();
  const acceptedByEmail = new Set<string>();
  for (const inv of priorInvites ?? []) {
    const email = (inv.email as string).toLowerCase();
    const isBulkShape = inv.role_preset === null;
    if (
      inv.status === "pending" &&
      isBulkShape &&
      new Date(inv.expires_at as string) > new Date(nowIso)
    ) {
      livePendingByEmail.add(email);
    }
    if (inv.status === "accepted") {
      acceptedByEmail.add(email);
    }
  }

  const annotated: TargetRow[] = rowsRaw.map((r) => ({
    participantId: r.participant_id,
    email: r.participants.email.toLowerCase(),
    hasAuthUser: r.participants.auth_user_id !== null,
    hasLivePending: livePendingByEmail.has(r.participants.email.toLowerCase()),
    hasAcceptedInvite: acceptedByEmail.has(r.participants.email.toLowerCase()),
  }));

  // 4. Apply limit.
  const limited = args.limit ? annotated.slice(0, args.limit) : annotated;

  // 5. Plan summary (no PII).
  const planSent: number[] = [];
  const planSkippedPending: number[] = [];
  for (const row of limited) {
    if (row.hasLivePending && !args.includePending) {
      planSkippedPending.push(row.participantId);
    } else {
      planSent.push(row.participantId);
    }
  }

  process.stdout.write(
    `\ntarget summary (no PII):\n` +
      `  active_enrollments_total: ${annotated.length}\n` +
      `  after_limit:              ${limited.length}\n` +
      `  would_send:               ${planSent.length}\n` +
      `  would_skip_live_pending:  ${planSkippedPending.length}\n` +
      `  among would_send:\n` +
      `    already_has_auth_user:  ${
        limited.filter((r) => planSent.includes(r.participantId) && r.hasAuthUser).length
      }\n` +
      `    has_prior_accepted:     ${
        limited.filter(
          (r) => planSent.includes(r.participantId) && r.hasAcceptedInvite
        ).length
      }\n`
  );

  if (planSent.length > 0) {
    process.stdout.write(
      `  participant_ids to send: ${planSent.join(", ")}\n`
    );
  }
  if (planSkippedPending.length > 0) {
    process.stdout.write(
      `  participant_ids skipped (live pending bulk invite): ${planSkippedPending.join(", ")}\n`
    );
  }

  if (!args.commit) {
    process.stdout.write(
      `\ndry-run: no DB writes, no emails sent. re-run with --commit to fire.\n`
    );
    return;
  }

  // 6. Production confirmation prompt before any side effects.
  if (targetingProd) {
    await confirmProd(cycleName);
  }

  // 7. Execute.
  const resend = new Resend(resendKey!);
  const outcomes: RowOutcome[] = [];

  for (let i = 0; i < limited.length; i++) {
    const row = limited[i];
    const idx = i + 1;
    const total = limited.length;

    if (row.hasLivePending && !args.includePending) {
      outcomes.push({
        kind: "skipped",
        participantId: row.participantId,
        reason: "live pending bulk invite already exists",
      });
      process.stdout.write(`  [${idx}/${total}] participant_id=${row.participantId} → skipped (pending)\n`);
      continue;
    }

    // Build notes.
    const noteParts: string[] = [`Bulk magic link for cycle: ${cycleName}`];
    if (row.hasAuthUser) noteParts.push("participant already authenticated");
    if (row.hasAcceptedInvite) noteParts.push("had prior accepted invite for this cycle");
    const notes = noteParts.join("; ");

    // Insert invitation row.
    const { data: insertRow, error: insertErr } = await supabase
      .from("invitations")
      .insert({
        email: row.email,
        permissions: [],
        role_preset: null,
        cycle_id: args.cycleId,
        pod_id: null,
        invited_by: invitedBy,
        notes,
      })
      .select("id, token")
      .single();
    if (insertErr || !insertRow) {
      outcomes.push({
        kind: "failed",
        participantId: row.participantId,
        phase: "insert",
        error: insertErr?.message ?? "no row returned",
      });
      process.stdout.write(`  [${idx}/${total}] participant_id=${row.participantId} → FAILED (insert): ${insertErr?.message}\n`);
      continue;
    }

    const invitationId = insertRow.id as number;
    const token = insertRow.token as string;
    const magicLink = `${appUrl.replace(/\/$/, "")}/login?invite=${token}`;

    // Send email via Resend.
    try {
      const { error: sendErr } = await resend.emails.send({
        from: `Upskilling Labs <${process.env.RESEND_FROM_EMAIL ?? "noreply@enroll.theupskillinglabs.org"}>`,
        to: row.email,
        subject: EMAIL_SUBJECT,
        html: invitationEmailHtml({ magicLink, rolePreset: null, cycleName }),
        text: invitationEmailText({ magicLink, rolePreset: null, cycleName }),
      });
      if (sendErr) {
        outcomes.push({
          kind: "failed",
          participantId: row.participantId,
          phase: "send",
          error: sendErr.message ?? String(sendErr),
        });
        process.stdout.write(`  [${idx}/${total}] participant_id=${row.participantId} invitation_id=${invitationId} → FAILED (send): ${sendErr.message}\n`);
        // continue to next row; the invitation row stays without email_sent_at
        continue;
      }
    } catch (e) {
      outcomes.push({
        kind: "failed",
        participantId: row.participantId,
        phase: "send",
        error: e instanceof Error ? e.message : String(e),
      });
      process.stdout.write(`  [${idx}/${total}] participant_id=${row.participantId} invitation_id=${invitationId} → FAILED (send exception)\n`);
      continue;
    }

    // Record email_sent_at (non-fatal on failure — email did land).
    const sentAt = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from("invitations")
      .update({ email_sent_at: sentAt })
      .eq("id", invitationId);
    if (updateErr) {
      process.stdout.write(`  [${idx}/${total}] participant_id=${row.participantId} invitation_id=${invitationId} → sent (email_sent_at update failed: ${updateErr.message})\n`);
    } else {
      process.stdout.write(`  [${idx}/${total}] participant_id=${row.participantId} invitation_id=${invitationId} → sent\n`);
    }
    outcomes.push({ kind: "sent", participantId: row.participantId, invitationId });

    if (i < limited.length - 1) await sleep(PER_ROW_DELAY_MS);
  }

  // 8. Final summary.
  const sentCount = outcomes.filter((o) => o.kind === "sent").length;
  const skippedCount = outcomes.filter((o) => o.kind === "skipped").length;
  const failedCount = outcomes.filter((o) => o.kind === "failed").length;

  process.stdout.write(
    `\nrun summary\n` +
      `  total processed: ${outcomes.length}\n` +
      `  sent:            ${sentCount}\n` +
      `  skipped:         ${skippedCount}\n` +
      `  failed:          ${failedCount}\n`
  );

  if (failedCount > 0) {
    process.stdout.write(`\nfailures:\n`);
    for (const o of outcomes) {
      if (o.kind === "failed") {
        process.stdout.write(`  participant_id=${o.participantId} phase=${o.phase} error=${o.error}\n`);
      }
    }
    process.exit(1);
  }
}

main().catch((e) => {
  process.stderr.write(`unhandled error: ${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  process.exit(1);
});
