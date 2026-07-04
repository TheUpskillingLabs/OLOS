import { z } from "zod";

/* The poderator's scoped member edit (contact/display fields ONLY — the
   prototype member drawer's rule). Identity (names beyond preferred,
   email), enrollment, and roles are all out of reach; email in particular
   is the auth-linkage key and stays admin-only. */
export const podMemberScopedUpdateSchema = z
  .object({
    preferred_name: z.string().trim().min(1).max(100).optional(),
    phone_number: z.string().trim().max(50).optional().nullable(),
    availability_snippet: z.string().trim().max(200).optional().nullable(),
  })
  .strict();
