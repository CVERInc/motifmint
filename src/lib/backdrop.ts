/**
 * Backdrop = an optional solid-color shape behind the traced output.
 * Useful when the SVG output is mostly light strokes that get lost on a
 * transparent / checkered background.
 *
 * No explicit on/off toggle — `alpha === 0` means "no visible backdrop".
 */
import { hexToRgb } from './color';

export type Aspect = 'original' | 'square';

export interface BackdropOpts {
  /** Hex color, 6 chars (#rrggbb). Alpha is tracked separately. */
  color: string;
  /** Alpha, 0–100. 0 = fully transparent (effectively off). */
  alpha: number;
  /** Corner radius, 0–50 (percent of min(width, height)). */
  radius: number;
  /** Padding around the content, 0–30 (percent of viewBox). */
  padding: number;
  /** Force a target aspect ratio for the output canvas. */
  aspect: Aspect;
}

export const DEFAULT_BACKDROP: BackdropOpts = {
  color: '#ffffff',
  alpha: 0,
  radius: 0,
  padding: 0,
  aspect: 'original',
};

/** True if the backdrop produces a visible fill. */
export function backdropVisible(b: BackdropOpts): boolean {
  return b.alpha > 0;
}

/** Convert color + alpha into a CSS rgba() string, or "transparent" if alpha=0. */
export function backdropCss(b: BackdropOpts): string {
  if (b.alpha === 0) return 'transparent';
  const rgb = hexToRgb(b.color);
  if (!rgb) return b.color;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${(b.alpha / 100).toFixed(3)})`;
}

/** 8-char hex (#rrggbbaa) form for embedding in SVG. */
export function backdropHex(b: BackdropOpts): string {
  const hex = b.color.replace('#', '');
  if (hex.length !== 6) return b.color;
  const aa = Math.round((b.alpha / 100) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${hex}${aa}`;
}

export function readViewBox(
  svg: string,
): { x: number; y: number; w: number; h: number } | null {
  const m = svg.match(/viewBox\s*=\s*"([^"]+)"/i);
  if (m) {
    const parts = m[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      return { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
    }
  }
  const wm = svg.match(/<svg[^>]*\swidth\s*=\s*"?(\d+(?:\.\d+)?)/i);
  const hm = svg.match(/<svg[^>]*\sheight\s*=\s*"?(\d+(?:\.\d+)?)/i);
  if (wm && hm) {
    return { x: 0, y: 0, w: Number(wm[1]), h: Number(hm[1]) };
  }
  return null;
}

export function bakeBackdrop(svg: string, opts: BackdropOpts): string {
  const visible = backdropVisible(opts);
  // Nothing to bake if backdrop is invisible AND aspect is unchanged.
  if (!visible && opts.aspect === 'original') return svg;

  const vb = readViewBox(svg);
  if (!vb) return svg;

  let x = vb.x;
  let y = vb.y;
  let w = vb.w;
  let h = vb.h;
  if (opts.aspect === 'square' && w !== h) {
    const side = Math.max(w, h);
    x -= (side - w) / 2;
    y -= (side - h) / 2;
    w = side;
    h = side;
  }

  const padPx = (opts.padding / 100) * Math.max(w, h);
  const newX = x - padPx;
  const newY = y - padPx;
  const newW = w + 2 * padPx;
  const newH = h + 2 * padPx;

  let out = svg;
  if (/viewBox\s*=/i.test(out)) {
    out = out.replace(
      /viewBox\s*=\s*"[^"]+"/i,
      `viewBox="${newX} ${newY} ${newW} ${newH}"`,
    );
  } else {
    out = out.replace(/<svg\b/i, `<svg viewBox="${newX} ${newY} ${newW} ${newH}"`);
  }

  out = out.replace(/<svg([^>]*)>/i, (_match, attrs) => {
    const cleaned = attrs
      .replace(/\swidth\s*=\s*"[^"]*"/i, '')
      .replace(/\sheight\s*=\s*"[^"]*"/i, '');
    return `<svg${cleaned}>`;
  });

  if (visible) {
    const rx = (opts.radius / 100) * Math.min(newW, newH);
    const fill = backdropHex(opts);
    const rect =
      `<rect x="${newX}" y="${newY}" width="${newW}" height="${newH}"` +
      (rx > 0 ? ` rx="${rx}" ry="${rx}"` : '') +
      ` fill="${fill}"/>`;
    out = out.replace(/<svg\b([^>]*)>/i, `<svg$1>${rect}`);
  }

  return out;
}
