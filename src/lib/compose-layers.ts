/**
 * Compose several traced images into ONE mark.
 *
 * Each layer is an independently-traced `<svg>`; this merges them into a single
 * square-canvas SVG by wrapping every layer's content in a `<g transform>` that
 * fits its own viewBox into the shared canvas, then applies the layer's offset
 * and scale. The merged SVG then flows through the *existing* edit/export
 * pipeline unchanged (injectOrigIdx re-numbers all paths globally afterwards).
 *
 * Pure string/data math — no DOM — so it's fully unit-testable. Positioning UX
 * (drag on canvas) lives in the component; this is the deterministic engine.
 *
 * Backwards-compatible: a single untransformed layer passes through verbatim,
 * so the single-image flow behaves exactly as before.
 */
import { readViewBox } from './backdrop';

export interface LayerTransform {
  /** Offset as a fraction of the canvas side (−1…1). 0 = centered. */
  dx: number;
  dy: number;
  /** Multiplier on the fit-to-canvas scale. 1 = contain & centered. */
  scale: number;
}

export const IDENTITY_TRANSFORM: LayerTransform = { dx: 0, dy: 0, scale: 1 };

export interface ComposeLayer {
  /** Full traced `<svg>…</svg>` for this layer. */
  svg: string;
  transform?: LayerTransform;
  hidden?: boolean;
}

export const DEFAULT_CANVAS = 1024;

function isIdentity(t?: LayerTransform): boolean {
  return !t || (t.dx === 0 && t.dy === 0 && t.scale === 1);
}

/** The markup between the outermost `<svg …>` and its closing `</svg>`. */
export function extractSvgInner(svg: string): string {
  const open = svg.match(/<svg\b[^>]*>/i);
  if (!open) return svg.trim();
  const start = (open.index ?? 0) + open[0].length;
  const end = svg.lastIndexOf('</svg>');
  return svg.slice(start, end === -1 ? undefined : end).trim();
}

/**
 * Transform mapping a layer's own viewBox into an `size`×`size` canvas:
 * fit-contain (preserving aspect), centered, then user scale + offset.
 */
export function composeTransform(
  vb: { x: number; y: number; w: number; h: number },
  t: LayerTransform,
  size: number,
): { f: number; tx: number; ty: number } {
  const round = (n: number) => Math.round(n * 1000) / 1000;
  const maxDim = Math.max(vb.w, vb.h) || 1;
  const f = (size * t.scale) / maxDim;
  const tx = (size - vb.w * f) / 2 - vb.x * f + t.dx * size;
  const ty = (size - vb.h * f) / 2 - vb.y * f + t.dy * size;
  return { f: round(f), tx: round(tx), ty: round(ty) };
}

/** Merge visible layers into one square-canvas SVG. */
export function composeLayers(layers: ComposeLayer[], size = DEFAULT_CANVAS): string {
  const visible = layers.filter((l) => !l.hidden);
  if (visible.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"></svg>`;
  }
  // Single untransformed layer → pass through verbatim (no behaviour change).
  if (visible.length === 1 && isIdentity(visible[0].transform)) {
    return visible[0].svg;
  }

  let groups = '';
  for (const layer of visible) {
    const vb = readViewBox(layer.svg) ?? { x: 0, y: 0, w: size, h: size };
    const t = layer.transform ?? IDENTITY_TRANSFORM;
    const { f, tx, ty } = composeTransform(vb, t, size);
    groups += `<g transform="translate(${tx} ${ty}) scale(${f})">${extractSvgInner(layer.svg)}</g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">${groups}</svg>`;
}
