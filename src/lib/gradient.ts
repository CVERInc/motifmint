/**
 * Per-color-group gradient fills for traced SVGs. A gradient is keyed by the
 * group's original fill hex; every path that originally had that color is
 * repainted with one shared `<linearGradient>`.
 *
 * The gradient uses `gradientUnits="userSpaceOnUse"` with coordinates spanning
 * the whole viewBox, so the colour ramp flows continuously across all the
 * (possibly disjoint) paths of a colour — giving one unified gradient for the
 * mark rather than a separate gradient boxed into each individual path.
 *
 * Applied client-side AFTER the worker's trace + optional SVGO pass, so SVGO
 * never sees these defs and can't mangle the gradient ids.
 */
import { readViewBox } from './backdrop';
import type { PathInfo } from './path-state';

export interface GradientStop {
  /** Hex color, `#rrggbb`. */
  color: string;
  /** Position along the ramp, 0–100. */
  offset: number;
}

export interface GradientSpec {
  /** Two or more colour stops. */
  stops: GradientStop[];
  /** Direction in degrees. 0 = left→right, 90 = top→bottom. (linear only) */
  angle: number;
  /** Gradient geometry. Defaults to linear for back-compat. */
  type?: 'linear' | 'radial';
}

/** Deterministic, SVG-safe gradient id from a colour key. */
export function gradId(colorKey: string): string {
  return 'mmg-' + colorKey.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Endpoint coordinates for a linear gradient at `angle` spanning `vb`. */
function angleCoords(angle: number, vb: Box) {
  const a = (angle * Math.PI) / 180;
  const cx = vb.x + vb.w / 2;
  const cy = vb.y + vb.h / 2;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    x1: round(cx - (dx * vb.w) / 2),
    y1: round(cy - (dy * vb.h) / 2),
    x2: round(cx + (dx * vb.w) / 2),
    y2: round(cy + (dy * vb.h) / 2),
  };
}

/**
 * Repaint every path whose `data-orig-idx` belongs to a gradient colour group
 * with `fill="url(#…)"`, and inject the matching `<linearGradient>` defs.
 *
 * `svg` must still carry `data-orig-idx` attributes (call before stripping
 * them). Gradients win over solid per-path overrides for the same path.
 */
export function applyColorGradients(
  svg: string,
  colorGradients: Map<string, GradientSpec>,
  pathList: PathInfo[],
): string {
  if (colorGradients.size === 0) return svg;
  const vb = readViewBox(svg) ?? { x: 0, y: 0, w: 100, h: 100 };

  // origIdx → gradient colour key
  const idxToKey = new Map<number, string>();
  for (const key of colorGradients.keys()) {
    for (const p of pathList) {
      if (p.originalFill === key) idxToKey.set(p.origIdx, key);
    }
  }
  if (idxToKey.size === 0) return svg;
  const usedKeys = new Set(idxToKey.values());

  // 1. Repaint matching paths.
  let out = svg.replace(/<path\b([^>]*?)(\/?)>/gi, (match, attrs: string, slash: string) => {
    const idxM = attrs.match(/\bdata-orig-idx\s*=\s*["'](\d+)["']/);
    if (!idxM) return match;
    const key = idxToKey.get(parseInt(idxM[1], 10));
    if (!key) return match;
    const url = `url(#${gradId(key)})`;
    if (/\bfill\s*=\s*["'][^"']*["']/i.test(attrs)) {
      return `<path${attrs.replace(/\bfill\s*=\s*["'][^"']*["']/i, `fill="${url}"`)}${slash}>`;
    }
    return `<path${attrs} fill="${url}"${slash}>`;
  });

  // 2. Build defs for the gradients that actually got used.
  const round = (n: number) => Math.round(n * 100) / 100;
  let defs = '<defs>';
  for (const [key, spec] of colorGradients) {
    if (!usedKeys.has(key)) continue;
    const stops = [...spec.stops]
      .sort((a, b) => a.offset - b.offset)
      .map((s) => `<stop offset="${s.offset}%" stop-color="${s.color}"/>`)
      .join('');
    if (spec.type === 'radial') {
      const cx = round(vb.x + vb.w / 2);
      const cy = round(vb.y + vb.h / 2);
      const r = round(Math.max(vb.w, vb.h) / 2);
      defs +=
        `<radialGradient id="${gradId(key)}" gradientUnits="userSpaceOnUse"` +
        ` cx="${cx}" cy="${cy}" r="${r}">${stops}</radialGradient>`;
    } else {
      const { x1, y1, x2, y2 } = angleCoords(spec.angle, vb);
      defs +=
        `<linearGradient id="${gradId(key)}" gradientUnits="userSpaceOnUse"` +
        ` x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient>`;
    }
  }
  defs += '</defs>';

  // 3. Inject defs right after the opening <svg …> tag.
  return out.replace(/(<svg\b[^>]*>)/i, `$1${defs}`);
}

/** A darker shade of a `#rrggbb` hex (factor 0–1; 0.6 ≈ 40% darker). */
export function shade(hex: string, factor: number): string {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return hex;
  const ch = (h: string) =>
    Math.max(0, Math.min(255, Math.round(parseInt(h, 16) * factor)))
      .toString(16)
      .padStart(2, '0');
  return `#${ch(m[1])}${ch(m[2])}${ch(m[3])}`;
}

/** Built-in gradient presets (the trailing "mono" uses the group's own colour). */
export const GRADIENT_PRESETS: { name: string; a: string; b: string; angle: number }[] = [
  { name: 'Sunset', a: '#ff6a00', b: '#ee0979', angle: 90 },
  { name: 'Ocean', a: '#2193b0', b: '#6dd5ed', angle: 90 },
  { name: 'Grape', a: '#8e2de2', b: '#4a00e0', angle: 135 },
  { name: 'Citrus', a: '#f9d423', b: '#ff4e50', angle: 120 },
];
