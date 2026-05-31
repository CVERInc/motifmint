/**
 * Auto-detect the background color of a traced mark so it can be dropped in one
 * click (great for logos on a solid plate).
 *
 * Pure + testable: it works from the per-path bounding boxes the component
 * already measures (via the DOM) plus the viewBox — no DOM here. The heuristic:
 * a background is the color whose paths together cover most of the canvas AND
 * reach its edges. If nothing fits, returns null (don't guess).
 */

export interface PathBox {
  fill: string; // normalized hex, lowercase
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DetectOptions {
  /** Min fraction of the canvas the color's union box must cover (0–1). */
  coverage?: number;
  /** How close to an edge counts as "touching", as a fraction of the side. */
  edgeTol?: number;
  /** Min number of the 4 edges the union box must reach. */
  minEdges?: number;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Pick the most likely background color, or null if none is convincing.
 * Ties on coverage are broken toward the larger box (stable, deterministic).
 */
export function detectBackgroundColor(
  boxes: PathBox[],
  viewBox: Box,
  opts: DetectOptions = {},
): string | null {
  const coverage = opts.coverage ?? 0.6;
  const edgeTol = opts.edgeTol ?? 0.05;
  const minEdges = opts.minEdges ?? 3;

  const canvasArea = viewBox.w * viewBox.h;
  if (canvasArea <= 0 || boxes.length === 0) return null;

  // Union the boxes per color.
  const byColor = new Map<string, { x1: number; y1: number; x2: number; y2: number }>();
  for (const b of boxes) {
    const cur = byColor.get(b.fill);
    const x1 = b.x;
    const y1 = b.y;
    const x2 = b.x + b.w;
    const y2 = b.y + b.h;
    if (!cur) byColor.set(b.fill, { x1, y1, x2, y2 });
    else {
      cur.x1 = Math.min(cur.x1, x1);
      cur.y1 = Math.min(cur.y1, y1);
      cur.x2 = Math.max(cur.x2, x2);
      cur.y2 = Math.max(cur.y2, y2);
    }
  }

  const tolX = edgeTol * viewBox.w;
  const tolY = edgeTol * viewBox.h;
  const vx2 = viewBox.x + viewBox.w;
  const vy2 = viewBox.y + viewBox.h;

  let best: { fill: string; frac: number } | null = null;
  for (const [fill, u] of byColor) {
    const frac = ((u.x2 - u.x1) * (u.y2 - u.y1)) / canvasArea;
    if (frac < coverage) continue;
    let edges = 0;
    if (u.x1 <= viewBox.x + tolX) edges++;
    if (u.y1 <= viewBox.y + tolY) edges++;
    if (u.x2 >= vx2 - tolX) edges++;
    if (u.y2 >= vy2 - tolY) edges++;
    if (edges < minEdges) continue;
    if (!best || frac > best.frac) best = { fill, frac };
  }
  return best?.fill ?? null;
}
