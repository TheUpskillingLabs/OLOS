/* Member-facing copy for event registration surfaces.

   Kept out of the components so the number in the string and the cron
   schedule in vercel.json stay one decision rather than two: the
   Luma to event_rsvps guest mirror runs every 15 minutes, so a registration
   made on Luma's own page can be that far behind what OLOS shows. Change one,
   change the other.

   In-app registrations do NOT have this lag. MemberRegister posts to
   /api/events/[event_id]/rsvp, which writes the row synchronously with
   participant_id set, so those appear immediately. This line is only for the
   Luma-side path, where the member did something real and OLOS does not know
   about it yet. Saying so is the whole point: an empty list that offers no
   explanation reads as "your registration did not work", which is exactly the
   confusion the profile-save report was made of. */
export const LUMA_SYNC_LAG_NOTE =
  "Registered on Luma? It can take up to 15 minutes to show up here.";
