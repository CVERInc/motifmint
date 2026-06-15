import { describe, expect, it } from 'vitest';
import { sampleSvgStrokes } from './ascii-stroke-dom';

// The geometry sampling itself needs a real SVG layout (getPointAtLength /
// getCTM), so it's exercised in CI's build + the maintainer's click-test, not
// here. This smoke test just pins the node-safe guard and that the module
// transforms/loads cleanly — the connectivity→glyph logic it feeds is covered
// by the strokeToAscii suite in ascii.test.ts.
describe('sampleSvgStrokes', () => {
  it('returns null without a DOM (node environment)', () => {
    expect(typeof document).toBe('undefined');
    expect(sampleSvgStrokes('<svg viewBox="0 0 10 10"><path d="M0 0 L10 10"/></svg>', 40)).toBe(
      null,
    );
  });
});
