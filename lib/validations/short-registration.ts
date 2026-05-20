import { z } from "zod";

export const shortRegistrationSchema = z.object({
  auth_user_id: z.string().min(1, "auth_user_id is required"),
  google_id: z.string().min(1, "google_id is required").max(200),
  email: z.string().email("Invalid email").max(320),
  first_name: z.string().min(1, "first_name is required").max(100),
  last_name: z.string().min(1, "last_name is required").max(100),
  contact_consent: z.literal(true, "You must consent to be contacted"),
});
