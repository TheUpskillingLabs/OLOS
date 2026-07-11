/* Display label for a metro / local lab — pure and client-safe (lib/metros.ts
   is server-only via its supabase import, so the label helper lives here).

   Some metros store the state inside `name` itself (e.g. name "Washington, DC"
   with st "DC"); naively joining the two produced "Washington, DC, DC" across
   the directory, profiles, and the signup funnel (July 2026 feedback). A
   couple of call sites carried a `slug !== "dc"` band-aid — this replaces
   both patterns. */

export function metroLabel(
  name: string | null | undefined,
  st?: string | null
): string {
  const n = (name ?? "").trim();
  if (!st) return n;
  if (n.toLowerCase().endsWith(`, ${st.toLowerCase()}`)) return n;
  return n ? `${n}, ${st}` : st;
}
