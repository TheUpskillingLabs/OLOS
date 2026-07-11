import { z } from "zod";

// Owner lifecycle actions (the /api/owner/[entity]/[id] surface).
// `confirm` echoes the entity label the owner typed in the confirm dialog — a
// belt-and-suspenders check on top of type-to-confirm in the UI. `reason` is an
// optional free-text note recorded in the owner_actions audit log.
export const ownerActionSchema = z.object({
  action: z.enum(["archive", "reset"]),
  reason: z.string().trim().max(500).optional(),
  confirm: z.string().max(320).optional(),
});

export const ownerDeleteSchema = z.object({
  reason: z.string().trim().max(500).optional(),
  confirm: z.string().max(320).optional(),
});

export type OwnerActionInput = z.infer<typeof ownerActionSchema>;
export type OwnerDeleteInput = z.infer<typeof ownerDeleteSchema>;
