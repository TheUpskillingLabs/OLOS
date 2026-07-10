import { NextResponse, NextRequest } from "next/server";
import { withPermissionAuth } from "@/lib/auth/middleware";
import { requireCycleManagement } from "@/lib/auth/cycle-access";
import { generateName } from "@/lib/llm/names";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { parseIntParam } from "@/lib/api/params";

export const POST = withPermissionAuth(
  "pods:write",
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const cycleId = parseIntParam(params.cycle_id, "cycle_id");
    if (cycleId instanceof NextResponse) return cycleId;

    const guard = await requireCycleManagement(auth.supabase, auth.user, cycleId);
    if (guard) return guard;

    // Get cycle config
    const { data: config } = await auth.supabase
      .from("cycle_config")
      .select("vote_threshold, max_pods, pod_min")
      .eq("cycle_id", cycleId)
      .single();

    if (!config) {
      return NextResponse.json({ error: "Cycle config not found" }, { status: 404 });
    }

    // Idempotency guard: finalize is destructive-by-append (one INSERT per
    // winning statement, no unique constraint). A double-click or proxy retry
    // would otherwise create a second full set of pods. If any pod already
    // exists for this cycle, treat voting as already finalized (audit fix).
    const { count: existingPodCount } = await auth.supabase
      .from("pods")
      .select("id", { count: "exact", head: true })
      .eq("cycle_id", cycleId);

    if ((existingPodCount ?? 0) > 0) {
      return NextResponse.json(
        { error: "Voting has already been finalized for this cycle." },
        { status: 409 }
      );
    }

    // Tally votes
    const { data: votes } = await auth.supabase
      .from("votes")
      .select("problem_statement_id, vote_count")
      .eq("cycle_id", cycleId);

    const tallyMap: Record<number, number> = {};
    for (const v of votes || []) {
      tallyMap[v.problem_statement_id] =
        (tallyMap[v.problem_statement_id] || 0) + v.vote_count;
    }

    // Get statements with their creation time for tiebreaking
    const statementIds = Object.keys(tallyMap).map(Number);
    const { data: statements } = await auth.supabase
      .from("problem_statements")
      .select("id, statement_text, created_at")
      .in("id", statementIds.length > 0 ? statementIds : [0]);

    const stmtMap: Record<number, { text: string; createdAt: string }> = {};
    for (const s of statements || []) {
      stmtMap[s.id] = { text: s.statement_text, createdAt: s.created_at };
    }

    // Rank: filter by threshold, sort by votes desc, then by submission time asc
    const ranked = Object.entries(tallyMap)
      .map(([id, total]) => ({
        problem_statement_id: parseInt(id, 10),
        total_votes: total,
        created_at: stmtMap[parseInt(id, 10)]?.createdAt || "",
        text: stmtMap[parseInt(id, 10)]?.text || "",
      }))
      .sort((a, b) => {
        if (b.total_votes !== a.total_votes) return b.total_votes - a.total_votes;
        return a.created_at.localeCompare(b.created_at);
      });

    const eligible = ranked.filter((r) => r.total_votes >= config.vote_threshold);
    const ineligible = ranked.filter((r) => r.total_votes < config.vote_threshold);

    // Shortlist cap: min(max_pods, floor(active_enrollments / pod_min)).
    // Capacity-aware, mirroring the project finalize route
    // (pods/[pod_id]/projects/finalize) — never mint more forming pods than the
    // active cohort could ever fill to pod_min, which would otherwise strand
    // pods in 'forming' forever (see the resolve-formation backstop).
    const { count: activeEnrollments } = await auth.supabase
      .from("cycle_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("cycle_id", cycleId)
      .eq("status", "active");

    const podMin = Math.max(1, config.pod_min);
    const podCap = Math.min(
      config.max_pods,
      Math.floor((activeEnrollments ?? 0) / podMin)
    );

    // Create pods for top eligible
    const toCreate = eligible.slice(0, podCap);
    const pods = [];

    for (let i = 0; i < toCreate.length; i++) {
      const stmt = toCreate[i];
      let name: string;
      try {
        name = await generateName("pod", stmt.text);
      } catch {
        // Fallback: first 40 chars trimmed to nearest word
        name = stmt.text.slice(0, 40).replace(/\s+\S*$/, "").trim();
      }

      const { data: pod, error } = await auth.supabase
        .from("pods")
        .insert({
          cycle_id: cycleId,
          problem_statement_id: stmt.problem_statement_id,
          name,
          status: "forming",
        })
        .select()
        .single();

      if (!error && pod) {
        pods.push({
          id: pod.id,
          name: pod.name,
          problem_statement_id: stmt.problem_statement_id,
          total_votes: stmt.total_votes,
          status: "forming",
        });
      }
    }

    return NextResponse.json({
      pods,
      eligible_statements: eligible.map((e, i) => ({
        problem_statement_id: e.problem_statement_id,
        total_votes: e.total_votes,
        rank: i + 1,
      })),
      ineligible_statements: ineligible.map((e) => ({
        problem_statement_id: e.problem_statement_id,
        total_votes: e.total_votes,
      })),
    });
  }
);
