import { describe, expect, it } from 'vitest';
import { fitDims, sizeSvg, svgAspect } from './svg-raster';

describe('svgAspect', () => {
  it('reads w/h from the viewBox', () => {
    expect(svgAspect('<svg viewBox="0 0 200 100"></svg>')).toBe(2);
    expect(svgAspect('<svg viewBox="0 0 100 200"></svg>')).toBe(0.5);
  });

  it('falls back to 1 when the viewBox is missing or degenerate', () => {
    expect(svgAspect('<svg></svg>')).toBe(1);
    expect(svgAspect('<svg viewBox="0 0 100 0"></svg>')).toBe(1);
  });
});

describe('fitDims', () => {
  it('puts the longest edge on the wide side for landscape', () => {
    expect(fitDims(2, 100)).toEqual({ w: 100, h: 50 });
  });

  it('puts the longest edge on the tall side for portrait', () => {
    expect(fitDims(0.5, 100)).toEqual({ w: 50, h: 100 });
  });

  it('is exact for squares', () => {
    expect(fitDims(1, 512)).toEqual({ w: 512, h: 512 });
  });

  it('never collapses the short side below 1px', () => {
    expect(fitDims(1000, 100).h).toBeGreaterThanOrEqual(1);
    expect(fitDims(0.001, 100).w).toBeGreaterThanOrEqual(1);
  });
});

describe('sizeSvg', () => {
  it('replaces existing width/height on the root tag', () => {
    const out = sizeSvg('<svg width="10" height="10" viewBox="0 0 10 10"><path/></svg>', 64, 32);
    expect(out).toContain('width="64"');
    expect(out).toContain('height="32"');
    expect(out.match(/width=/g)).toHaveLength(1);
  });

  it('adds dims when the root tag has none, keeping other attributes', () => {
    const out = sizeSvg('<svg viewBox="0 0 10 10"><path/></svg>', 64, 32);
    expect(out).toContain('viewBox="0 0 10 10"');
    expect(out).toContain('width="64" height="32"');
  });

  it('leaves nested width/height (e.g. on <rect>) alone', () => {
    const out = sizeSvg('<svg viewBox="0 0 10 10"><rect width="5" height="5"/></svg>', 64, 32);
    expect(out).toContain('<rect width="5" height="5"/>');
  });
});
