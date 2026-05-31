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
});
