/**
 * Render the composed mark to ASCII art — for CLI banners, README/HTML-comment
 * easter eggs, etc. Pure: it works from RGBA pixel data (the component supplies
 * it by rasterizing the result to a canvas), so it's fully unit-testable.
 *
 * Convention: ramps run light→dark (index 0 = least ink). A dark pixel maps to
 * the densest glyph; transparent pixels become spaces so a logo's silhouette
 * shows cleanly. `invert` swaps light/dark (e.g. for light-on-dark terminals).
 *
 * Colour: each cell also carries the average RGB of its source pixels. Plain
 * text can't hold colour (that's what keeps it paste-able into a README), so
 * `color` picks a carrier instead:
 *   'none' — plain text, exactly the monochrome output (the default).
 *   'html' — each glyph wrapped in <span style="color:#rgb">, for the web.
 *   'ansi' — 24-bit truecolor escapes, for a terminal banner (e.g. a CLI
 *            startup screen). Each line is reset with \x1b[0m.
 */

/**
 * Canonical terminal character-cell aspect (cell width ÷ height). A monospace
 * terminal cell is ~2× tall as wide, so ≈0.5. Generating ASCII against this
 * fixed value keeps the art correctly proportioned when `cat` into a real
 * terminal — and lets a web preview be a faithful WYSIWYG of the CLI by
 * displaying its cells at the same aspect (via line-height), rather than at the
 * browser font's own (taller-looking) ~0.6 cell.
 */
export const TERMINAL_CELL_ASPECT = 0.5;

export const ASCII_RAMPS: Record<string, string> = {
  standard: ' .:-=+*#%@',
  blocks: ' ░▒▓█',
  detailed: ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$',
};

export type AsciiColor = 'none' | 'html' | 'ansi';

/**
 * How a cell is filled:
 *   'ramp'      — one density glyph per cell (the classic look; uses `ramp`).
 *   'braille'   — 2×4 dot matrix per cell (U+2800…), 8× the resolution. Smoothest
 *                 for high-contrast marks: curves read as curves, not stair-steps.
 *   'halfblock' — split each cell top/bottom (1×2). Mono picks ▀▄█; with colour
 *                 it's ▀ carrying the top colour as foreground and the bottom as
 *                 background — double the vertical detail *and* two colours/cell.
 *   'edge'      — Sobel edge detect, then draw the contour with direction glyphs
 *                 (─ │ ╱ ╲) and leave flats blank. A hand-drawn outline, not a
 *                 fill. Shines on vector input — the raster is crisp, so the
 *                 gradient angles (and thus the strokes) are clean.
 */
export type AsciiMode = 'ramp' | 'braille' | 'halfblock' | 'edge';

export interface AsciiOptions {
  /** Output width in characters. */
  cols?: number;
  /** Fill method. Defaults to 'ramp' (the original density-glyph renderer). */
  mode?: AsciiMode;
  /** Ramp name (key of ASCII_RAMPS) or a custom light→dark glyph string. */
  ramp?: string;
  /** Swap light/dark mapping (and which side counts as ink in the binary modes). */
  invert?: boolean;
  /** Edge mode: gradient magnitude (0–1) a cell must exceed to draw a stroke. */
  edgeThreshold?: number;
  /** Treat transparent pixels as ink instead of spaces. */
  ignoreAlpha?: boolean;
  /** Character cell aspect (cell width ÷ height). Terminal glyphs are ~2× tall,
   *  so ≈0.5 (the default, {@link TERMINAL_CELL_ASPECT}). */
  charAspect?: number;
  /** Colour carrier for the output. Defaults to 'none' (plain text). */
  color?: AsciiColor;
}

/** One rendered cell: its glyph plus the average colour of its source pixels.
 *  `bg` carries a second colour for glyphs that paint two regions (the half-block
 *  `▀`, whose foreground fills the top sub-row and background the bottom) — null
 *  for the common single-colour case. */
interface Cell {
  ch: string;
  r: number;
  g: number;
  b: number;
  bg?: { r: number; g: number; b: number } | null;
}

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function clamp8(n: number): number {
  return n < 0 ? 0 : n > 255 ? 255 : Math.round(n);
}

function toHex(r: number, g: number, b: number): string {
  const h = (n: number) => clamp8(n).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function escapeHtml(ch: string): string {
  switch (ch) {
    case '&':
      return '&amp;';
    case '<':
      return '&lt;';
    case '>':
      return '&gt;';
    case '"':
      return '&quot;';
    default:
      return ch;
  }
}

/** Trim trailing blank cells so a logo's silhouette doesn't carry dead space. */
function trimRow(cells: Cell[]): Cell[] {
  let end = cells.length;
  while (end > 0 && cells[end - 1].ch === ' ') end--;
  return end === cells.length ? cells : cells.slice(0, end);
}

function serializePlain(rows: Cell[][]): string {
  return rows
    .map((row) =>
      trimRow(row)
        .map((c) => c.ch)
        .join(''),
    )
    .join('\n');
}

function serializeHtml(rows: Cell[][]): string {
  return rows
    .map((row) =>
      trimRow(row)
        .map((c) => {
          if (c.ch === ' ') return ' ';
          const style = c.bg
            ? `color:${toHex(c.r, c.g, c.b)};background:${toHex(c.bg.r, c.bg.g, c.bg.b)}`
            : `color:${toHex(c.r, c.g, c.b)}`;
          return `<span style="${style}">${escapeHtml(c.ch)}</span>`;
        })
        .join(''),
    )
    .join('\n');
}

function serializeAnsi(rows: Cell[][]): string {
  const RESET = '\x1b[0m';
  return rows
    .map((row) => {
      const cells = trimRow(row);
      let out = '';
      let curFg = ''; // current 38;2 foreground code in effect
      let curBg = ''; // current 48;2 background code in effect ('' = none)
      for (const c of cells) {
        if (c.ch === ' ') {
          // A space must show no ink — clear any background still in effect so it
          // doesn't paint a coloured block (half-block leaves bg set otherwise).
          if (curFg || curBg) {
            out += RESET;
            curFg = curBg = '';
          }
          out += ' ';
          continue;
        }
        const fg = `\x1b[38;2;${clamp8(c.r)};${clamp8(c.g)};${clamp8(c.b)}m`;
        if (fg !== curFg) {
          out += fg;
          curFg = fg;
        }
        const bg = c.bg ? `\x1b[48;2;${clamp8(c.bg.r)};${clamp8(c.bg.g)};${clamp8(c.bg.b)}m` : '';
        if (bg !== curBg) {
          out += bg || '\x1b[49m'; // 49 = default background (clears a prior bg)
          curBg = bg;
        }
        out += c.ch;
      }
      return curFg || curBg ? out + RESET : out;
    })
    .join('\n');
}

type Pixels = Uint8ClampedArray | Uint8Array | number[];

/** The source-pixel span [lo, hi) that output index `i` of `count` maps to over
 *  `total` source pixels — at least one pixel wide so nothing is skipped. */
function span(i: number, count: number, total: number): [number, number] {
  const lo = Math.floor((i * total) / count);
  const hi = Math.max(lo + 1, Math.floor(((i + 1) * total) / count));
  return [lo, hi];
}

interface RegionAvg {
  lum: number;
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Mean luminance / colour / alpha over a source rectangle (clamped to bounds). */
function avgRegion(
  data: Pixels,
  width: number,
  height: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
): RegionAvg {
  let lum = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  let n = 0;
  for (let y = y0; y < y1 && y < height; y++) {
    for (let x = x0; x < x1 && x < width; x++) {
      const i = (y * width + x) * 4;
      const R = data[i];
      const G = data[i + 1];
      const B = data[i + 2];
      lum += luminance(R, G, B);
      r += R;
      g += G;
      b += B;
      a += data[i + 3];
      n++;
    }
  }
  return n
    ? { lum: lum / n, r: r / n, g: g / n, b: b / n, a: a / n }
    : { lum: 255, r: 0, g: 0, b: 0, a: 0 };
}

/** Binary ink test for the sub-cell modes: opaque enough, and on the dark side
 *  of mid-grey (or the light side when inverted). */
function isInk(region: RegionAvg, ignoreAlpha: boolean, invert: boolean): boolean {
  if (!ignoreAlpha && region.a < 128) return false;
  return invert ? region.lum >= 128 : region.lum < 128;
}

// Braille dot → bit value, indexed [rowInCell 0–3][colInCell 0–1] (U+2800 base).
const BRAILLE_BITS = [
  [0x01, 0x08],
  [0x02, 0x10],
  [0x04, 0x20],
  [0x40, 0x80],
];

/** 2×4 dot matrix per cell — each char packs 8 thresholded sub-samples. */
function brailleGrid(
  data: Pixels,
  width: number,
  height: number,
  cols: number,
  rows: number,
  ignoreAlpha: boolean,
  invert: boolean,
): Cell[][] {
  const grid: Cell[][] = [];
  for (let ry = 0; ry < rows; ry++) {
    const row: Cell[] = [];
    for (let cx = 0; cx < cols; cx++) {
      let bits = 0;
      let rs = 0;
      let gs = 0;
      let bs = 0;
      let cnt = 0;
      for (let dy = 0; dy < 4; dy++) {
        const [y0, y1] = span(ry * 4 + dy, rows * 4, height);
        for (let dx = 0; dx < 2; dx++) {
          const [x0, x1] = span(cx * 2 + dx, cols * 2, width);
          const a = avgRegion(data, width, height, x0, x1, y0, y1);
          if (isInk(a, ignoreAlpha, invert)) {
            bits |= BRAILLE_BITS[dy][dx];
            rs += a.r;
            gs += a.g;
            bs += a.b;
            cnt++;
          }
        }
      }
      if (!bits) row.push({ ch: ' ', r: 0, g: 0, b: 0 });
      else
        row.push({
          ch: String.fromCodePoint(0x2800 + bits),
          r: rs / cnt,
          g: gs / cnt,
          b: bs / cnt,
        });
    }
    grid.push(row);
  }
  return grid;
}

/** Split each cell top/bottom. Mono → ▀▄█; coloured → ▀ with the top colour as
 *  foreground and the bottom as background (two colours, double vertical detail). */
function halfblockGrid(
  data: Pixels,
  width: number,
  height: number,
  cols: number,
  rows: number,
  ignoreAlpha: boolean,
  invert: boolean,
  coloured: boolean,
): Cell[][] {
  const grid: Cell[][] = [];
  for (let ry = 0; ry < rows; ry++) {
    const [y0, y1] = span(ry, rows, height);
    const ymid = Math.min(y1, Math.max(y0 + 1, y0 + Math.floor((y1 - y0) / 2)));
    const row: Cell[] = [];
    for (let cx = 0; cx < cols; cx++) {
      const [x0, x1] = span(cx, cols, width);
      const top = avgRegion(data, width, height, x0, x1, y0, ymid);
      const bot = avgRegion(data, width, height, x0, x1, ymid, y1);
      const ti = isInk(top, ignoreAlpha, invert);
      const bi = isInk(bot, ignoreAlpha, invert);
      if (!ti && !bi) {
        row.push({ ch: ' ', r: 0, g: 0, b: 0 });
      } else if (coloured) {
        if (ti && bi)
          row.push({ ch: '▀', r: top.r, g: top.g, b: top.b, bg: { r: bot.r, g: bot.g, b: bot.b } });
        else if (ti) row.push({ ch: '▀', r: top.r, g: top.g, b: top.b, bg: null });
        else row.push({ ch: '▄', r: bot.r, g: bot.g, b: bot.b, bg: null });
      } else {
        const ch = ti && bi ? '█' : ti ? '▀' : '▄';
        const src = ti ? top : bot;
        row.push({ ch, r: src.r, g: src.g, b: src.b });
      }
    }
    grid.push(row);
  }
  return grid;
}

// Edge-tangent glyph by 45°-quantised orientation (0=horizontal … 2=vertical).
const EDGE_GLYPHS = ['─', '╲', '│', '╱'];

/** Sobel edge detect on a per-cell ink field, then stroke the contour with a
 *  direction glyph. Flats fall below threshold and stay blank → a clean outline. */
function edgeGrid(
  data: Pixels,
  width: number,
  height: number,
  cols: number,
  rows: number,
  ignoreAlpha: boolean,
  invert: boolean,
  threshold: number,
): Cell[][] {
  // Per-cell ink intensity (0–1) and colour.
  const field: number[][] = [];
  const colour: RegionAvg[][] = [];
  for (let ry = 0; ry < rows; ry++) {
    const [y0, y1] = span(ry, rows, height);
    const frow: number[] = [];
    const crow: RegionAvg[] = [];
    for (let cx = 0; cx < cols; cx++) {
      const [x0, x1] = span(cx, cols, width);
      const a = avgRegion(data, width, height, x0, x1, y0, y1);
      const ink = !ignoreAlpha && a.a < 128 ? 0 : invert ? a.lum / 255 : 1 - a.lum / 255;
      frow.push(ink);
      crow.push(a);
    }
    field.push(frow);
    colour.push(crow);
  }

  const at = (y: number, x: number) =>
    field[Math.max(0, Math.min(rows - 1, y))][Math.max(0, Math.min(cols - 1, x))];

  const grid: Cell[][] = [];
  for (let ry = 0; ry < rows; ry++) {
    const row: Cell[] = [];
    for (let cx = 0; cx < cols; cx++) {
      const gx =
        at(ry - 1, cx + 1) +
        2 * at(ry, cx + 1) +
        at(ry + 1, cx + 1) -
        (at(ry - 1, cx - 1) + 2 * at(ry, cx - 1) + at(ry + 1, cx - 1));
      const gy =
        at(ry + 1, cx - 1) +
        2 * at(ry + 1, cx) +
        at(ry + 1, cx + 1) -
        (at(ry - 1, cx - 1) + 2 * at(ry - 1, cx) + at(ry - 1, cx + 1));
      const mag = Math.hypot(gx, gy) / 4; // kernel sums to ±4 at full contrast
      if (mag < threshold) {
        row.push({ ch: ' ', r: 0, g: 0, b: 0 });
        continue;
      }
      // Edge runs perpendicular to the gradient; fold to [0,π) and snap to 45°.
      const o = (((Math.atan2(gy, gx) + Math.PI / 2) % Math.PI) + Math.PI) % Math.PI;
      const ch = EDGE_GLYPHS[Math.round(o / (Math.PI / 4)) % 4];
      const c = colour[ry][cx];
      row.push({ ch, r: c.r, g: c.g, b: c.b });
    }
    grid.push(row);
  }
  return grid;
}

/**
 * Convert RGBA pixel data to ASCII. `data` is length `width*height*4`.
 * Lines are right-trimmed; rows are joined with "\n".
 */
export function imageToAscii(
  data: Uint8ClampedArray | Uint8Array | number[],
  width: number,
  height: number,
  options: AsciiOptions = {},
): string {
  const cols = Math.max(1, Math.floor(options.cols ?? 100));
  const mode = options.mode ?? 'ramp';
  const ramp = ASCII_RAMPS[options.ramp ?? 'standard'] ?? options.ramp ?? ASCII_RAMPS.standard;
  const glyphs = [...ramp]; // spread so multi-byte block chars count as one
  const lastIdx = glyphs.length - 1;
  const invert = options.invert ?? false;
  const ignoreAlpha = options.ignoreAlpha ?? false;
  const charAspect = options.charAspect ?? TERMINAL_CELL_ASPECT;
  const color = options.color ?? 'none';
  const edgeThreshold = options.edgeThreshold ?? 0.5;

  if (width <= 0 || height <= 0 || lastIdx < 0) return '';

  const rows = Math.max(1, Math.round(cols * (height / width) * charAspect));

  let grid: Cell[][];
  if (mode === 'braille') {
    grid = brailleGrid(data, width, height, cols, rows, ignoreAlpha, invert);
  } else if (mode === 'halfblock') {
    grid = halfblockGrid(data, width, height, cols, rows, ignoreAlpha, invert, color !== 'none');
  } else if (mode === 'edge') {
    grid = edgeGrid(data, width, height, cols, rows, ignoreAlpha, invert, edgeThreshold);
  } else {
    grid = [];
    for (let ry = 0; ry < rows; ry++) {
      const y0 = Math.floor((ry * height) / rows);
      const y1 = Math.max(y0 + 1, Math.floor(((ry + 1) * height) / rows));
      const row: Cell[] = [];
      for (let cx = 0; cx < cols; cx++) {
        const x0 = Math.floor((cx * width) / cols);
        const x1 = Math.max(x0 + 1, Math.floor(((cx + 1) * width) / cols));
        let lumSum = 0;
        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        let alphaSum = 0;
        let n = 0;
        for (let y = y0; y < y1 && y < height; y++) {
          for (let x = x0; x < x1 && x < width; x++) {
            const i = (y * width + x) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            lumSum += luminance(r, g, b);
            rSum += r;
            gSum += g;
            bSum += b;
            alphaSum += data[i + 3];
            n++;
          }
        }
        const alpha = n ? alphaSum / n : 0;
        if (!ignoreAlpha && alpha < 128) {
          row.push({ ch: ' ', r: 0, g: 0, b: 0 });
          continue;
        }
        const lum = n ? lumSum / n : 255;
        const t = invert ? lum / 255 : 1 - lum / 255; // 0 = lightest glyph
        const ch = glyphs[Math.round(t * lastIdx)] ?? ' ';
        row.push({ ch, r: n ? rSum / n : 0, g: n ? gSum / n : 0, b: n ? bSum / n : 0 });
      }
      grid.push(row);
    }
  }

  if (color === 'html') return serializeHtml(grid);
  if (color === 'ansi') return serializeAnsi(grid);
  return serializePlain(grid);
}

// ── Vector-stroke renderer ──────────────────────────────────────────────────
//
// The `edge` mode above *guesses* contours by running Sobel on a rasterised
// mark. When you have the real vector — as an icon studio does — you can do
// better: sample the actual path geometry and draw the centreline as a
// connected line. Each cell's glyph is chosen by which neighbouring cells the
// line also passes through (box-drawing connectivity), so turns become real
// corners (rounded ╭╮╯╰) and diagonals become smooth rounded staircases rather
// than a field of ╱╲ that never quite join up.
//
// This half is pure: it takes polylines already projected into grid space
// (x∈[0,cols], y∈[0,rows]) and returns the same Cell[][] the serializers eat.
// The browser-only part — turning an <svg>'s paths into those polylines via
// getPointAtLength — lives in the component, thin and untested by design.

/** One sampled point along a path, in grid space. Optional colour is the source
 *  stroke/fill at that point; cells average the points that fall in them. */
export interface StrokePoint {
  x: number;
  y: number;
  r?: number;
  g?: number;
  b?: number;
}

export interface StrokeOptions {
  cols: number;
  rows: number;
  /** Colour carrier, as in {@link AsciiOptions}. Defaults to 'none'. */
  color?: AsciiColor;
  /** Rounded corners (╭╮╯╰) vs sharp (┌┐└┘). Defaults to true. */
  rounded?: boolean;
  /** Colour for points (and the whole stroke in mono) that carry none. */
  strokeColor?: { r: number; g: number; b: number };
}

// Connectivity bits: which orthogonal neighbour a cell's line links to.
const DIR_U = 1;
const DIR_D = 2;
const DIR_L = 4;
const DIR_R = 8;

/** Box-drawing glyph for a connectivity mask. */
function strokeGlyph(mask: number, rounded: boolean): string {
  switch (mask) {
    case DIR_L | DIR_R:
      return '─';
    case DIR_U | DIR_D:
      return '│';
    case DIR_D | DIR_R:
      return rounded ? '╭' : '┌';
    case DIR_D | DIR_L:
      return rounded ? '╮' : '┐';
    case DIR_U | DIR_R:
      return rounded ? '╰' : '└';
    case DIR_U | DIR_L:
      return rounded ? '╯' : '┘';
    case DIR_U | DIR_D | DIR_R:
      return '├';
    case DIR_U | DIR_D | DIR_L:
      return '┤';
    case DIR_L | DIR_R | DIR_D:
      return '┬';
    case DIR_L | DIR_R | DIR_U:
      return '┴';
    case DIR_U | DIR_D | DIR_L | DIR_R:
      return '┼';
    case DIR_U:
      return '╵';
    case DIR_D:
      return '╷';
    case DIR_L:
      return '╴';
    case DIR_R:
      return '╶';
    default:
      return '·'; // isolated occupied cell (a lone sample)
  }
}

/**
 * Rasterise vector polylines (grid space) to ASCII line art via box-drawing
 * connectivity. Returns the serialized string for the chosen colour carrier.
 */
export function strokeToAscii(polylines: StrokePoint[][], options: StrokeOptions): string {
  const cols = Math.max(1, Math.floor(options.cols));
  const rows = Math.max(1, Math.floor(options.rows));
  const rounded = options.rounded ?? true;
  const color = options.color ?? 'none';
  const stroke = options.strokeColor ?? { r: 0, g: 0, b: 0 };

  const n = cols * rows;
  const mask = new Int32Array(n);
  const occupied = new Uint8Array(n);
  const rAcc = new Float64Array(n);
  const gAcc = new Float64Array(n);
  const bAcc = new Float64Array(n);
  const cnt = new Int32Array(n);
  const idx = (cx: number, cy: number) => cy * cols + cx;
  const inB = (cx: number, cy: number) => cx >= 0 && cx < cols && cy >= 0 && cy < rows;

  // Record that two orthogonally-adjacent cells are joined by the line.
  const link = (ax: number, ay: number, bx: number, by: number) => {
    const dx = bx - ax;
    const dy = by - ay;
    if (Math.abs(dx) + Math.abs(dy) !== 1) return; // only orthogonal neighbours
    const aBit = dx === 1 ? DIR_R : dx === -1 ? DIR_L : dy === 1 ? DIR_D : DIR_U;
    const bBit = dx === 1 ? DIR_L : dx === -1 ? DIR_R : dy === 1 ? DIR_U : DIR_D;
    if (inB(ax, ay)) mask[idx(ax, ay)] |= aBit;
    if (inB(bx, by)) mask[idx(bx, by)] |= bBit;
  };

  // Walk cell→cell orthogonally; diagonals become an L (staircase) so corners form.
  const connect = (ax: number, ay: number, bx: number, by: number) => {
    let x = ax;
    let y = ay;
    let guard = 0;
    while ((x !== bx || y !== by) && guard++ < 4 * (cols + rows)) {
      const sx = Math.sign(bx - x);
      const sy = Math.sign(by - y);
      if (sx !== 0) {
        link(x, y, x + sx, y); // step horizontally first
        x += sx;
      } else if (sy !== 0) {
        link(x, y, x, y + sy);
        y += sy;
      }
    }
  };

  for (const pl of polylines) {
    let pcx: number | null = null;
    let pcy = 0;
    for (const p of pl) {
      const cx = Math.floor(p.x);
      const cy = Math.floor(p.y);
      if (inB(cx, cy)) {
        const i = idx(cx, cy);
        occupied[i] = 1;
        rAcc[i] += p.r ?? stroke.r;
        gAcc[i] += p.g ?? stroke.g;
        bAcc[i] += p.b ?? stroke.b;
        cnt[i]++;
      }
      if (pcx !== null && (cx !== pcx || cy !== pcy)) connect(pcx, pcy, cx, cy);
      pcx = cx;
      pcy = cy;
    }
  }

  const grid: Cell[][] = [];
  for (let cy = 0; cy < rows; cy++) {
    const row: Cell[] = [];
    for (let cx = 0; cx < cols; cx++) {
      const i = idx(cx, cy);
      if (!occupied[i] && mask[i] === 0) {
        row.push({ ch: ' ', r: 0, g: 0, b: 0 });
        continue;
      }
      const ch = strokeGlyph(mask[i], rounded);
      const c = cnt[i];
      row.push({
        ch,
        r: c ? rAcc[i] / c : stroke.r,
        g: c ? gAcc[i] / c : stroke.g,
        b: c ? bAcc[i] / c : stroke.b,
      });
    }
    grid.push(row);
  }

  if (color === 'html') return serializeHtml(grid);
  if (color === 'ansi') return serializeAnsi(grid);
  return serializePlain(grid);
}
