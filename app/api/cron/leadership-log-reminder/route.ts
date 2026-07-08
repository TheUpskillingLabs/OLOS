import { NextResponse, NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { one } from "@/lib/supabase/embed";
import { getResendClient, FROM_EMAIL } from "@/lib/email";
import {
  leadershipReminderSubject,
  leadershipReminderEmailHtml,
  leadershipReminderEmailText,
} from "@/lib/email/leadership-log-reminder-template";

// The Leadership Log reminder (docs/ORG_CYCLES.md §4a). Day-aware: the cascade
// arms Wednesday, so this daily run nudges the tier whose target day is TODAY —
// workstream leads Thursday, lab leads Friday — and no-ops on other days. Day
// is read by UTC weekday (the 09:00 UTC run and the 13:00 UTC Wed arm both land
// on the intended ET day). One email per unsubmitted lead. Non-blocking: the
// gate does no enforcing here, this is just the nudge.

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const SEND_DELAY_MS = 200;
type Tier = "workstream_lead" | "lab_lead";
type PersonEmbed = { id: number; email: string };

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_APP_URL is not set" },
      { status: 500 }
    );
  }

  const now = Date.now();
  const dow = new Date(now).getUTCDay(); // 0=Sun … 4=Thu, 5=Fri
  const tier: Tier | null =
    dow === 4 ? "workstream_lead" : dow === 5 ? "lab_lead" : null;
  if (!tier) {
    return NextResponse.json({
      sent_count: 0,
      note: "no leadership tier targeted today",
      timestamp: new Date().toISOString(),
    });
  }

  const supabase = createServiceClient();
  const dashboardUrl = `${appUrl}/dashboard`;

  const { data: cycles } = await supabase
    .from("cycles")
    .select(
      "id, name, lab_id, cycle_config(leadership_log_due_at, leadership_log_gate_paused)"
    )
    .eq("status", "active")
    .eq("mode", "org");

  // participant_id → { email, scopeNames[] } for this tier's unsubmitted leads.
  const remind = new Map<number, { email: string; scopeNames: string[] }>();
  const add = (id: number, email: string, scope: string) => {
    const e = remind.get(id);
    if (e) e.scopeNames.push(scope);
    else remind.set(id, { email, scopeNames: [scope] });
  };

  for (const cycle of cycles ?? []) {
    const config = Array.isArray(cycle.cycle_config)
      ? cycle.cycle_config[0]
      : cycle.cycle_config;
    const due = config?.leadership_log_due_at as string | undefined;
    if (!due || config?.leadership_log_gate_paused) continue;
    if (now - new Date(due).getTime() >= ONE_WEEK_MS) continue; // stale

    if (tier === "workstream_lead") {
      const { data: mods } = await supabase
        .from("moderator_assignments")
        .select("participant_id, pod_id, participants:participant_id(id, email)")
        .eq("cycle_id", cycle.id)
        .is("removed_at", null);
      const podIds = [...new Set((mods ?? []).map((m) => m.pod_id))];
      const { data: runPods } = podIds.length
        ? await supabase
            .from("pods")
            .select("id, workstream_id, workstreams(name)")
            .in("id", podIds)
            .not("workstream_id", "is", null)
        : { data: [] as { id: number; workstream_id: number; workstreams: unknown }[] };
      const runName = new Map(
        (runPods ?? []).map((p) => [
          p.id,
          one(p.workstreams as { name: string } | { name: string }[] | null)?.name ??
            "your workstream",
        ])
      );

      for (const m of mods ?? []) {
        if (!runName.has(m.pod_id)) continue; // not a workstream run pod
        const p = one(m.participants as PersonEmbed | PersonEmbed[] | null);
        if (!p?.email) continue;
        const { count } = await supabase
          .from("leadership_logs")
          .select("id", { count: "exact", head: true })
          .eq("participant_id", p.id)
          .eq("cycle_id", cycle.id)
          .eq("tier", "workstream_lead")
          .eq("pod_id", m.pod_id)
          .gte("created_at", due);
        if ((count ?? 0) > 0) continue;
        add(p.id, p.email, runName.get(m.pod_id)!);
      }
    } else if (cycle.lab_id != null) {
      const { data: leads } = await supabase
        .from("lab_leads")
        .select("participant_id, participants:participant_id(id, email)")
        .eq("lab_id", cycle.lab_id)
        .is("removed_at", null);
      const { data: labRow } = await supabase
        .from("metros")
        .select("name")
        .eq("id", cycle.lab_id)
        .maybeSingle();
      const labName = labRow?.name ?? "your lab";
      for (const l of leads ?? []) {
        const p = one(l.participants as PersonEmbed | PersonEmbed[] | null);
        if (!p?.email) continue;
        const { count } = await supabase
          .from("leadership_logs")
          .select("id", { count: "exact", head: true })
          .eq("participant_id", p.id)
          .eq("cycle_id", cycle.id)
          .eq("tier", "lab_lead")
          .eq("lab_id", cycle.lab_id)
          .gte("created_at", due);
        if ((count ?? 0) > 0) continue;
        add(p.id, p.email, labName);
      }
    }
  }

  const resend = getResendClient();
  const outcomes: { participant_id: number; status: "sent" | "error" }[] = [];
  for (const [pid, r] of remind) {
    try {
      const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: r.email,
        subject: leadershipReminderSubject(tier),
        html: leadershipReminderEmailHtml({
          dashboardUrl,
          tier,
          scopeNames: r.scopeNames,
        }),
        text: leadershipReminderEmailText({
          dashboardUrl,
          tier,
          scopeNames: r.scopeNames,
        }),
      });
      outcomes.push({ participant_id: pid, status: error ? "error" : "sent" });
    } catch {
      outcomes.push({ participant_id: pid, status: "error" });
    }
    await new Promise((res) => setTimeout(res, SEND_DELAY_MS));
  }

  return NextResponse.json({
    tier,
    sent_count: outcomes.filter((o) => o.status === "sent").length,
    outcomes,
    timestamp: new Date().toISOString(),
  });
}
