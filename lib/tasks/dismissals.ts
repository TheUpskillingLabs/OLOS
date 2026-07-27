import { createServiceClient } from "@/lib/supabase/server";

/* Read side of the task-dismissal store (task_dismissals, 00092). The
   write side is POST /api/tasks/dismiss (member self-service, RLS-backed);
   this service-role read feeds the server-rendered dashboard so dismissed
   tasks never reach the client at all — no read-before-paint flash guard
   needed. Key grammar: lib/tasks/keys.ts. */

export async function dismissedTaskKeys(
  participantId: number
): Promise<Set<string>> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("task_dismissals")
    .select("task_key")
    .eq("participant_id", participantId);
  return new Set((data ?? []).map((r) => r.task_key));
}
