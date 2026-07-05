import { z } from "zod";

// "Share your story" — the public spotlight submission (onboarding-proto's
// stories.html share modal). Name + story are required; email is an optional
// contact so the Labs team can follow up before publishing.
export const storySubmissionSchema = z.object({
  name: z.string().trim().min(1, "Add your name").max(200),
  story: z
    .string()
    .trim()
    .min(20, "Tell us a little more — a sentence or two")
    .max(4000, "That's a bit long — trim it down"),
  email: z
    .string()
    .trim()
    .email("That email doesn't look right")
    .max(320)
    .optional()
    .or(z.literal("")),
});

export type StorySubmissionInput = z.infer<typeof storySubmissionSchema>;
