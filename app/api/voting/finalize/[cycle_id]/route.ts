import { NextResponse, NextRequest } from "next/server";
import { withPermissionAuth } from "@/lib/auth/middleware";
import { canSeeCycle, isFullCycleAdmin } from "@/lib/auth/cycle-access";
import { createServiceClient } from "@/lib/supabase/server";
import { generateName } from "@/lib/llm/names";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { parseIntParam } from "@/lib/api/params";

/** Supabase returns a to-one join as an object (occasionally an array). */
function metroOf(joined: unknown): string | null {
  const row = Array.isArray(joined) ? joined[0] : joined;
  return (row as { metro_slug?: string | null } | null)?.metro_slug ?? null;
}

/**
 * POST /api/voting/finalize/[cycle_id]
 *
 * Per-lab pod formation. In an HQ-open cycle each Local Lab forms its OWN pods
 * from its OWN participants' problem statements and votes; pods are stamped with
 * that lab (`pods.metro_slug`). A labs lead finalizes only their own lab; a full
 * admin finalizes every lab present. In a local-lab cycle there is a single lab
 * (the cycle's metro). Idempotent per lab.
 */
export const POST = withPermissionAuth(
  "pods:write",
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const cycleId = parseIntParam(params.cycle_id, "cycle_id");
    if (cycleId instanceof NextResponse) return cycleId;

    const { data: cycle } = await auth.supabase
      .from("cycles")
      .select("id, metro_slug, is_hq_internal")
      .eq("id", cycleId)
      .maybeSingle();
    if (!cycle) return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
    // Visibility gate: HQ, or a labs lead who can see this cycle (HQ-open or
    // their own local cycle). The lab restriction below limits WHAT they form.
    if (!canSeeCycle(auth.user, cycle)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const fullAdmin = isFullCycleAdmin(auth.user);

    // Reads go through the service client: grouping needs every author's/
    // enrollee's metro, which a labs lead can't read under participants RLS.
    // Authorization was already enforced by canSeeCycle above.
    const client = createServiceClient();

    const { data: config } = await client
      .from("cycle_config")
      .select("vote_threshold, max_pods, pod_min")
      .eq("cycle_id", cycleId)
      .single();
    if (!config) {
      return NextResponse.json({ error: "Cycle config not found" }, { status: 404 });
    }

    // Statements + their lab. In a local-lab cycle every statement belongs to
    // the cycle's lab; in an HQ-open cycle a statement's lab is its author's.
    const { data: statements } = await client
      .from("problem_statements")
      .select("id, statement_text, created_at, participants(metro_slug)")
      .eq("cycle_id", cycleId);

    const stmtLab = new Map<number, string | null>();
    const stmtInfo = new Map<number, { text: string; createdAt: string }>();
    for (const s of statements ?? []) {
      stmtLab.set(s.id, cycle.metro_slug ?? metroOf(s.participants));
      stmtInfo.set(s.id, { text: s.statement_text, createdAt: s.created_at });
    }

    // Vote tallies (votes are lab-internal by construction — a voter can only
    // vote on statements from their own lab).
    const { data: votes } = await client
      .from("votes")
      .select("problem_statement_id, vote_count")
      .eq("cycle_id", cycleId);
    const tally = new Map<number, number>();
    for (const v of votes ?? []) {
      tally.set(v.problem_statement_id, (tally.get(v.problem_statement_id) ?? 0) + v.vote_count);
    }

    // Active enrollments per lab → per-lab shortlist cap.
    const { data: enr } = await client
      .from("cycle_enrollments")
      .select("status, participants(metro_slug)")
      .eq("cycle_id", cycleId)
      .eq("status", "active");
    const activeByLab = new Map<string, number>();
    for (const e of enr ?? []) {
      const lab = cycle.metro_slug ?? metroOf(e.participants);
      if (lab == null) continue;
      activeByLab.set(lab, (activeByLab.get(lab) ?? 0) + 1);
    }

    // Idempotency is per lab: a lab that already has pods is skipped, so HQ and
    // each lab lead can finalize their own slice independently.
    const { data: existingPods } = await client
      .from("pods")
      .select("metro_slug")
      .eq("cycle_id", cycleId);
    const existingLabs = new Set((existingPods ?? []).map((p) => p.metro_slug));

    // Which labs does this caller finalize?
    let targetMetros: string[];
    if (cycle.metro_slug) {
      targetMetros = [cycle.metro_slug];
    } else if (fullAdmin) {
      targetMetros = [...new Set([...stmtLab.values()].filter((m): m is string => m != null))];
    } else {
      if (!auth.user.metroSlug) {
        return NextResponse.json(
          { error: "You must be assigned to a lab to finalize voting." },
          { status: 403 }
        );
      }
      targetMetros = [auth.user.metroSlug];
    }

    const podMin = Math.max(1, config.pod_min);
    const pods: {
      id: number;
      name: string;
      metro_slug: string;
      problem_statement_id: number;
      total_votes: number;
      status: string;
    }[] = [];
    const perLab: { metro: string; created?: number; eligible?: number; skipped?: string }[] = [];

    for (const metro of targetMetros) {
      if (existingLabs.has(metro)) {
        perLab.push({ metro, skipped: "already finalized" });
        continue;
      }

      const ranked = [...stmtLab.entries()]
        .filter(([, lab]) => lab === metro)
        .map(([id]) => ({
          id,
          total: tally.get(id) ?? 0,
          createdAt: stmtInfo.get(id)?.createdAt ?? "",
          text: stmtInfo.get(id)?.text ?? "",
        }))
        .sort((a, b) =>
          b.total !== a.total ? b.total - a.total : a.createdAt.localeCompare(b.createdAt)
        );

      const eligible = ranked.filter((r) => r.total >= config.vote_threshold);
      const cap = Math.min(
        config.max_pods,
        Math.floor((activeByLab.get(metro) ?? 0) / podMin)
      );
      const toCreate = eligible.slice(0, cap);

      for (const stmt of toCreate) {
        let name: string;
        try {
          name = await generateName("pod", stmt.text);
        } catch {
          name = stmt.text.slice(0, 40).replace(/\s+\S*$/, "").trim();
        }
        // Service client: pods_insert RLS is is_admin_or_owner()-gated, which a
        // labs lead is not; authorization is enforced above.
        const { data: pod, error } = await client
          .from("pods")
          .insert({
            cycle_id: cycleId,
            problem_statement_id: stmt.id,
            name,
            status: "forming",
            metro_slug: metro,
          })
          .select()
          .single();
        if (!error && pod) {
          pods.push({
            id: pod.id,
            name: pod.name,
            metro_slug: metro,
            problem_statement_id: stmt.id,
            total_votes: stmt.total,
            status: "forming",
          });
        }
      }
      perLab.push({ metro, created: toCreate.length, eligible: eligible.length });
    }

    // Nothing to do only if every targeted lab was already finalized.
    if (pods.length === 0 && perLab.length > 0 && perLab.every((l) => l.skipped)) {
      return NextResponse.json(
        { error: "Voting has already been finalized for this lab." },
        { status: 409 }
      );
    }

    return NextResponse.json({ pods, per_lab: perLab });
  }
);
