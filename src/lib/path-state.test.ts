import { describe, expect, it } from 'vitest';
import {
  applyPathOverrides,
  bulkSetFill,
  bulkSetRemoved,
  collectRemoved,
  parsePathList,
  setPathFill,
  setPathRemoved,
  type PathState,
} from './path-state';

const TAGGED =
  '<svg>' +
  '<path data-orig-idx="0" fill="#FF0000" d="M0 0"/>' +
  '<path data-orig-idx="1" fill="#00ff00" d="M1 1"/>' +
  '<path data-orig-idx="2" d="M2 2"/>' +
  '<path d="M3 3"/>' + // untagged → skipped
  '</svg>';

describe('parsePathList', () => {
  it('reads tagged paths and lowercases fills', () => {
    const list = parsePathList(TAGGED);
    expect(list).toEqual([
      { origIdx: 0, originalFill: '#ff0000' },
      { origIdx: 1, originalFill: '#00ff00' },
      { origIdx: 2, originalFill: '#000000' }, // missing fill defaults to black
    ]);
  });
});

describe('setPathFill / setPathRemoved + compaction', () => {
  it('sets a fill override', () => {
    const states = setPathFill(new Map(), 0, '#123456');
    expect(states.get(0)).toEqual({ fill: '#123456' });
  });

  it('removes the entry when fill cleared and not removed', () => {
    let states = setPathFill(new Map(), 0, '#123456');
    states = setPathFill(states, 0, undefined);
    expect(states.has(0)).toBe(false);
  });

  it('keeps the entry when still removed after clearing fill', () => {
    let states = setPathRemoved(new Map(), 0, true);
    states = setPathFill(states, 0, '#123456');
    states = setPathFill(states, 0, undefined);
    expect(states.get(0)).toEqual({ fill: undefined, removed: true });
  });

  it('does not mutate the input map', () => {
    const orig = new Map<number, PathState>();
    setPathFill(orig, 0, '#123456');
    expect(orig.size).toBe(0);
  });
});

describe('collectRemoved', () => {
  it('returns indices flagged removed', () => {
    let states = setPathRemoved(new Map(), 1, true);
    states = setPathRemoved(states, 3, true);
    states = setPathFill(states, 2, '#fff'); // not removed
    expect(collectRemoved(states).sort()).toEqual([1, 3]);
  });
});

describe('bulk operations', () => {
  const list = parsePathList(TAGGED);

  it('bulkSetFill writes the fill to every matching color', () => {
    const states = bulkSetFill(new Map(), list, '#ff0000', '#0000ff');
    expect(states.get(0)).toEqual({ fill: '#0000ff' });
    expect(states.has(1)).toBe(false);
  });

  it('bulkSetRemoved hides every matching color', () => {
    const states = bulkSetRemoved(new Map(), list, '#000000', true);
    expect(states.get(2)).toEqual({ removed: true });
  });
});

describe('applyPathOverrides', () => {
  it('rewrites the fill of overridden paths', () => {
    const states = new Map<number, PathState>([[0, { fill: '#abcdef' }]]);
    const out = applyPathOverrides(TAGGED, states);
    expect(out).toContain('data-orig-idx="0" fill="#abcdef"');
    expect(out).toContain('fill="#00ff00"');
  });

  it('adds a fill when the path lacks one', () => {
    const states = new Map<number, PathState>([[2, { fill: '#abcdef' }]]);
    const out = applyPathOverrides(TAGGED, states);
    expect(out).toContain('data-orig-idx="2" d="M2 2" fill="#abcdef"');
  });

  it('hides auto-hidden paths with fill="none"', () => {
    const out = applyPathOverrides(TAGGED, new Map(), new Set([1]));
    expect(out).toContain('data-orig-idx="1" fill="none"');
  });

  it('marks auto-hidden paths red in preview mode instead of hiding', () => {
    const out = applyPathOverrides(TAGGED, new Map(), new Set([1]), true);
    expect(out).toContain('fill="#ef4444"');
    expect(out).toContain('data-preview-remove="1"');
  });

  it('is a no-op with no states and no auto-hide set', () => {
    expect(applyPathOverrides(TAGGED, new Map())).toBe(TAGGED);
  });
});
