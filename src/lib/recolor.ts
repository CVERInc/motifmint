/**
 * Per-color remap for traced SVGs. Lets the user retint a single color stop
 * (e.g. "all the black strokes") to a different color, without touching the
 * other layers.
 */

// Catches both `fill="..."` and `fill='...'`. The `(?<![-:\w])` lookbehind
// keeps us off look-alike attributes whose name merely ENDS in `fill`/`stroke`
// — `data-fill`, `xlink:fill`, `fill-opacity`'s sibling `*-fill` etc. — since a
// plain `\b` boundary treats `-` and `:` as word breaks and would mis-match.
const FILL_ATTR_RE = /(?<![-:\w])fill\s*=\s*(?:"([^"]+)"|'([^']+)')/gi;
const STROKE_ATTR_RE = /(?<![-:\w])stroke\s*=\s*(?:"([^"]+)"|'([^']+)')/gi;
// Catches `style="fill: ..."` and `style="stroke: ..."`
const STYLE_FILL_RE = /(?<![-\w])fill\s*:\s*([^;"'>\s]+)/gi;
const STYLE_STROKE_RE = /(?<![-\w])stroke\s*:\s*([^;"'>\s]+)/gi;

export type ColorRemap = Record<string, string>; // hex-lowercase -> hex

const NAMED_COLORS: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  lime: '#00ff00',
  blue: '#0000ff',
  yellow: '#ffff00',
  cyan: '#00ffff',
  aqua: '#00ffff',
  magenta: '#ff00ff',
  fuchsia: '#ff00ff',
  silver: '#c0c0c0',
  gray: '#808080',
  grey: '#808080',
  maroon: '#800000',
  olive: '#808000',
  green: '#008000',
  purple: '#800080',
  teal: '#008080',
  navy: '#000080',
  orange: '#ffa500',
  pink: '#ffc0cb',
  brown: '#a52a2a',
};

function isPaintable(c: string): boolean {
  if (!c) return false;
  const lc = c.trim().toLowerCase();
  return lc !== 'none' && lc !== 'transparent' && lc !== 'currentcolor' && !lc.startsWith('url(');
}

/**
 * Normalize any CSS color into a `#rrggbb` hex string (or return null if it
 * can't be normalized). Used so the swatch color picker can use the value
 * as its `value` attribute (which only accepts hex).
 */
export function normalizeToHex(c: string): string | null {
  const raw = c.trim().toLowerCase();
  if (NAMED_COLORS[raw]) return NAMED_COLORS[raw];
  // #rgb / #rgba — expand to #rrggbb (drop alpha)
  let m = raw.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])(?:[0-9a-f])?$/);
  if (m) return `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`;
  // #rrggbb / #rrggbbaa
  m = raw.match(/^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/);
  if (m) return `#${m[1]}`;
  // rgb(...) / rgba(...)
  m = raw.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  if (m) {
    const [, r, g, b] = m;
    const hex = (n: string) => Math.max(0, Math.min(255, +n)).toString(16).padStart(2, '0');
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  }
  return null;
}

/**
 * Extract all distinct paint colors used in `fill` / `stroke` attributes
 * and `style="fill:..."` / `style="stroke:..."` declarations.
 *
 * Returns each color as `{ raw, hex }` — `raw` is what appears in the SVG,
 * `hex` is the normalized form used as the remap key.
 */
export function extractColors(svg: string): { raw: string; hex: string }[] {
  const found = new Map<string, string>(); // hex -> first raw seen

  const push = (raw: string | undefined) => {
    if (!raw || !isPaintable(raw)) return;
    const hex = normalizeToHex(raw);
    if (!hex) return;
    if (!found.has(hex)) found.set(hex, raw);
  };

  // matchAll over the four sources
  for (const m of svg.matchAll(FILL_ATTR_RE)) push(m[1] ?? m[2]);
  for (const m of svg.matchAll(STROKE_ATTR_RE)) push(m[1] ?? m[2]);
  for (const m of svg.matchAll(STYLE_FILL_RE)) push(m[1]);
  for (const m of svg.matchAll(STYLE_STROKE_RE)) push(m[1]);

  return [...found.entries()].map(([hex, raw]) => ({ raw, hex }));
}

/**
 * Apply a hex-keyed color remap to an SVG string.
 */
export function applyRemap(svg: string, remap: ColorRemap): string {
  if (!remap || Object.keys(remap).length === 0) return svg;

  const swap = (raw: string | undefined): string | undefined => {
    if (!raw || !isPaintable(raw)) return undefined;
    const hex = normalizeToHex(raw);
    if (!hex) return undefined;
    return remap[hex];
  };

  let out = svg;
  out = out.replace(FILL_ATTR_RE, (match, dq, sq) => {
    const next = swap(dq ?? sq);
    return next ? `fill="${next}"` : match;
  });
  out = out.replace(STROKE_ATTR_RE, (match, dq, sq) => {
    const next = swap(dq ?? sq);
    return next ? `stroke="${next}"` : match;
  });
  out = out.replace(STYLE_FILL_RE, (match, val) => {
    const next = swap(val);
    return next ? `fill:${next}` : match;
  });
  out = out.replace(STYLE_STROKE_RE, (match, val) => {
    const next = swap(val);
    return next ? `stroke:${next}` : match;
  });
  return out;
}
