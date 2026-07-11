import { hexToRgb } from './color';

function chebyshev(a: [number, number, number], b: [number, number, number]): number {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
}

/**
 * Cluster near-identical fill colors together. VTracer + canvas anti-aliasing
 * often produces a handful of near-black (or near-white) shades that
 * conceptually represent ONE color stop (e.g. `#020202`, `#040404`,
 * `#060606`, `#080808` for a single "black" logo).
 *
 * Each unique fill becomes a representative of its cluster (greedy nearest-
 * within-threshold assignment, first-seen wins). All paths sharing a cluster
 * are rewritten to use the same hex, so `extractColors` reports one swatch
 * per perceptual color.
 *
 * `threshold` is the max per-channel difference (0–255). 16 ≈ 6% — enough to
 * merge anti-aliased edges, narrow enough to keep distinct logo colors apart.
 */
export function mergeNearColors(svg: string, threshold: number = 16): string {
  const re = /\bfill\s*=\s*"(#[0-9a-fA-F]{6,8})"/g;
  const colors = new Set<string>();
  for (const m of svg.matchAll(re)) colors.add(m[1].toLowerCase());

  const repForColor: Record<string, string> = {};
  const reps: { hex: string; rgb: [number, number, number] }[] = [];
  for (const c of colors) {
    const pc = hexToRgb(c);
    if (!pc) {
      repForColor[c] = c;
      continue;
    }
    let bestRep: string | null = null;
    let bestDist = Infinity;
    for (const r of reps) {
      const d = chebyshev(pc, r.rgb);
      if (d <= threshold && d < bestDist) {
        bestRep = r.hex;
        bestDist = d;
      }
    }
    if (bestRep) {
      repForColor[c] = bestRep;
    } else {
      repForColor[c] = c;
      reps.push({ hex: c, rgb: pc });
    }
  }

  return svg.replace(re, (match, color: string) => {
    const r = repForColor[color.toLowerCase()];
    return r && r.toLowerCase() !== color.toLowerCase() ? `fill="${r}"` : match;
  });
}

/**
 * Add an explicit `fill="#000000"` to any `<path>` that has no fill
 * attribute. VTracer (and SVGO with `removeUselessStrokeAndFill`) omit
 * fills that match the SVG default (black), but our Recolor UI can only
 * remap colors that appear as explicit `fill` attributes. Normalizing
 * ensures the dominant "default black" layer shows up as a remappable
 * swatch.
 */
export function normalizeFills(svg: string): string {
  return svg.replace(/<path\b([^>]*?)(\/?)>/gi, (match, attrs, slash) => {
    if (/\bfill\s*=\s*["']/i.test(attrs)) return match;
    if (/\bstyle\s*=\s*["'][^"']*\bfill\s*:/i.test(attrs)) return match;
    // Insert before the closing — preserve self-closing vs open form.
    const space = attrs.endsWith(' ') || attrs === '' ? '' : ' ';
    return `<path${attrs}${space}fill="#000000"${slash}>`;
  });
}

/**
 * VTracer faithfully traces every pixel — including the solid background
 * we pre-composite onto transparent inputs to give it RGB contrast (see
 * `decode.ts`). That background ends up as a full-viewBox-sized path at the
 * top of the SVG, which then hides any backdrop we add later.
 *
 * This strips that artifact: a `<path>` whose `d` is exactly the bounding
 * box rectangle of the viewBox.
 */
export function stripBoundingBoxArtifact(svg: string): string {
  const vb = svg.match(/viewBox\s*=\s*"\s*0\s+0\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*"/i);
  if (!vb) return svg;
  const w = vb[1].replace('.', '\\.');
  const h = vb[2].replace('.', '\\.');
  // Matches <path ... d="M0 0h{W}v{H}H0z" ... /> in either attribute order.
  // Tolerant of optional spaces, upper/lowercase z, single or double quotes.
  const re = new RegExp(
    `<path\\b[^>]*\\bd\\s*=\\s*["']\\s*M\\s*0\\s+0\\s*[hH]\\s*${w}\\s*[vV]\\s*${h}\\s*[hH]\\s*0\\s*[zZ]?\\s*["'][^>]*\\/>\\s*`,
    'gi',
  );
  return svg.replace(re, '');
}
