import { describe, expect, it } from 'vitest';
import {
  composeLayers,
  composeTransform,
  extractSvgInner,
  IDENTITY_TRANSFORM,
  type ComposeLayer,
} from './compose-layers';

describe('extractSvgInner', () => {
  it('returns content between the outer svg tags', () => {
    expect(extractSvgInner('<svg viewBox="0 0 1 1"><path d="a"/></svg>')).toBe('<path d="a"/>');
  });

  it('handles nested groups and trailing whitespace', () => {
    expect(extractSvgInner('<svg><g><path d="a"/></g></svg>\n')).toBe('<g><path d="a"/></g>');
  });
});

describe('composeTransform', () => {
  const vb = { x: 0, y: 0, w: 100, h: 100 };

  it('fits a square viewBox to the canvas with identity transform', () => {
    expect(composeTransform(vb, IDENTITY_TRANSFORM, 1000)).toEqual({ f: 10, tx: 0, ty: 0 });
  });

  it('scales down and re-centers', () => {
    const out = composeTransform(vb, { dx: 0, dy: 0, scale: 0.5 }, 1000);
    expect(out.f).toBe(5);
    expect(out.tx).toBe(250); // (1000 - 500)/2
    expect(out.ty).toBe(250);
  });

  it('applies a fractional offset of the canvas side', () => {
    const out = composeTransform(vb, { dx: 0.1, dy: -0.2, scale: 1 }, 1000);
    expect(out.tx).toBe(100); // 0 + 0.1*1000
    expect(out.ty).toBe(-200);
  });

  it('contains a wide viewBox by its longest edge and centers vertically', () => {
    const out = composeTransform({ x: 0, y: 0, w: 200, h: 100 }, IDENTITY_TRANSFORM, 1000);
    expect(out.f).toBe(5); // 1000 / max(200,100)
    expect(out.tx).toBe(0); // (1000 - 200*5)/2 = 0
    expect(out.ty).toBe(250); // (1000 - 100*5)/2
  });

  it('offsets a non-zero viewBox origin', () => {
    const out = composeTransform({ x: 10, y: 20, w: 100, h: 100 }, IDENTITY_TRANSFORM, 1000);
    // tx = 0 - 10*10 = -100 ; ty = 0 - 20*10 = -200
    expect(out.tx).toBe(-100);
    expect(out.ty).toBe(-200);
  });
});

describe('composeLayers', () => {
  const a: ComposeLayer = { svg: '<svg viewBox="0 0 100 100"><path d="A"/></svg>' };
  const b: ComposeLayer = { svg: '<svg viewBox="0 0 100 100"><path d="B"/></svg>' };

  it('passes a single untransformed layer through verbatim', () => {
    expect(composeLayers([a])).toBe(a.svg);
  });

  it('returns an empty square canvas for no visible layers', () => {
    expect(composeLayers([])).toContain('viewBox="0 0 1024 1024"');
    expect(composeLayers([{ ...a, hidden: true }])).toContain('viewBox="0 0 1024 1024"');
  });

  it('merges multiple layers into one square canvas with <g> wrappers', () => {
    const out = composeLayers([a, b], 1000);
    expect(out).toContain('viewBox="0 0 1000 1000"');
    expect((out.match(/<g transform=/g) ?? [])).toHaveLength(2);
    expect(out).toContain('<path d="A"/>');
    expect(out).toContain('<path d="B"/>');
  });

  it('skips hidden layers', () => {
    const out = composeLayers([a, { ...b, hidden: true }], 1000);
    expect(out).toContain('<path d="A"/>');
    expect(out).not.toContain('<path d="B"/>');
  });

  it('switches to compose mode for a single transformed layer', () => {
    const out = composeLayers([{ ...a, transform: { dx: 0, dy: 0, scale: 0.5 } }], 1000);
    expect(out).toContain('<g transform="translate(250 250) scale(5)">');
  });
});
