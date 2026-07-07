import { z } from "zod";
import { PERMISSIONS, ROLE_PRESETS } from "@/lib/auth/permissions";

export const createInvitationSchema = z.object({
  email: z.string().email("Invalid email address"),
  role_preset: z
    .enum(Object.keys(ROLE_PRESETS) as [string, ...string[]])
    .nullable()
    .optional(),
  permissions: z
    .array(z.enum(PERMISSIONS as unknown as [string, ...string[]]))
    .optional(),
  cycle_id: z.number().int().positive().nullable().optional(),
  pod_id: z.number().int().positive().nullable().optional(),
  pod_role: z.enum(["co_lead", "member"]).nullable().optional(),
});

export const revokeInvitationSchema = z.object({
  status: z.literal("revoked"),
});

export const togglePermissionsSchema = z.object({
  participant_id: z.number().int({ message: "participant_id must be a number" }),
  permissions: z.array(z.string().min(1)).min(1, "At least one permission required"),
  action: z.enum(["grant", "revoke"]),
});

export const applyPresetSchema = z.object({
  participant_id: z.number().int({ message: "participant_id must be a number" }),
  preset: z.enum(Object.keys(ROLE_PRESETS) as [string, ...string[]]),
});
