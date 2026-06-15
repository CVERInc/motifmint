import { describe, expect, it } from 'vitest';
import { applyPathHides } from './path-hide';

const SVG =
  '<svg><path fill="#f00" d="a"/><path fill="#0f0" d="b"/><path d="c"/></svg>';

describe('applyPathHides', () => {
  it('is a no-op with an empty set', () => {
    expect(applyPathHides(SVG, new Set())).toBe(SVG);
  });

  it('hides paths by document index via fill="none"', () => {
    const out = applyPathHides(SVG, new Set([1]));
    expect(out).toContain('<path fill="none" d="b"/>');
    expect(out).toContain('<path fill="#f00" d="a"/>');
  });

  it('adds fill="none" to a fill-less path', () => {
    const out = applyPathHides(SVG, new Set([2]));
    expect(out).toContain('<path d="c" fill="none"/>');
  });

  // Regression: hiding a path whose only fill-ish attr is a `data-fill`
  // look-alike must ADD a real fill="none", not overwrite the data-fill.
  it('adds a real fill="none" instead of editing a data-fill look-alike', () => {
    const svg = '<svg><path data-fill="#abc" d="z"/></svg>';
    const out = applyPathHides(svg, new Set([0]));
    expect(out).toContain('data-fill="#abc"'); // untouched
    expect(out).toContain('fill="none"'); // real fill added
    expect(out).not.toContain('data-fill="none"');
  });
});
