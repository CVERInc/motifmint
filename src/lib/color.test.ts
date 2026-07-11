import { describe, expect, it } from 'vitest';
import { hexToRgb } from './color';

describe('hexToRgb', () => {
  it('parses #rrggbb', () => {
    expect(hexToRgb('#ff8000')).toEqual([255, 128, 0]);
  });

  it('ignores the alpha of #rrggbbaa', () => {
    expect(hexToRgb('#ff800080')).toEqual([255, 128, 0]);
  });

  it('accepts a missing #', () => {
    expect(hexToRgb('102030')).toEqual([16, 32, 48]);
  });

  it('rejects shorthand and garbage', () => {
    expect(hexToRgb('#fff')).toBeNull();
    expect(hexToRgb('red')).toBeNull();
    expect(hexToRgb('#gg0000')).toBeNull();
  });
});
