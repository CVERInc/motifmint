import { describe, expect, it } from 'vitest';
import {
  applyColorGradients,
  gradId,
  shade,
  type GradientSpec,
} from './gradient';
import type { PathInfo } from './path-state';

describe('gradId', () => {
  it('strips non-alphanumerics and lowercases', () => {
    expect(gradId('#FF00AA')).toBe('mmg-ff00aa');
  });

  it('is deterministic for the same key', () => {
    expect(gradId('#123456')).toBe(gradId('#123456'));
  });
});

describe('shade', () => {
  it('darkens by the given factor', () => {
    expect(shade('#646464', 0.5)).toBe('#323232');
  });

  it('clamps to 0', () => {
    expect(shade('#000000', 0.5)).toBe('#000000');
  });

  it('returns input unchanged when not a #rrggbb hex', () => {
    expect(shade('red', 0.5)).toBe('red');
  });
});

const PATHS: PathInfo[] = [
  { origIdx: 0, originalFill: '#ff0000' },
  { origIdx: 1, originalFill: '#00ff00' },
  { origIdx: 2, originalFill: '#ff0000' },
];

const SVG =
  '<svg viewBox="0 0 100 100">' +
  '<path data-orig-idx="0" fill="#ff0000" d="M0 0"/>' +
  '<path data-orig-idx="1" fill="#00ff00" d="M1 1"/>' +
  '<path data-orig-idx="2" fill="#ff0000" d="M2 2"/>' +
  '</svg>';

const spec: GradientSpec = {
  stops: [
    { color: '#ff6a00', offset: 0 },
    { color: '#ee0979', offset: 100 },
  ],
  angle: 90,
};

describe('applyColorGradients', () => {
  it('is a no-op with no gradients', () => {
    expect(applyColorGradients(SVG, new Map(), PATHS)).toBe(SVG);
  });

  it('repaints every path of a color group with the same gradient url', () => {
    const out = applyColorGradients(SVG, new Map([['#ff0000', spec]]), PATHS);
    const id = gradId('#ff0000');
    // both #ff0000 paths repainted
    expect(out.match(new RegExp(`fill="url\\(#${id}\\)"`, 'g'))).toHaveLength(2);
    // the #00ff00 path left alone
    expect(out).toContain('fill="#00ff00"');
  });

  it('injects a linearGradient def with sorted stops', () => {
    const unsorted: GradientSpec = {
      stops: [
        { color: '#ee0979', offset: 100 },
        { color: '#ff6a00', offset: 0 },
      ],
      angle: 90,
    };
    const out = applyColorGradients(SVG, new Map([['#ff0000', unsorted]]), PATHS);
    expect(out).toContain('<defs>');
    expect(out).toContain('gradientUnits="userSpaceOnUse"');
    const first = out.indexOf('stop-color="#ff6a00"');
    const second = out.indexOf('stop-color="#ee0979"');
    expect(first).toBeGreaterThan(-1);
    expect(first).toBeLessThan(second);
  });

  it('only emits defs for color groups that match a path', () => {
    const out = applyColorGradients(SVG, new Map([['#abcdef', spec]]), PATHS);
    // no path has #abcdef, so nothing changes
    expect(out).toBe(SVG);
  });

  it('computes vertical endpoints for a 90deg angle over the viewBox', () => {
    const out = applyColorGradients(SVG, new Map([['#ff0000', spec]]), PATHS);
    // 90deg: x constant at center (50), y spans 0→100
    expect(out).toContain('x1="50"');
    expect(out).toContain('x2="50"');
    expect(out).toContain('y1="0"');
    expect(out).toContain('y2="100"');
  });

  it('emits a radialGradient centered on the viewBox for type=radial', () => {
    const radial: GradientSpec = { ...spec, type: 'radial' };
    const out = applyColorGradients(SVG, new Map([['#ff0000', radial]]), PATHS);
    expect(out).toContain('<radialGradient');
    expect(out).not.toContain('<linearGradient');
    expect(out).toContain('cx="50"');
    expect(out).toContain('cy="50"');
    expect(out).toContain('r="50"');
  });

  it('supports 3+ stops', () => {
    const three: GradientSpec = {
      angle: 90,
      stops: [
        { color: '#000000', offset: 0 },
        { color: '#888888', offset: 50 },
        { color: '#ffffff', offset: 100 },
      ],
    };
    const out = applyColorGradients(SVG, new Map([['#ff0000', three]]), PATHS);
    expect((out.match(/<stop /g) ?? [])).toHaveLength(3);
    expect(out).toContain('offset="50%"');
  });
});
