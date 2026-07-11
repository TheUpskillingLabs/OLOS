import { z } from "zod";

/** Allowed attachment limits — kept in sync with the client widget. */
export const MAX_ATTACHMENTS = 3;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5MB
export const ALLOWED_ATTACHMENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

const attachmentSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(ALLOWED_ATTACHMENT_TYPES, {
    message: "Attachments must be PNG, JPEG, or WebP images",
  }),
  // base64-encoded image bytes (no data: prefix)
  data: z
    .string()
    .min(1, "Attachment data is required")
    .refine(
      (b64) => Math.ceil((b64.length * 3) / 4) <= MAX_ATTACHMENT_BYTES,
      { message: "Each image must be 5MB or smaller" }
    ),
});

/** Triage statuses for a feedback submission (mirrors the DB CHECK on
 *  feedback.status). Admins move a row through these in /admin/feedback. */
export const FEEDBACK_STATUSES = [
  "open",
  "in_review",
  "resolved",
  "closed",
] as const;

export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

/** Admin status change from the review UI — the only field an admin edits. */
export const feedbackStatusPatchSchema = z.object({
  status: z.enum(FEEDBACK_STATUSES, {
    message: 'Status must be "open", "in_review", "resolved", or "closed"',
  }),
});

export type FeedbackStatusPatchInput = z.infer<typeof feedbackStatusPatchSchema>;

export const createFeedbackSchema = z.object({
  category: z.enum(["bug", "suggestion", "other"], {
    message: 'Category must be "bug", "suggestion", or "other"',
  }),
  description: z
    .string()
    .trim()
    .min(1, "Please describe the problem")
    .max(5000, "Description is too long (5000 characters max)"),
  page_url: z.string().max(2048).optional(),
  attachments: z.array(attachmentSchema).max(MAX_ATTACHMENTS).optional(),
});

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;
