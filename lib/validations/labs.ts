import { z } from "zod";

// "Start a waitlist" (docs/LOCAL_LABS.md): the caller names a city and an
// optional 2-letter state. find-or-create dedupes on (name, st), so a typo'd
// or existing city routes to the existing lab rather than spawning a dupe.
export const startWaitlistSchema = z.object({
  city: z.string().trim().min(1, "Enter a city").max(100),
  st: z.string().trim().max(2).optional(),
});

export type StartWaitlistInput = z.infer<typeof startWaitlistSchema>;
