import { SupabaseClient } from "@supabase/supabase-js";
import { ROLE_PRESETS } from "./permissions";

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
  // Record the owner role for audit/display
  await supabase.from("user_roles").upsert(
    {
      participant_id: participantId,
      role: "owner",
      granted_by: null,
      granted_at: new Date().toISOString(),
    },
    { onConflict: "participant_id,role", ignoreDuplicates: true }
  );

  // Seed all owner permissions — this is what actually gates access checks
  // (isOwner / isAdmin / can() all read from participant_permissions, not user_roles)
  const rows = ROLE_PRESETS.owner.map((permission) => ({
    participant_id: participantId,
    permission,
  }));
  await supabase
    .from("participant_permissions")
    .upsert(rows, { onConflict: "participant_id,permission", ignoreDuplicates: true });
}
