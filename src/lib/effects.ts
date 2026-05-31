/**
 * SVG-native finishing effects for the composed mark: a silhouette outline, a
 * soft drop shadow, and a glow. All implemented with one `<filter>` (no raster,
 * no extra deps) so they stay crisp and tiny, and applied as a wrapping group.
 *
 * Pure string generation — fully unit-testable. Lengths are in user (viewBox)
 * units; the component scales them from the viewBox before calling in.
 */

export interface OutlineEffect {
  width: number; // dilation radius, user units
  color: string;
}
export interface ShadowEffect {
  blur: number;
  dx: number;
  dy: number;
  color: string;
  opacity: number; // 0–1
}
export interface GlowEffect {
  blur: number;
  color: string;
  opacity: number; // 0–1
}

export interface EffectOptions {
  outline?: OutlineEffect;
  shadow?: ShadowEffect;
  glow?: GlowEffect;
}

export const EFFECT_FILTER_ID = 'mm-fx';

/** True if any effect is actually active (non-zero). */
export function hasEffects(o: EffectOptions): boolean {
  return Boolean(
    (o.outline && o.outline.width > 0) ||
      (o.shadow && o.shadow.opacity > 0 && (o.shadow.blur > 0 || o.shadow.dx !== 0 || o.shadow.dy !== 0)) ||
      (o.glow && o.glow.opacity > 0 && o.glow.blur > 0),
  );
}

/**
 * Build the `<filter>` element. Layers (bottom→top): shadow, glow, outline,
 * then the original graphic on top. Returns '' when nothing is active.
 */
export function buildEffectFilter(o: EffectOptions, id = EFFECT_FILTER_ID): string {
  if (!hasEffects(o)) return '';
  let prims = '';
  const merge: string[] = [];

  if (o.shadow && o.shadow.opacity > 0) {
    prims +=
      `<feGaussianBlur in="SourceAlpha" stdDeviation="${o.shadow.blur}" result="sb"/>` +
      `<feOffset in="sb" dx="${o.shadow.dx}" dy="${o.shadow.dy}" result="so"/>` +
      `<feFlood flood-color="${o.shadow.color}" flood-opacity="${o.shadow.opacity}" result="sc"/>` +
      `<feComposite in="sc" in2="so" operator="in" result="shadow"/>`;
    merge.push('shadow');
  }
  if (o.glow && o.glow.opacity > 0 && o.glow.blur > 0) {
    prims +=
      `<feGaussianBlur in="SourceAlpha" stdDeviation="${o.glow.blur}" result="gb"/>` +
      `<feFlood flood-color="${o.glow.color}" flood-opacity="${o.glow.opacity}" result="gc"/>` +
      `<feComposite in="gc" in2="gb" operator="in" result="glow"/>`;
    merge.push('glow');
  }
  if (o.outline && o.outline.width > 0) {
    prims +=
      `<feMorphology in="SourceAlpha" operator="dilate" radius="${o.outline.width}" result="dil"/>` +
      `<feFlood flood-color="${o.outline.color}" result="oc"/>` +
      `<feComposite in="oc" in2="dil" operator="in" result="outline"/>`;
    merge.push('outline');
  }
  merge.push('SourceGraphic');

  const mergeNodes = merge.map((m) => `<feMergeNode in="${m}"/>`).join('');
  // Generous region so shadow/glow/outline don't clip at the viewBox edge.
  return (
    `<filter id="${id}" x="-25%" y="-25%" width="150%" height="150%">` +
    prims +
    `<feMerge>${mergeNodes}</feMerge>` +
    `</filter>`
  );
}

/**
 * Wrap the SVG body in a filtered group and inject the filter def. Returns the
 * SVG unchanged when no effect is active.
 */
export function applyEffects(svg: string, o: EffectOptions, id = EFFECT_FILTER_ID): string {
  const filter = buildEffectFilter(o, id);
  if (!filter) return svg;
  const open = svg.match(/<svg\b[^>]*>/i);
  if (!open) return svg;
  const start = (open.index ?? 0) + open[0].length;
  const end = svg.lastIndexOf('</svg>');
  if (end === -1) return svg;
  const head = svg.slice(0, start);
  const body = svg.slice(start, end);
  const tail = svg.slice(end);
  return `${head}<defs>${filter}</defs><g filter="url(#${id})">${body}</g>${tail}`;
}
