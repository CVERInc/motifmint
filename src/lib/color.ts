/** Shared hex-colour parsing (single definition — was re-implemented per lib). */

/** `#rrggbb` or `#rrggbbaa` (alpha ignored) → [r, g, b], or null if malformed. */
export function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.match(/^#?([0-9a-f]{6})(?:[0-9a-f]{2})?$/i);
  if (!m) return null;
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}
