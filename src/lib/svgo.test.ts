import { describe, expect, it } from 'vitest';
import { optimizeSvg } from './svgo';
import { normalizeFills } from './strip-artifact';

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">' +
  '<path fill="#000000" d="M0 0 L10 0 L10 10 L0 10 Z"/>' +
  '<path fill="#ff0000" d="M20 20 L30 20 L30 30 L20 30 Z"/>' +
  '</svg>';

describe('optimizeSvg', () => {
  it('keeps the viewBox — the whole edit pipeline positions by it', () => {
    expect(optimizeSvg(SVG)).toContain('viewBox="0 0 100 100"');
  });

  it('keeps fills as hex — named colors would escape the hex-keyed grouping', () => {
    // Without the convertColors override SVGO rewrites #ff0000 → "red", which
    // mergeNearColors' fill="#……" regex and the color-picker swatches miss.
    expect(optimizeSvg(SVG)).toContain('#ff0000');
    expect(optimizeSvg(SVG)).not.toContain('"red"');
  });

  it('a stripped default-black fill is restored by normalizeFills downstream', () => {
    // removeUnknownsAndDefaults drops fill="#000000" (it matches the SVG
    // default); the worker pipeline runs normalizeFills right after SVGO,
    // which re-adds it, so Recolor still sees a black swatch.
    expect(normalizeFills(optimizeSvg(SVG))).toContain('fill="#000000"');
  });

  it('strips fixed width/height (removeDimensions) so the SVG stays fluid', () => {
    expect(optimizeSvg(SVG)).not.toMatch(/<svg[^>]*\swidth=/);
  });

  it('keeps every path', () => {
    const out = optimizeSvg(SVG);
    expect(out.match(/<path/g)).toHaveLength(2);
  });

  it('returns the input unchanged when SVGO cannot parse it', () => {
    const broken = '<svg><path d="M0 0';
    expect(optimizeSvg(broken)).toBe(broken);
  });
});
