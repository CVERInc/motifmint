import { describe, expect, it } from 'vitest';
import { detectBackgroundColor, type PathBox } from './background';

const vb = { x: 0, y: 0, w: 100, h: 100 };

describe('detectBackgroundColor', () => {
  it('detects a full-canvas plate behind a small mark', () => {
    const boxes: PathBox[] = [
      { fill: '#ffffff', x: 0, y: 0, w: 100, h: 100 }, // background plate
      { fill: '#ff0000', x: 40, y: 40, w: 20, h: 20 }, // foreground mark
    ];
    expect(detectBackgroundColor(boxes, vb)).toBe('#ffffff');
  });

  it('returns null when no color covers enough / reaches the edges', () => {
    const boxes: PathBox[] = [
      { fill: '#ff0000', x: 40, y: 40, w: 20, h: 20 },
      { fill: '#00ff00', x: 10, y: 10, w: 10, h: 10 },
    ];
    expect(detectBackgroundColor(boxes, vb)).toBeNull();
  });

  it('ignores a large but centered shape that reaches no edges', () => {
    const boxes: PathBox[] = [
      { fill: '#0000ff', x: 10, y: 10, w: 80, h: 80 }, // 64% coverage, 0 edges
    ];
    expect(detectBackgroundColor(boxes, vb)).toBeNull();
  });

  it('unions multiple paths of the same color', () => {
    const boxes: PathBox[] = [
      { fill: '#eeeeee', x: 0, y: 0, w: 100, h: 50 },
      { fill: '#eeeeee', x: 0, y: 50, w: 100, h: 50 }, // together cover the canvas
      { fill: '#222222', x: 30, y: 30, w: 10, h: 10 },
    ];
    expect(detectBackgroundColor(boxes, vb)).toBe('#eeeeee');
  });

  it('picks the larger-coverage color when two qualify', () => {
    const boxes: PathBox[] = [
      { fill: '#aaaaaa', x: 0, y: 0, w: 100, h: 100 }, // full
      { fill: '#bbbbbb', x: 2, y: 2, w: 96, h: 96 }, // nearly full, smaller
    ];
    expect(detectBackgroundColor(boxes, vb)).toBe('#aaaaaa');
  });

  it('respects a custom coverage threshold', () => {
    const boxes: PathBox[] = [{ fill: '#ccc', x: 0, y: 0, w: 70, h: 100 }];
    // frac = 0.7, touches 3 edges → qualifies at 0.6 but not at 0.8
    expect(detectBackgroundColor(boxes, vb, { coverage: 0.6 })).toBe('#ccc');
    expect(detectBackgroundColor(boxes, vb, { coverage: 0.8 })).toBeNull();
  });

  it('returns null for empty input or a degenerate canvas', () => {
    expect(detectBackgroundColor([], vb)).toBeNull();
    expect(
      detectBackgroundColor([{ fill: '#fff', x: 0, y: 0, w: 1, h: 1 }], { x: 0, y: 0, w: 0, h: 0 }),
    ).toBeNull();
  });
});
