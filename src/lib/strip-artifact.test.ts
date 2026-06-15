import { describe, expect, it } from 'vitest';
import { mergeNearColors, normalizeFills, stripBoundingBoxArtifact } from './strip-artifact';

describe('mergeNearColors', () => {
  it('merges near-black shades into the first-seen representative', () => {
    const svg =
      '<svg><path fill="#020202"/><path fill="#040404"/><path fill="#060606"/></svg>';
    const out = mergeNearColors(svg, 16);
    // all collapse to the first one
    expect(out.match(/fill="#020202"/g)).toHaveLength(3);
  });

  it('keeps clearly distinct colors apart', () => {
    const svg = '<svg><path fill="#000000"/><path fill="#ffffff"/></svg>';
    expect(mergeNearColors(svg, 16)).toBe(svg);
  });

  it('respects a tighter threshold', () => {
    const svg = '<svg><path fill="#000000"/><path fill="#202020"/></svg>';
    // distance 32 > threshold 16 → unchanged
    expect(mergeNearColors(svg, 16)).toBe(svg);
  });

  // Regression: the merge regex used a plain `\bfill` boundary and would also
  // rewrite a `data-fill="#......"` look-alike attribute.
  it('does not touch a data-fill look-alike attribute', () => {
    const svg = '<svg><path data-fill="#020202" fill="#040404"/><path fill="#060606"/></svg>';
    const out = mergeNearColors(svg, 16);
    expect(out).toContain('data-fill="#020202"'); // untouched
    // the two REAL fills still merge to the first-seen representative
    expect(out.match(/[^-:\w]fill="#040404"/g)).toHaveLength(2);
  });
});

describe('normalizeFills', () => {
  it('adds explicit black to fill-less paths', () => {
    const out = normalizeFills('<svg><path d="M0 0"/></svg>');
    expect(out).toContain('fill="#000000"');
  });

  it('leaves paths with an existing fill attribute alone', () => {
    const svg = '<svg><path fill="#ff0000" d="M0 0"/></svg>';
    expect(normalizeFills(svg)).toBe(svg);
  });

  it('leaves paths with a style fill alone', () => {
    const svg = '<svg><path style="fill:#ff0000" d="M0 0"/></svg>';
    expect(normalizeFills(svg)).toBe(svg);
  });

  it('preserves self-closing form', () => {
    const out = normalizeFills('<svg><path d="M0 0"/></svg>');
    expect(out).toContain('fill="#000000"/>');
  });

  // Regression: a `data-fill` (or `xlink:fill`) attribute used to satisfy the
  // "already has a fill" guard via a plain `\bfill` boundary, so the path was
  // skipped and left fill-less — invisible to the Recolor swatch UI.
  it('still normalizes a path whose only fill-ish attr is data-fill', () => {
    const out = normalizeFills('<svg><path data-fill="x" d="M0 0"/></svg>');
    expect(out).toContain('fill="#000000"');
    // the real fill is added, the look-alike attribute is untouched
    expect(out).toContain('data-fill="x"');
  });
});

describe('stripBoundingBoxArtifact', () => {
  it('removes a full-viewBox background path', () => {
    const svg =
      '<svg viewBox="0 0 100 50"><path d="M0 0h100v50H0z" fill="#fff"/><path d="M5 5" fill="#000"/></svg>';
    const out = stripBoundingBoxArtifact(svg);
    expect(out).not.toContain('h100v50');
    expect(out).toContain('d="M5 5"');
  });

  it('leaves content paths intact when there is no bg artifact', () => {
    const svg = '<svg viewBox="0 0 100 50"><path d="M5 5h10v10z"/></svg>';
    expect(stripBoundingBoxArtifact(svg)).toBe(svg);
  });

  it('is a no-op without a 0 0 W H viewBox', () => {
    const svg = '<svg viewBox="1 1 100 50"><path d="M0 0h100v50H0z"/></svg>';
    expect(stripBoundingBoxArtifact(svg)).toBe(svg);
  });
});
