// ZIP → state, by 3-digit prefix (client-safe, no imports). The profile's
// state field is the DC-metro set (MD/DC/VA/Other — participants_state_check),
// so only those prefixes are mapped; everything else is "Other". Distinct from
// metroFromZip (lib/metros.ts), which maps zip → local lab from DB data.
//
// Prefix ranges: 200/202–205 DC (residential + federal), 201 VA (NoVa —
// inside the 200s block, why simple range checks won't do), 206–219 MD,
// 220–246 VA.

const DC_PREFIXES = new Set(["200", "202", "203", "204", "205"]);

export function stateFromZip(zip: string): "MD" | "DC" | "VA" | "Other" {
  if (!/^\d{5}$/.test(zip)) return "Other";
  const prefix = zip.slice(0, 3);
  const n = Number(prefix);
  if (DC_PREFIXES.has(prefix)) return "DC";
  if (n === 201 || (n >= 220 && n <= 246)) return "VA";
  if (n >= 206 && n <= 219) return "MD";
  return "Other";
}
