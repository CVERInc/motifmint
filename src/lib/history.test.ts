import { describe, expect, it } from 'vitest';
import { History } from './history';

describe('History', () => {
  it('starts empty', () => {
    const h = new History<number>();
    expect(h.current).toBeNull();
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
  });

  it('reset seeds a single baseline', () => {
    const h = new History<number>();
    h.reset(0);
    expect(h.current).toBe(0);
    expect(h.canUndo).toBe(false);
    expect(h.size).toBe(1);
  });

  it('push then undo/redo walks the stack', () => {
    const h = new History<number>();
    h.reset(0);
    h.push(1);
    h.push(2);
    expect(h.current).toBe(2);
    expect(h.undo()).toBe(1);
    expect(h.undo()).toBe(0);
    expect(h.canUndo).toBe(false);
    expect(h.undo()).toBeNull();
    expect(h.redo()).toBe(1);
    expect(h.redo()).toBe(2);
    expect(h.redo()).toBeNull();
  });

  it('push after undo discards the redo branch', () => {
    const h = new History<number>();
    h.reset(0);
    h.push(1);
    h.push(2);
    h.undo(); // → 1
    h.push(9); // branch from 1
    expect(h.current).toBe(9);
    expect(h.canRedo).toBe(false);
    expect(h.undo()).toBe(1);
    expect(h.redo()).toBe(9);
  });

  it('enforces the size limit by dropping oldest entries', () => {
    const h = new History<number>(3);
    h.reset(0);
    h.push(1);
    h.push(2);
    h.push(3); // exceeds limit 3 → drop oldest (0)
    expect(h.size).toBe(3);
    expect(h.current).toBe(3);
    // can only undo back to the retained window
    expect(h.undo()).toBe(2);
    expect(h.undo()).toBe(1);
    expect(h.canUndo).toBe(false);
  });

  it('treats limit < 1 as 1', () => {
    const h = new History<number>(0);
    h.reset(0);
    h.push(1);
    expect(h.size).toBe(1);
    expect(h.current).toBe(1);
  });
});
