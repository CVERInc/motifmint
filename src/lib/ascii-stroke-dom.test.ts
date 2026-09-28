import { describe, expect, it } from 'vitest';
import { sampleSvgStrokes } from './ascii-stroke-dom';

// The geometry sampling itself needs a real SVG layout (getPointAtLength /
// getCTM). Nothing in CI executes it (`astro build` only bundles it); it is
// covered only by the maintainer's click-test. This smoke test just pins the
// node-safe guard and that the module transforms/loads cleanly — the connectivity→glyph logic it feeds is covered
// by the strokeToAscii suite in ascii.test.ts.
describe('sampleSvgStrokes', () => {
  it('returns null without a DOM (node environment)', () => {
    expect(typeof document).toBe('undefined');
    expect(sampleSvgStrokes('<svg viewBox="0 0 10 10"><path d="M0 0 L10 10"/></svg>', 40)).toBe(
      null,
    );
  });
});
