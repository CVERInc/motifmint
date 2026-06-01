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

export interface AsciiOptions {
  /** Output width in characters. */
  cols?: number;
  /** Ramp name (key of ASCII_RAMPS) or a custom light→dark glyph string. */
  ramp?: string;
  /** Swap light/dark mapping. */
  invert?: boolean;
  /** Treat transparent pixels as ink instead of spaces. */
  ignoreAlpha?: boolean;
  /** Character cell aspect (cell width ÷ height). Terminal glyphs are ~2× tall,
   *  so ≈0.5 (the default, {@link TERMINAL_CELL_ASPECT}). */
  charAspect?: number;
  /** Colour carrier for the output. Defaults to 'none' (plain text). */
  color?: AsciiColor;
}

/** One rendered cell: its glyph plus the average colour of its source pixels. */
interface Cell {
  ch: string;
  r: number;
  g: number;
  b: number;
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
        .map((c) =>
          c.ch === ' '
            ? ' '
            : `<span style="color:${toHex(c.r, c.g, c.b)}">${escapeHtml(c.ch)}</span>`,
        )
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
      let cur = ''; // current SGR colour code in effect
      for (const c of cells) {
        if (c.ch === ' ') {
          out += ' '; // spaces need no colour
          continue;
        }
        const code = `\x1b[38;2;${clamp8(c.r)};${clamp8(c.g)};${clamp8(c.b)}m`;
        if (code !== cur) {
          out += code;
          cur = code;
        }
        out += c.ch;
      }
      return cur ? out + RESET : out;
    })
    .join('\n');
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
  const ramp = ASCII_RAMPS[options.ramp ?? 'standard'] ?? options.ramp ?? ASCII_RAMPS.standard;
  const glyphs = [...ramp]; // spread so multi-byte block chars count as one
  const lastIdx = glyphs.length - 1;
  const invert = options.invert ?? false;
  const ignoreAlpha = options.ignoreAlpha ?? false;
  const charAspect = options.charAspect ?? TERMINAL_CELL_ASPECT;
  const color = options.color ?? 'none';

  if (width <= 0 || height <= 0 || lastIdx < 0) return '';

  const rows = Math.max(1, Math.round(cols * (height / width) * charAspect));

  const grid: Cell[][] = [];
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

  if (color === 'html') return serializeHtml(grid);
  if (color === 'ansi') return serializeAnsi(grid);
  return serializePlain(grid);
}
