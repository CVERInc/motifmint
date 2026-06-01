import { describe, expect, it } from 'vitest';
import { ASCII_RAMPS, imageToAscii, type AsciiOptions } from './ascii';

// Build a w×h RGBA buffer from a per-pixel callback.
function img(w: number, h: number, px: (x: number, y: number) => [number, number, number, number]) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = px(x, y);
      const i = (y * w + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  return data;
}

const square: AsciiOptions = { cols: 4, charAspect: 1 }; // 4×4 → 4 rows

describe('imageToAscii', () => {
  it('maps opaque black to the densest glyph', () => {
    const data = img(4, 4, () => [0, 0, 0, 255]);
    const out = imageToAscii(data, 4, 4, square);
    const lines = out.split('\n');
    expect(lines).toHaveLength(4);
    expect(lines.every((l) => l === '@@@@')).toBe(true); // last glyph of 'standard'
  });

  it('maps opaque white to spaces (right-trimmed away)', () => {
    const data = img(4, 4, () => [255, 255, 255, 255]);
    const out = imageToAscii(data, 4, 4, square);
    expect(out.replace(/\n/g, '')).toBe(''); // all blank
  });

  it('renders transparent pixels as spaces (silhouette)', () => {
    // left half black/opaque, right half transparent
    const data = img(4, 4, (x) => (x < 2 ? [0, 0, 0, 255] : [0, 0, 0, 0]));
    const lines = imageToAscii(data, 4, 4, square).split('\n');
    expect(lines.every((l) => l === '@@')).toBe(true); // right half trimmed
  });

  it('invert swaps light/dark', () => {
    const data = img(4, 4, () => [0, 0, 0, 255]);
    const out = imageToAscii(data, 4, 4, { ...square, invert: true });
    expect(out.replace(/\n/g, '')).toBe(''); // black → lightest glyph (space)
  });

  it('ignoreAlpha inks transparent pixels too', () => {
    const data = img(2, 2, () => [0, 0, 0, 0]);
    const out = imageToAscii(data, 2, 2, { cols: 2, charAspect: 1, ignoreAlpha: true });
    expect(out.includes('@')).toBe(true);
  });

  it('respects a custom ramp string', () => {
    const data = img(2, 2, () => [0, 0, 0, 255]);
    const out = imageToAscii(data, 2, 2, { cols: 2, charAspect: 1, ramp: 'AB' });
    expect(out.replace(/\n/g, '')).toBe('BBBB'); // densest of "AB"
  });

  it('downsamples a larger image to the requested cols', () => {
    const data = img(8, 8, () => [0, 0, 0, 255]);
    const lines = imageToAscii(data, 8, 8, { cols: 4, charAspect: 1 }).split('\n');
    expect(lines).toHaveLength(4);
    expect(lines[0]).toHaveLength(4);
  });

  it('exposes named ramps light→dark', () => {
    expect(ASCII_RAMPS.standard[0]).toBe(' ');
    expect(ASCII_RAMPS.standard.at(-1)).toBe('@');
    expect([...ASCII_RAMPS.blocks]).toHaveLength(5);
  });

  it('returns empty for degenerate dimensions', () => {
    expect(imageToAscii(new Uint8ClampedArray(0), 0, 0)).toBe('');
  });

  it("color: 'none' is byte-identical to the default", () => {
    const data = img(6, 6, (x, y) => [(x * 40) % 256, (y * 40) % 256, 60, 255]);
    const plain = imageToAscii(data, 6, 6, { cols: 6, charAspect: 1 });
    const none = imageToAscii(data, 6, 6, { cols: 6, charAspect: 1, color: 'none' });
    expect(none).toBe(plain);
  });

  it("color: 'html' wraps each ink glyph in a coloured span", () => {
    // Solid mid-grey so every cell inks to the same glyph and colour.
    const data = img(4, 4, () => [128, 64, 32, 255]);
    const out = imageToAscii(data, 4, 4, { ...square, color: 'html' });
    const lines = out.split('\n');
    expect(lines).toHaveLength(4);
    // 4 spans per row, each carrying the averaged colour.
    expect(lines[0].match(/<span style="color:#80(40|41)20">/g)?.length).toBe(4);
    expect(lines[0]).not.toContain('\n');
  });

  it("color: 'html' renders transparent cells as plain spaces (no span)", () => {
    // left half opaque, right half transparent → right trimmed away entirely.
    const data = img(4, 4, (x) => (x < 2 ? [0, 0, 0, 255] : [0, 0, 0, 0]));
    const out = imageToAscii(data, 4, 4, { ...square, color: 'html' });
    expect(out.split('\n').every((l) => (l.match(/<span/g) ?? []).length === 2)).toBe(true);
  });

  it("color: 'html' escapes glyphs that are HTML-special", () => {
    // 'detailed' ramp contains <, >, &, " — black maps to its densest glyph ($),
    // so force a mid value that lands on an escaped one via a custom ramp.
    const data = img(2, 2, () => [0, 0, 0, 255]);
    const out = imageToAscii(data, 2, 2, { cols: 2, charAspect: 1, ramp: 'a<', color: 'html' });
    expect(out).toContain('&lt;');
    expect(out).not.toMatch(/>\s*<\s*\//); // no raw "<" leaked as markup
  });

  it("color: 'ansi' emits 24-bit truecolor escapes and resets each line", () => {
    const data = img(2, 2, () => [200, 100, 50, 255]);
    const out = imageToAscii(data, 2, 2, { cols: 2, charAspect: 1, color: 'ansi' });
    const lines = out.split('\n');
    expect(lines).toHaveLength(2);
    // Foreground set once per run of same colour, then reset at line end.
    expect(lines[0]).toContain('\x1b[38;2;200;100;50m');
    expect(lines[0].endsWith('\x1b[0m')).toBe(true);
    // Same colour across the row → only one SGR code emitted.
    expect((lines[0].match(/\x1b\[38;2;/g) ?? []).length).toBe(1);
  });

  it("color: 'ansi' leaves a fully blank row empty (no stray reset)", () => {
    const data = img(2, 2, () => [255, 255, 255, 255]); // white → spaces
    const out = imageToAscii(data, 2, 2, { cols: 2, charAspect: 1, color: 'ansi' });
    expect(out.replace(/\n/g, '')).toBe('');
    expect(out).not.toContain('\x1b');
  });
});
