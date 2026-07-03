import { z } from "zod";

/** The email-only public event RSVP (owner rule: never account-gated). */
export const eventRsvpSchema = z.object({
  email: z.string().trim().email("Invalid email").max(320),
});

export type EventRsvpInput = z.infer<typeof eventRsvpSchema>;
