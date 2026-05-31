import { describe, expect, it } from 'vitest';
import { buildSizeSet, DEFAULT_SCALES } from './export-set';

describe('buildSizeSet', () => {
  it('defaults to @1x/@2x/@3x', () => {
    expect(DEFAULT_SCALES).toEqual([1, 2, 3]);
    const set = buildSizeSet(256);
    expect(set).toEqual([
      { scale: 1, size: 256, suffix: '@1x' },
      { scale: 2, size: 512, suffix: '@2x' },
      { scale: 3, size: 768, suffix: '@3x' },
    ]);
  });

  it('rounds and clamps to at least 1px', () => {
    expect(buildSizeSet(10, [0.05])).toEqual([{ scale: 0.05, size: 1, suffix: '@0.05x' }]);
    expect(buildSizeSet(33, [1.5])[0].size).toBe(50); // round(49.5)
  });

  it('drops non-positive scales', () => {
    expect(buildSizeSet(100, [0, -2, 1]).map((e) => e.scale)).toEqual([1]);
  });

  it('supports custom scale lists', () => {
    expect(buildSizeSet(100, [1, 4]).map((e) => e.size)).toEqual([100, 400]);
  });
});
