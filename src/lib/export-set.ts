/**
 * Helpers for multi-scale raster export (@1x / @2x / @3x and friends).
 * Pure size math + filename suffixes — unit-testable; the component does the
 * actual rasterize + zip.
 */

export interface SizeEntry {
  scale: number;
  /** Longest-edge pixel size for this scale. */
  size: number;
  /** Filename suffix, e.g. "@2x". */
  suffix: string;
}

export const DEFAULT_SCALES = [1, 2, 3];

/**
 * Build the entries for a base longest-edge size across the given scales.
 * Sizes are rounded; non-positive scales are dropped.
 */
export function buildSizeSet(baseLongest: number, scales: number[] = DEFAULT_SCALES): SizeEntry[] {
  return scales
    .filter((s) => s > 0)
    .map((scale) => ({
      scale,
      size: Math.max(1, Math.round(baseLongest * scale)),
      suffix: `@${scale}x`,
    }));
}
