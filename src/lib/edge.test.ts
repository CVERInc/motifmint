/**
 * Edge-case coverage for branches the per-module suites don't exercise.
 */
import { describe, expect, it } from 'vitest';
import { applyColorGradients, type GradientSpec } from './gradient';
import { bakeBackdrop, backdropCss, DEFAULT_BACKDROP, readViewBox } from './backdrop';
import { applyRemap } from './recolor';
import { mergeNearColors } from './strip-artifact';
import { extractSvgInner } from './compose-layers';
import { formatBytes } from './format';
import type { PathInfo } from './path-state';

describe('gradient angle edges', () => {
  const SVG =
    '<svg viewBox="0 0 100 100"><path data-orig-idx="0" fill="#ff0000" d="M0 0"/></svg>';
  const PATHS: PathInfo[] = [{ origIdx: 0, originalFill: '#ff0000' }];

  it('0deg is horizontal: x spans 0→100, y constant at center', () => {
    const spec: GradientSpec = {
      angle: 0,
      stops: [
        { color: '#000', offset: 0 },
        { color: '#fff', offset: 100 },
      ],
    };
    const out = applyColorGradients(SVG, new Map([['#ff0000', spec]]), PATHS);
    expect(out).toContain('x1="0"');
    expect(out).toContain('x2="100"');
    expect(out).toContain('y1="50"');
    expect(out).toContain('y2="50"');
  });
});

describe('backdrop edges', () => {
  it('bakeBackdrop is a no-op when the viewBox is unreadable', () => {
    const svg = '<svg><path d="M0 0"/></svg>';
    expect(bakeBackdrop(svg, { ...DEFAULT_BACKDROP, alpha: 100 })).toBe(svg);
  });

  it('backdropCss returns the raw color for a non-6-digit hex', () => {
    expect(backdropCss({ ...DEFAULT_BACKDROP, color: '#fff', alpha: 50 })).toBe('#fff');
  });

  it('readViewBox rejects a malformed viewBox', () => {
    expect(readViewBox('<svg viewBox="0 0 nan 10">')).toBeNull();
  });
});

describe('recolor edges', () => {
  it('never repaints none / url() paints', () => {
    const svg = '<svg><path fill="none"/><path fill="url(#g)"/></svg>';
    expect(applyRemap(svg, { '#000000': '#ffffff' })).toBe(svg);
  });
});

describe('strip-artifact edges', () => {
  it('merges 8-digit hex colors by RGB, ignoring alpha', () => {
    const svg = '<svg><path fill="#000000ff"/><path fill="#00000080"/></svg>';
    const out = mergeNearColors(svg, 16);
    // both near-black (alpha differs) collapse to the first representative
    expect(out.match(/fill="#000000ff"/g)).toHaveLength(2);
  });
});

describe('compose extractSvgInner edge', () => {
  it('returns trimmed input when there is no <svg> tag', () => {
    expect(extractSvgInner('  <path d="a"/>  ')).toBe('<path d="a"/>');
  });
});

describe('formatBytes boundaries', () => {
  it('switches units exactly at 1024', () => {
    expect(formatBytes(1023)).toBe('1023 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1024 * 1024 - 1)).toContain('KB');
    expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
  });
});
