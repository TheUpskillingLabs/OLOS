import { SupabaseClient } from "@supabase/supabase-js";

const ownerEmails: string[] = (process.env.OWNER_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isOwnerEmail(email: string): boolean {
  return ownerEmails.includes(email.toLowerCase());
}

export async function ensureOwnerRole(
  supabase: SupabaseClient,
  participantId: number
): Promise<void> {
  await supabase.from("user_roles").upsert(
    {
      participant_id: participantId,
      role: "owner",
      granted_by: null,
      granted_at: new Date().toISOString(),
    },
    { onConflict: "participant_id,role", ignoreDuplicates: true }
  );
}
