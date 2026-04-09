import { SupabaseClient } from "@supabase/supabase-js";

type WindowField =
  | "problem_statement"
  | "voting"
  | "pod_registration"
  | "solution_proposal"
  | "solution_voting"
  | "project_registration";

const WINDOW_MESSAGES: Record<WindowField, string> = {
  problem_statement: "Problem statement submission is not currently open.",
  voting: "Voting is not currently open.",
  pod_registration: "Pod registration is not currently open.",
  solution_proposal: "Solution proposal submission is not currently open.",
  solution_voting: "Solution voting is not currently open.",
  project_registration: "Project registration is not currently open.",
};

export async function checkWindow(
  supabase: SupabaseClient,
  cycleId: number,
  field: WindowField
): Promise<{ open: boolean; message: string }> {
  const { data: config } = await supabase
    .from("cycle_config")
    .select(`${field}_open, ${field}_close`)
    .eq("cycle_id", cycleId)
    .single();

  if (!config) {
    return { open: false, message: "Cycle configuration not found." };
  }

  const configRecord = config as Record<string, unknown>;
  const openTime = configRecord[`${field}_open`] as string | null;
  const closeTime = configRecord[`${field}_close`] as string | null;

  if (!openTime || !closeTime) {
    return { open: false, message: WINDOW_MESSAGES[field] };
  }

  const now = new Date();
  if (now < new Date(openTime) || now > new Date(closeTime)) {
    return { open: false, message: WINDOW_MESSAGES[field] };
  }

  return { open: true, message: "" };
}
