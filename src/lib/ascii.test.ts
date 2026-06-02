import { describe, expect, it } from 'vitest';
import {
  ASCII_RAMPS,
  imageToAscii,
  strokeToAscii,
  type AsciiOptions,
  type StrokePoint,
} from './ascii';

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

describe('mode: braille', () => {
  // A solid black cell → all 8 dots set → the full braille block U+28FF (⣿).
  it('packs 8 sub-samples; a solid cell is the full block ⣿', () => {
    const data = img(8, 8, () => [0, 0, 0, 255]);
    const out = imageToAscii(data, 8, 8, { cols: 2, charAspect: 1, mode: 'braille' });
    expect([...out].every((c) => c === '⣿' || c === '\n')).toBe(true);
  });

  it('an empty (white) image is all spaces, trimmed away', () => {
    const data = img(8, 8, () => [255, 255, 255, 255]);
    const out = imageToAscii(data, 8, 8, { cols: 2, charAspect: 1, mode: 'braille' });
    expect(out.replace(/\n/g, '')).toBe('');
  });

  it('resolves sub-cell detail a ramp cell would average away', () => {
    // Left dot-column of each cell black, right white → only left dots fire.
    // One braille cell spans 2 source px wide, so x<1 within each pair is "left".
    const data = img(4, 4, (x) => (x % 2 === 0 ? [0, 0, 0, 255] : [255, 255, 255, 255]));
    const out = imageToAscii(data, 4, 4, { cols: 2, charAspect: 1, mode: 'braille' });
    // Left dots only = bits 0x01|0x02|0x04|0x40 = 0x47 → U+2847 (⡇).
    expect(out.split('\n')[0][0]).toBe('⡇');
  });

  it('transparent pixels leave their dots unset (silhouette preserved)', () => {
    const data = img(4, 4, (x) => (x < 2 ? [0, 0, 0, 255] : [0, 0, 0, 0]));
    const lines = imageToAscii(data, 4, 4, { cols: 2, charAspect: 1, mode: 'braille' }).split('\n');
    // Right half transparent → its cell trims away, leaving one full block.
    expect(lines.every((l) => l === '⣿')).toBe(true);
  });
});

describe('mode: halfblock', () => {
  it('mono: top-only ink is ▀, bottom-only is ▄, both is █', () => {
    const top = img(2, 2, (_x, y) => (y < 1 ? [0, 0, 0, 255] : [255, 255, 255, 255]));
    const bot = img(2, 2, (_x, y) => (y < 1 ? [255, 255, 255, 255] : [0, 0, 0, 255]));
    const full = img(2, 2, () => [0, 0, 0, 255]);
    const o = { cols: 2, charAspect: 0.5, mode: 'halfblock' as const }; // 1 row, split 2
    expect(imageToAscii(top, 2, 2, o).replace(/\n/g, '')).toBe('▀▀');
    expect(imageToAscii(bot, 2, 2, o).replace(/\n/g, '')).toBe('▄▄');
    expect(imageToAscii(full, 2, 2, o).replace(/\n/g, '')).toBe('██');
  });

  it('coloured: ▀ carries top as foreground and bottom as background', () => {
    // Top red, bottom blue → one ▀ with fg=red, bg=blue.
    const data = img(2, 2, (_x, y) => (y < 1 ? [255, 0, 0, 255] : [0, 0, 255, 255]));
    const out = imageToAscii(data, 2, 2, {
      cols: 2,
      charAspect: 0.5,
      mode: 'halfblock',
      color: 'html',
    });
    expect(out).toContain('color:#ff0000');
    expect(out).toContain('background:#0000ff');
    expect(out).toContain('▀');
  });

  it('coloured ansi: emits both 38;2 fg and 48;2 bg, then resets', () => {
    const data = img(2, 2, (_x, y) => (y < 1 ? [255, 0, 0, 255] : [0, 0, 255, 255]));
    const out = imageToAscii(data, 2, 2, {
      cols: 2,
      charAspect: 0.5,
      mode: 'halfblock',
      color: 'ansi',
    });
    expect(out).toContain('\x1b[38;2;255;0;0m');
    expect(out).toContain('\x1b[48;2;0;0;255m');
    expect(out.endsWith('\x1b[0m')).toBe(true);
  });
});

describe('mode: edge', () => {
  // A 16×16 split image; the contour runs along the colour boundary.
  function split(w: number, h: number, dark: (x: number, y: number) => boolean) {
    return img(w, h, (x, y) => (dark(x, y) ? [0, 0, 0, 255] : [255, 255, 255, 255]));
  }

  it('a vertical boundary draws a vertical stroke │', () => {
    const data = split(16, 16, (x) => x < 8);
    const out = imageToAscii(data, 16, 16, { cols: 16, charAspect: 1, mode: 'edge' });
    expect(out).toContain('│');
    expect(out).not.toContain('─');
  });

  it('a horizontal boundary draws a horizontal stroke ─', () => {
    const data = split(16, 16, (_x, y) => y < 8);
    const out = imageToAscii(data, 16, 16, { cols: 16, charAspect: 1, mode: 'edge' });
    expect(out).toContain('─');
    expect(out).not.toContain('│');
  });

  it('a top-left/bottom-right boundary draws a diagonal stroke', () => {
    const data = split(16, 16, (x, y) => x + y < 16); // dark top-left triangle
    const out = imageToAscii(data, 16, 16, { cols: 16, charAspect: 1, mode: 'edge' });
    expect(out.includes('╱') || out.includes('╲')).toBe(true);
  });

  it('a flat (solid) field draws nothing — no spurious strokes', () => {
    const data = img(16, 16, () => [0, 0, 0, 255]);
    const out = imageToAscii(data, 16, 16, { cols: 16, charAspect: 1, mode: 'edge' });
    expect(out.replace(/\n/g, '').trim()).toBe('');
  });
});

describe('strokeToAscii (vector)', () => {
  // Sample a straight segment from a→b into many grid-space points.
  function seg(a: [number, number], b: [number, number], steps = 40): StrokePoint[] {
    const pts: StrokePoint[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      pts.push({ x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t });
    }
    return pts;
  }
  const o = (rounded = true) => ({ cols: 8, rows: 8, rounded });

  it('a horizontal segment is a run of ─ (with stub ends ╶ ╴)', () => {
    const out = strokeToAscii([seg([0.5, 3.5], [7.5, 3.5])], o());
    const line = out.split('\n').find((l) => l.includes('─'))!;
    // Only horizontal connectors — interior ─, the two ends are half-line stubs.
    expect([...line].every((c) => c === '─' || c === '╶' || c === '╴')).toBe(true);
    expect(line.length).toBeGreaterThanOrEqual(7);
  });

  it('a vertical segment is a run of │ (with stub ends ╵ ╷)', () => {
    const out = strokeToAscii([seg([3.5, 0.5], [3.5, 7.5])], o());
    const inked = out
      .split('\n')
      .flatMap((l) => [...l.trimEnd()])
      .filter((c) => c !== ' ');
    expect(inked.length).toBeGreaterThanOrEqual(7);
    expect(inked.every((c) => c === '│' || c === '╵' || c === '╷')).toBe(true);
    expect(inked.includes('│')).toBe(true);
  });

  it('an L (right then down) turns the corner with ╮ (rounded)', () => {
    // Right along row 1, then down column 6.
    const path = [...seg([0.5, 1.5], [6.5, 1.5]), ...seg([6.5, 1.5], [6.5, 6.5])];
    const out = strokeToAscii([path], o(true));
    expect(out).toContain('╮'); // down+left corner at the bend
    expect(out).toContain('─');
    expect(out).toContain('│');
    expect(out).not.toContain('┐'); // rounded, not sharp
  });

  it('sharp mode uses ┐ instead of ╮', () => {
    const path = [...seg([0.5, 1.5], [6.5, 1.5]), ...seg([6.5, 1.5], [6.5, 6.5])];
    const out = strokeToAscii([path], o(false));
    expect(out).toContain('┐');
    expect(out).not.toContain('╮');
  });

  it('a 4-way crossing yields ┼', () => {
    const h = seg([0.5, 3.5], [7.5, 3.5]);
    const v = seg([3.5, 0.5], [3.5, 7.5]);
    const out = strokeToAscii([h, v], o());
    expect(out).toContain('┼');
  });

  it('carries per-point colour into HTML spans', () => {
    const pts = seg([0.5, 3.5], [7.5, 3.5]).map((p) => ({ ...p, r: 255, g: 0, b: 0 }));
    const out = strokeToAscii([pts], { ...o(), color: 'html' });
    expect(out).toContain('color:#ff0000');
    expect(out).toContain('─');
  });

  it('empty input renders nothing', () => {
    expect(strokeToAscii([], o()).replace(/\n/g, '').trim()).toBe('');
  });
});
