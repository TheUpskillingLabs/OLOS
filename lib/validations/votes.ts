import { z } from "zod";

export const proposalDataSchema = z.object({
  about: z.object({
    background: z.string().max(500).optional(),
    experience: z.enum(["lived", "witnessed", "both"]).optional(),
  }).optional(),
  // The Problem Situation, in the Triangulator workbook's own fields — the
  // wizard asks for exactly what the Deepen stages made the submitter write
  // (title/description/openness from Stage 1, paradox + pressure-test from
  // Stage 5), so submission is a paste, not a re-derivation. The legacy
  // `problem` block (who/need/barrier/success) is accepted read-only for old
  // rows but no longer collected.
  situation: z.object({
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(2000),
    openness: z.string().min(1).max(2000),
    paradox: z.string().min(1).max(2000),
    beneficiaries: z.string().max(2000).optional(),
    problematization: z.string().max(2000).optional(),
  }),
  problem: z
    .object({
      who: z.string().min(1).max(2000),
      need: z.string().min(1).max(2000),
      barrier: z.string().min(1).max(2000),
      success: z.string().min(1).max(2000),
    })
    .optional(),
  statement: z.object({
    text: z.string().min(1).max(2000),
    question: z.string().min(1).max(2000),
    // Where the submitter's Triangulator working folder lives (usually a
    // GitHub repo). Scheme-restricted: .url() alone admits javascript:/data:
    // URLs, and this value is rendered as an href on the ballot and gallery.
    repo_url: z
      .string()
      .url("Must be a valid URL")
      .max(500)
      .regex(/^https?:\/\//i, "Must be an http(s) URL")
      .optional(),
  }),
  context: z.object({
    impact_track: z.string().max(200).optional(),
    theme_alignment: z.enum(["none", "direct", "adjacent"]).optional(),
    theme_connection: z.string().max(1000).optional(),
  }).optional(),
  voter_context: z.object({
    tried: z.string().max(2000).optional(),
    scale: z.string().max(2000).optional(),
    pod_work: z.string().max(2000).optional(),
    skills_needed: z.string().max(2000).optional(),
  }).optional(),
  // Pre-submit self-check, in the Triangulator's own rules: evidence-grounded,
  // real actors, no solutions, a self-undoing paradox, one shared picture.
  checklist: z
    .object({
      grounded_in_evidence: z.boolean(),
      real_actors: z.boolean(),
      no_solution: z.boolean(),
      paradox_self_undoing: z.boolean(),
      same_picture: z.boolean(),
    })
    .optional(),
});

export const problemStatementSchema = z.object({
  cycle_id: z.number().int({ message: "cycle_id must be a number" }),
  statement_text: z
    .string()
    .min(1, "statement_text is required")
    .max(5000, "statement_text must be 5000 characters or fewer"),
  proposal_data: proposalDataSchema.optional(),
});

export const voteSchema = z.object({
  cycle_id: z.number().int({ message: "cycle_id must be a number" }),
  problem_statement_id: z.number().int({
    message: "problem_statement_id must be a number",
  }),
  vote_count: z
    .number()
    .int()
    .min(1, "vote_count must be >= 1"),
});

// Set-absolute vote allocation: "set my votes on this statement to N".
// Unlike voteSchema (additive POST), 0 is allowed and means "remove my votes".
export const voteSetSchema = z.object({
  cycle_id: z.number().int({ message: "cycle_id must be a number" }),
  problem_statement_id: z.number().int({
    message: "problem_statement_id must be a number",
  }),
  vote_count: z
    .number()
    .int()
    .min(0, "vote_count must be >= 0"),
});
