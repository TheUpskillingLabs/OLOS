import { z } from "zod";

// Request contracts for app/api/ambassadors/** (docs/ambassadors/CLAUDE.md).

/** The apply flow, one action per screen. */
export const ambassadorApplicationSchema = z.discriminatedUnion("action", [
  // Watched the film or read the short version.
  z.object({ action: z.literal("oriented") }),
  // The quiz: option indexes in question order; graded on the server.
  z.object({ action: z.literal("quiz"), answers: z.array(z.number().int().min(0)).max(50) }),
  // The Ambassador Agreement, at the version the page showed.
  z.object({ action: z.literal("agreement"), version: z.string().min(1).max(40) }),
  // Finish: who brought you in, and the invite/share link this came through.
  z.object({
    action: z.literal("submit"),
    referred_by: z.string().trim().max(255).optional(),
    invite_token: z.string().trim().max(64).optional(),
    ref: z.string().trim().max(80).optional(),
  }),
]);
export type AmbassadorApplicationBody = z.infer<typeof ambassadorApplicationSchema>;

export const ambassadorProgressSchema = z.object({
  step_id: z.string().min(1).max(40),
});

/** A coordinator's action on one application. A pending application is
 *  decided by two reviews (`review`, lib/ambassador/review.ts); `approve` only
 *  reinstates someone who stepped back. */
export const ambassadorDecisionSchema = z
  .object({
    action: z.enum(["review", "approve", "reopen", "button_given", "step_back"]),
    decision: z.enum(["approve", "decline"]).optional(),
    note: z.string().trim().max(1000).optional(),
  })
  .refine((b) => b.action !== "review" || b.decision, { message: "Pick approve or decline.", path: ["decision"] });
export type AmbassadorDecision = z.infer<typeof ambassadorDecisionSchema>["action"];

export const ambassadorInviteSchema = z.object({
  first_name: z.string().trim().min(1, "Add their first name.").max(100),
  last_name: z.string().trim().max(100).optional(),
  email: z.union([z.string().trim().email("That email doesn't look right.").max(320), z.literal("")]).optional(),
  note: z.string().trim().max(200).optional(),
  inviter_name: z.string().trim().min(1, "Add your name.").max(100),
  /** Required for a Lab lead (their Lab); an admin may leave it empty for HQ. */
  lab_id: z.number().int().positive().nullable().optional(),
  nomination_id: z.number().int().positive().optional(),
});

export const ambassadorNominationSchema = z.object({
  nominee_name: z.string().trim().min(1, "Add their name.").max(120),
  how_known: z.string().trim().max(300).optional(),
  reason: z.string().trim().min(1, "Add a line on why.").max(1000),
  nominee_contact: z.string().trim().max(320).optional(),
});

export const ambassadorNominationDecisionSchema = z.object({
  action: z.enum(["decline", "reopen"]),
});
