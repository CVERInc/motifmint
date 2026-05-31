/**
 * Render the composed mark to ASCII art — for CLI banners, README/HTML-comment
 * easter eggs, etc. Pure: it works from RGBA pixel data (the component supplies
 * it by rasterizing the result to a canvas), so it's fully unit-testable.
 *
 * Convention: ramps run light→dark (index 0 = least ink). A dark pixel maps to
 * the densest glyph; transparent pixels become spaces so a logo's silhouette
 * shows cleanly. `invert` swaps light/dark (e.g. for light-on-dark terminals).
 */

export const ASCII_RAMPS: Record<string, string> = {
  standard: ' .:-=+*#%@',
  blocks: ' ░▒▓█',
  detailed:
    " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
};

export interface AsciiOptions {
  /** Output width in characters. */
  cols?: number;
  /** Ramp name (key of ASCII_RAMPS) or a custom light→dark glyph string. */
  ramp?: string;
  /** Swap light/dark mapping. */
  invert?: boolean;
  /** Treat transparent pixels as ink instead of spaces. */
  ignoreAlpha?: boolean;
  /** Character cell aspect (height/width). Terminal glyphs are ~2× tall. */
  charAspect?: number;
}

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
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
  const charAspect = options.charAspect ?? 0.5;

  if (width <= 0 || height <= 0 || lastIdx < 0) return '';

  const rows = Math.max(1, Math.round((cols * (height / width)) * charAspect));

  const lines: string[] = [];
  for (let ry = 0; ry < rows; ry++) {
    const y0 = Math.floor((ry * height) / rows);
    const y1 = Math.max(y0 + 1, Math.floor(((ry + 1) * height) / rows));
    let line = '';
    for (let cx = 0; cx < cols; cx++) {
      const x0 = Math.floor((cx * width) / cols);
      const x1 = Math.max(x0 + 1, Math.floor(((cx + 1) * width) / cols));
      let lumSum = 0;
      let alphaSum = 0;
      let n = 0;
      for (let y = y0; y < y1 && y < height; y++) {
        for (let x = x0; x < x1 && x < width; x++) {
          const i = (y * width + x) * 4;
          lumSum += luminance(data[i], data[i + 1], data[i + 2]);
          alphaSum += data[i + 3];
          n++;
        }
      }
      const alpha = n ? alphaSum / n : 0;
      if (!ignoreAlpha && alpha < 128) {
        line += ' ';
        continue;
      }
      const lum = n ? lumSum / n : 255;
      const t = invert ? lum / 255 : 1 - lum / 255; // 0 = lightest glyph
      line += glyphs[Math.round(t * lastIdx)] ?? ' ';
    }
    lines.push(line.replace(/\s+$/, ''));
  }
  return lines.join('\n');
}
