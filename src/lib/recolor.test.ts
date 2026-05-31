import { describe, expect, it } from 'vitest';
import { applyRemap, extractColors, normalizeToHex } from './recolor';

describe('normalizeToHex', () => {
  it('passes through #rrggbb', () => {
    expect(normalizeToHex('#1a2b3c')).toBe('#1a2b3c');
    expect(normalizeToHex('#ABCDEF')).toBe('#abcdef');
  });

  it('expands #rgb shorthand', () => {
    expect(normalizeToHex('#f00')).toBe('#ff0000');
    expect(normalizeToHex('#abc')).toBe('#aabbcc');
  });

  it('drops alpha from #rrggbbaa and #rgba', () => {
    expect(normalizeToHex('#11223344')).toBe('#112233');
    expect(normalizeToHex('#f00f')).toBe('#ff0000');
  });

  it('resolves named colors', () => {
    expect(normalizeToHex('black')).toBe('#000000');
    expect(normalizeToHex('WHITE')).toBe('#ffffff');
    expect(normalizeToHex('teal')).toBe('#008080');
  });

  it('parses rgb() and rgba()', () => {
    expect(normalizeToHex('rgb(255, 0, 0)')).toBe('#ff0000');
    expect(normalizeToHex('rgba(0,128,255,0.5)')).toBe('#0080ff');
  });

  it('clamps over-range rgb channels to 255', () => {
    expect(normalizeToHex('rgb(300, 0, 128)')).toBe('#ff0080');
  });

  it('returns null for negative rgb channels (no digit match)', () => {
    expect(normalizeToHex('rgb(-5, 0, 0)')).toBeNull();
  });

  it('returns null for unparseable input', () => {
    expect(normalizeToHex('not-a-color')).toBeNull();
    expect(normalizeToHex('hsl(0,0,0)')).toBeNull();
  });
});

describe('extractColors', () => {
  it('extracts distinct fill and stroke colors', () => {
    const svg =
      '<svg><path fill="#ff0000"/><path fill="#00ff00" stroke="#0000ff"/></svg>';
    const colors = extractColors(svg).map((c) => c.hex).sort();
    expect(colors).toEqual(['#0000ff', '#00ff00', '#ff0000']);
  });

  it('dedupes colors that normalize to the same hex', () => {
    const svg = '<svg><path fill="#f00"/><path fill="red"/><path fill="#ff0000"/></svg>';
    expect(extractColors(svg)).toHaveLength(1);
    expect(extractColors(svg)[0].hex).toBe('#ff0000');
  });

  it('keeps the first raw form seen', () => {
    const svg = '<svg><path fill="red"/><path fill="#ff0000"/></svg>';
    expect(extractColors(svg)[0].raw).toBe('red');
  });

  it('reads colors from style declarations', () => {
    const svg = '<svg><path style="fill:#abcdef;stroke: #123456"/></svg>';
    const colors = extractColors(svg).map((c) => c.hex).sort();
    expect(colors).toEqual(['#123456', '#abcdef']);
  });

  it('ignores none / transparent / url() / currentColor paints', () => {
    const svg =
      '<svg><path fill="none"/><path fill="transparent"/><path fill="url(#g)"/><path fill="currentColor"/></svg>';
    expect(extractColors(svg)).toHaveLength(0);
  });
});

describe('applyRemap', () => {
  it('rewrites fill attributes by normalized hex key', () => {
    const svg = '<svg><path fill="#f00"/></svg>';
    expect(applyRemap(svg, { '#ff0000': '#0000ff' })).toBe('<svg><path fill="#0000ff"/></svg>');
  });

  it('rewrites stroke attributes', () => {
    const svg = '<svg><path stroke="red"/></svg>';
    expect(applyRemap(svg, { '#ff0000': '#00ff00' })).toBe('<svg><path stroke="#00ff00"/></svg>');
  });

  it('rewrites style fill/stroke declarations', () => {
    const svg = '<svg><path style="fill:#000000;stroke:#ffffff"/></svg>';
    const out = applyRemap(svg, { '#000000': '#111111', '#ffffff': '#eeeeee' });
    expect(out).toContain('fill:#111111');
    expect(out).toContain('stroke:#eeeeee');
  });

  it('leaves unmapped colors untouched', () => {
    const svg = '<svg><path fill="#abcdef"/></svg>';
    expect(applyRemap(svg, { '#ff0000': '#0000ff' })).toBe(svg);
  });

  it('is a no-op for an empty remap', () => {
    const svg = '<svg><path fill="#abcdef"/></svg>';
    expect(applyRemap(svg, {})).toBe(svg);
  });
});
