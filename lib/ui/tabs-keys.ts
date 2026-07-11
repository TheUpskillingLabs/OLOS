/**
 * Keyboard navigation for the shared Tabs component (WAI-ARIA tabs
 * pattern, automatic activation): Arrow keys move selection with
 * wrap-around, Home/End jump to the edges. Pure so it can be unit
 * tested — the component owns focus movement and preventDefault.
 */

export function nextTabValue(
  values: string[],
  current: string,
  key: string
): string | null {
  if (values.length === 0) return null;
  const found = values.indexOf(current);
  const idx = found === -1 ? 0 : found;
  switch (key) {
    case "ArrowRight":
      return values[(idx + 1) % values.length];
    case "ArrowLeft":
      return values[(idx - 1 + values.length) % values.length];
    case "Home":
      return values[0];
    case "End":
      return values[values.length - 1];
    default:
      return null;
  }
}
