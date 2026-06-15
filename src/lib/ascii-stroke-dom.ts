/**
 * Browser-only bridge for the vector-stroke ASCII mode: turn a composed SVG
 * string into the grid-space polylines that {@link strokeToAscii} rasterises.
 *
 * Why this is separate (and untested): it leans on real SVG geometry —
 * getTotalLength / getPointAtLength / getCTM — which only exist on elements
 * mounted in a rendered document. The pure half (polylines → glyphs) lives in
 * ascii.ts and carries the unit tests; this half is the thin DOM membrane.
 *
 * The studio already owns the real vector (no Sobel guessing): we sample each
 * geometry element's centreline, project it through the element's CTM into the
 * viewBox, then into the cell grid. Big jumps between sub-paths (M…Z M…Z) break
 * the polyline so we never draw a stray line across a hole.
 */
import { TERMINAL_CELL_ASPECT, type StrokePoint } from './ascii';

export interface SampledStrokes {
  polylines: StrokePoint[][];
  cols: number;
  rows: number;
}

const GEOMETRY_SELECTOR = 'path, line, polyline, polygon, circle, ellipse, rect';

/** Parse "rgb(r, g, b)" / "rgba(r, g, b, a)" → channels, or null (e.g. 'none'). */
function parseRgb(value: string): { r: number; g: number; b: number } | null {
  const m = value.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (!m) return null;
  return { r: +m[1], g: +m[2], b: +m[3] };
}

/** The colour to stamp on a geometry element's samples: its fill, else stroke. */
function elementColor(el: Element): { r: number; g: number; b: number } | null {
  const cs = getComputedStyle(el);
  if (cs.fill && cs.fill !== 'none') {
    const c = parseRgb(cs.fill);
    if (c) return c;
  }
  if (cs.stroke && cs.stroke !== 'none') {
    const c = parseRgb(cs.stroke);
    if (c) return c;
  }
  return null;
}

/**
 * Sample an SVG string into grid-space polylines. `cols` is the target width in
 * characters; rows follow from the viewBox aspect and the terminal cell aspect,
 * matching imageToAscii so the vector and raster modes line up.
 *
 * Returns null if the SVG can't be parsed or has no usable viewBox/geometry.
 */
export function sampleSvgStrokes(
  svgText: string,
  cols: number,
  charAspect: number = TERMINAL_CELL_ASPECT,
): SampledStrokes | null {
  if (typeof document === 'undefined') return null;

  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.nodeName === 'parsererror' || root.tagName.toLowerCase() !== 'svg') return null;

  // Resolve the user-space box: explicit viewBox, else width/height.
  const vb = root.getAttribute('viewBox');
  let vbX = 0;
  let vbY = 0;
  let vbW = 0;
  let vbH = 0;
  if (vb) {
    const n = vb
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (n.length === 4 && n.every((v) => Number.isFinite(v))) [vbX, vbY, vbW, vbH] = n;
  }
  if (!(vbW > 0 && vbH > 0)) {
    vbW = parseFloat(root.getAttribute('width') ?? '') || 0;
    vbH = parseFloat(root.getAttribute('height') ?? '') || 0;
  }
  if (!(vbW > 0 && vbH > 0)) return null;

  const c = Math.max(1, Math.floor(cols));
  const rows = Math.max(1, Math.round(c * (vbH / vbW) * charAspect));

  // Mount offscreen so getCTM / getPointAtLength have a live layout to read.
  // Force the viewport to the viewBox size so the viewBox→viewport transform is
  // 1:1 (translate(-vbX,-vbY), scale 1): getCTM then maps element-local space to
  // user space minus the viewBox origin, exactly what toGrid expects below.
  const host = document.createElement('div');
  host.setAttribute(
    'style',
    'position:absolute;left:-99999px;top:0;width:0;height:0;overflow:hidden',
  );
  const mounted = document.importNode(root, true) as SVGSVGElement;
  mounted.setAttribute('width', String(vbW));
  mounted.setAttribute('height', String(vbH));
  mounted.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  host.appendChild(mounted);
  document.body.appendChild(host);

  // px,py are post-CTM viewport coords (origin already at the viewBox corner).
  const toGrid = (px: number, py: number): [number, number] => [(px / vbW) * c, (py / vbH) * rows];
  // A jump larger than this (in cells) means a sub-path hop — break the line.
  const BREAK = 1.8;
  // Sample roughly every 0.4 cells along each path.
  const stepUser = (vbW / c) * 0.4 || 1;
  const MAX_SAMPLES = 40000;

  const polylines: StrokePoint[][] = [];
  try {
    const geoms = Array.from(mounted.querySelectorAll(GEOMETRY_SELECTOR));
    let budget = MAX_SAMPLES;
    for (const el of geoms) {
      const geo = el as SVGGeometryElement;
      let total = 0;
      try {
        total = geo.getTotalLength();
      } catch {
        continue;
      }
      if (!(total > 0)) continue;
      const ctm = geo.getCTM();
      const col = elementColor(el) ?? undefined;

      let cur: StrokePoint[] = [];
      let prev: [number, number] | null = null;
      const steps = Math.min(budget, Math.max(1, Math.ceil(total / stepUser)));
      for (let i = 0; i <= steps && budget > 0; i++) {
        budget--;
        const raw = geo.getPointAtLength((i / steps) * total);
        // With a CTM the point lands in viewport space (origin at viewBox corner);
        // without one it's raw user space, so drop the viewBox origin ourselves.
        const pt = ctm ? raw.matrixTransform(ctm) : { x: raw.x - vbX, y: raw.y - vbY };
        const [gx, gy] = toGrid(pt.x, pt.y);
        if (prev && Math.hypot(gx - prev[0], gy - prev[1]) > BREAK) {
          if (cur.length > 1) polylines.push(cur);
          cur = [];
        }
        cur.push(col ? { x: gx, y: gy, ...col } : { x: gx, y: gy });
        prev = [gx, gy];
      }
      if (cur.length > 1) polylines.push(cur);
      if (budget <= 0) break;
    }
  } finally {
    document.body.removeChild(host);
  }

  if (!polylines.length) return null;
  return { polylines, cols: c, rows };
}
