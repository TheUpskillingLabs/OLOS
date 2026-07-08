import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import { generateName } from "@/lib/llm/names";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { parseIntParam } from "@/lib/api/params";
import { rejectOrgCycle } from "@/lib/cycle/guards";
import { rankAndSelect, type RankItem } from "@/lib/voting/rank";

export const POST = withAdminAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const cycleId = parseIntParam(params.cycle_id, "cycle_id");
    if (cycleId instanceof NextResponse) return cycleId;

    const orgRejection = await rejectOrgCycle(
      auth.supabase,
      cycleId,
      "Organization cycles don't form pods by voting — create workstream runs instead."
    );
    if (orgRejection) return orgRejection;

    // Get cycle config
    const { data: config } = await auth.supabase
      .from("cycle_config")
      .select("vote_threshold, max_pods")
      .eq("cycle_id", cycleId)
      .single();

    if (!config) {
      return NextResponse.json({ error: "Cycle config not found" }, { status: 404 });
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

    // Statements with their lab snapshot (metro_id, 00068) + creation time.
    const statementIds = Object.keys(tallyMap).map(Number);
    const { data: statements } = await auth.supabase
      .from("problem_statements")
      .select("id, statement_text, created_at, metro_id")
      .in("id", statementIds.length > 0 ? statementIds : [0]);

    const stmtMap: Record<
      number,
      { text: string; createdAt: string; metroId: number | null }
    > = {};
    for (const s of statements || []) {
      stmtMap[s.id] = {
        text: s.statement_text,
        createdAt: s.created_at,
        metroId: s.metro_id ?? null,
      };
    }

    // Pods are local (docs/LOCAL_LABS.md): partition statements by their lab
    // (the submitter's metro snapshot; NULL = the HQ/grandfathered bucket) and
    // run selection PER LAB — each lab forms up to max_pods of its own top
    // statements, so a small lab is never crowded out by a larger one's ballot.
    const byLab = new Map<number | null, RankItem[]>();
    for (const id of statementIds) {
      const meta = stmtMap[id];
      if (!meta) continue;
      const arr = byLab.get(meta.metroId) ?? [];
      arr.push({
        problem_statement_id: id,
        total_votes: tallyMap[id],
        created_at: meta.createdAt || "",
      });
      byLab.set(meta.metroId, arr);
    }

    type StmtOut = {
      problem_statement_id: number;
      total_votes: number;
      lab_id: number | null;
    };
    const selected: { item: RankItem; labId: number | null }[] = [];
    const eligibleAll: StmtOut[] = [];
    const ineligibleAll: StmtOut[] = [];
    for (const [labId, items] of byLab) {
      const r = rankAndSelect(items, {
        voteThreshold: config.vote_threshold,
        maxPods: config.max_pods,
      });
      for (const e of r.eligible)
        eligibleAll.push({
          problem_statement_id: e.problem_statement_id,
          total_votes: e.total_votes,
          lab_id: labId,
        });
      for (const e of r.ineligible)
        ineligibleAll.push({
          problem_statement_id: e.problem_statement_id,
          total_votes: e.total_votes,
          lab_id: labId,
        });
      for (const it of r.selected) selected.push({ item: it, labId });
    }

    // Create the pods, each tagged with its lab.
    const pods = [];
    for (const { item, labId } of selected) {
      const text = stmtMap[item.problem_statement_id]?.text ?? "";
      let name: string;
      try {
        name = await generateName("pod", text);
      } catch {
        // Fallback: first 40 chars trimmed to nearest word
        name = text.slice(0, 40).replace(/\s+\S*$/, "").trim();
      }

      const { data: pod, error } = await auth.supabase
        .from("pods")
        .insert({
          cycle_id: cycleId,
          problem_statement_id: item.problem_statement_id,
          name,
          status: "forming",
          lab_id: labId,
        })
        .select()
        .single();

      if (!error && pod) {
        pods.push({
          id: pod.id,
          name: pod.name,
          problem_statement_id: item.problem_statement_id,
          total_votes: item.total_votes,
          status: "forming",
          lab_id: labId,
        });
      }
    }

    return NextResponse.json({
      pods,
      eligible_statements: eligibleAll,
      ineligible_statements: ineligibleAll,
    });
  }
);
