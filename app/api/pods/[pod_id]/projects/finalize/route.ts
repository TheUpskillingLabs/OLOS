import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { isModeratorForPod } from "@/lib/auth/roles";
import { canManageEntity } from "@/lib/auth/cycle-access";
import { generateName } from "@/lib/llm/names";
import { parseIntParam } from "@/lib/api/params";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

export const POST = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const podId = parseIntParam(params.pod_id, "pod_id");
    if (podId instanceof NextResponse) return podId;

    // Get pod for cycle_id + lab (metro_slug is stamped onto the projects it
    // creates, so a project inherits its pod's lab).
    const { data: pod } = await auth.supabase
      .from("pods")
      .select("cycle_id, metro_slug")
      .eq("id", podId)
      .single();

    if (!pod) {
      return NextResponse.json({ error: "Pod not found" }, { status: 404 });
    }

    // Auth: the pod's moderator, OR a lifecycle manager (pods:write) scoped to
    // this pod's lab — full admins/owners plus the pod's own local labs lead.
    if (!isModeratorForPod(auth.user, podId) && !canManageEntity(auth.user, pod)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get config
    const { data: config } = await auth.supabase
      .from("cycle_config")
      .select("project_vote_threshold, max_projects, project_min")
      .eq("cycle_id", pod.cycle_id)
      .single();

    if (!config) {
      return NextResponse.json({ error: "Cycle config not found" }, { status: 500 });
    }

    // Idempotency guard: like voting finalize, this appends projects with no
    // unique constraint, so a retry/double-click would duplicate them. If this
    // pod already has projects, treat it as already finalized (audit fix).
    const { count: existingProjectCount } = await auth.supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("pod_id", podId);

    if ((existingProjectCount ?? 0) > 0) {
      return NextResponse.json(
        { error: "Projects have already been finalized for this pod." },
        { status: 409 }
      );
    }

    // W2-001 shortlist cap: min(max_projects, floor(active_enrollments / project_min)).
    // Active enrollments is cycle-wide (not just this pod) per the AC.
    const { count: participantCount } = await auth.supabase
      .from("cycle_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("cycle_id", pod.cycle_id)
      .eq("status", "active");

    const enrolledCount = participantCount ?? 0;
    const projectMin = Math.max(1, config.project_min);
    const shortlistCap = Math.min(
      config.max_projects,
      Math.floor(enrolledCount / projectMin)
    );

    // Tally votes
    const { data: votes } = await auth.supabase
      .from("project_votes")
      .select("solution_proposal_id, vote_count")
      .eq("pod_id", podId);

    const tallyMap: Record<number, number> = {};
    for (const v of votes || []) {
      tallyMap[v.solution_proposal_id] =
        (tallyMap[v.solution_proposal_id] || 0) + v.vote_count;
    }

    // Get proposals for text and tiebreaking. Submissions store their pitch in
    // proposal_data (proposal_text is legacy and typically null for
    // UI-submitted proposals), so seed the name generator from
    // proposal_data.description first and fall back through other fields
    // (audit fix: blank/garbage generated names).
    const proposalIds = Object.keys(tallyMap).map(Number);
    const { data: proposals } = await auth.supabase
      .from("solution_proposals")
      .select("id, proposal_text, proposal_data, created_at")
      .in("id", proposalIds.length > 0 ? proposalIds : [0]);

    const propMap: Record<number, { text: string; createdAt: string }> = {};
    for (const p of proposals || []) {
      const pd = (p.proposal_data ?? null) as
        | { description?: string; summary?: string; title?: string; name?: string }
        | null;
      const text =
        pd?.description || pd?.summary || pd?.title || pd?.name || p.proposal_text || "";
      propMap[p.id] = { text, createdAt: p.created_at };
    }

    const ranked = Object.entries(tallyMap)
      .map(([id, total]) => ({
        solution_proposal_id: parseInt(id, 10),
        total_votes: total,
        created_at: propMap[parseInt(id, 10)]?.createdAt || "",
        text: propMap[parseInt(id, 10)]?.text || "",
      }))
      .sort((a, b) => {
        if (b.total_votes !== a.total_votes) return b.total_votes - a.total_votes;
        return a.created_at.localeCompare(b.created_at);
      });

    const eligible = ranked.filter(
      (r) => r.total_votes >= config.project_vote_threshold
    );
    const ineligible = ranked.filter(
      (r) => r.total_votes < config.project_vote_threshold
    );

    const toCreate = eligible.slice(0, shortlistCap);

    const names = await Promise.all(
      toCreate.map(async (prop) => {
        try {
          return await generateName("project", prop.text);
        } catch {
          return prop.text.slice(0, 40).replace(/\s+\S*$/, "").trim();
        }
      })
    );

    const insertRows = toCreate.map((prop, i) => ({
      cycle_id: pod.cycle_id,
      pod_id: podId,
      solution_proposal_id: prop.solution_proposal_id,
      name: names[i],
      status: "forming",
      // A project belongs to the same lab as its pod.
      metro_slug: pod.metro_slug ?? null,
    }));

    // Insert via the service client: authorization is already enforced above
    // (admin or the pod's moderator), and the projects_insert RLS policy
    // requires is_admin_or_owner(), which a moderator is not — so a moderator
    // finalize on the user client would silently insert 0 rows (audit fix,
    // same RLS pattern as the naming/activation routes).
    const serviceClient = createServiceClient();
    const { data: insertedProjects } = insertRows.length
      ? await serviceClient.from("projects").insert(insertRows).select()
      : { data: [] };

    const projects = (insertedProjects || []).map((project, i) => ({
      id: project.id,
      name: project.name,
      solution_proposal_id: toCreate[i].solution_proposal_id,
      total_votes: toCreate[i].total_votes,
    }));

    return NextResponse.json({
      projects,
      eligible_proposals: eligible.map((e, i) => ({
        solution_proposal_id: e.solution_proposal_id,
        total_votes: e.total_votes,
        rank: i + 1,
      })),
      ineligible_proposals: ineligible.map((e) => ({
        solution_proposal_id: e.solution_proposal_id,
        total_votes: e.total_votes,
      })),
    });
  }
);
