import { describe, expect, it } from 'vitest';
import { injectOrigIdx, removePaths } from './punch-hole';

describe('injectOrigIdx', () => {
  it('tags every path in document order', () => {
    const out = injectOrigIdx('<svg><path d="a"/><path d="b"/><path d="c"/></svg>');
    expect(out).toContain('<path data-orig-idx="0" d="a"/>');
    expect(out).toContain('<path data-orig-idx="1" d="b"/>');
    expect(out).toContain('<path data-orig-idx="2" d="c"/>');
  });

  it('is idempotent — does not double-inject', () => {
    const once = injectOrigIdx('<svg><path d="a"/></svg>');
    expect(injectOrigIdx(once)).toBe(once);
  });

  it('leaves an svg with no paths unchanged', () => {
    const svg = '<svg><rect/></svg>';
    expect(injectOrigIdx(svg)).toBe(svg);
  });
});

describe('removePaths (no DOM)', () => {
  it('is a no-op for an empty target list', () => {
    const svg = '<svg><path data-orig-idx="0" d="a"/></svg>';
    expect(removePaths(svg, [])).toBe(svg);
  });

  it('returns the input unchanged when document is unavailable', () => {
    // Runs in the node test env (no document) → falls through the guard.
    const svg = '<svg><path data-orig-idx="0" d="a"/></svg>';
    expect(removePaths(svg, [0])).toBe(svg);
  });
});
