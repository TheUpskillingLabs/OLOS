/* The weekly-hours buckets — ONE definition for every surface that asks
 * "how much time?": the cycle-registration ceremony's hours question and
 * the weekly Learning Log's "How many hours did you put into Labs work
 * this week?" (v2 instrument).
 *
 * These strings are a data contract, not just copy: migration
 * 00082_availability_reg_hours.sql seeds option_lists('availability')
 * with these exact values, and the agreement route resolves the ceremony
 * answer to an option_id by string equality. Byte-exactness matters —
 * en-dash (–, U+2013), spaces around "/". Change them only together with
 * a migration that reshapes the availability list.
 */
export const HOURS_BUCKETS = [
  "2–4 hrs / week",
  "5–8 hrs / week",
  "8+ hrs / week",
] as const;

export type HoursBucket = (typeof HOURS_BUCKETS)[number];
