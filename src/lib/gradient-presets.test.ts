import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addGradientPreset,
  loadGradientPresets,
  removeGradientPreset,
} from './gradient-presets';
import type { GradientSpec } from './gradient';

// Minimal localStorage stub (node test env has none).
function installLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
}

const spec: GradientSpec = {
  angle: 90,
  type: 'radial',
  stops: [
    { color: '#ff0000', offset: 0 },
    { color: '#0000ff', offset: 100 },
  ],
};

describe('gradient-presets', () => {
  beforeEach(() => installLocalStorage());
  afterEach(() => vi.unstubAllGlobals());

  it('starts empty', () => {
    expect(loadGradientPresets()).toEqual([]);
  });

  it('adds and loads a preset (deep-cloned)', () => {
    addGradientPreset('Sunset', spec, 1000);
    const list = loadGradientPresets();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: 'Sunset', createdAt: 1000 });
    expect(list[0].spec.type).toBe('radial');
    // mutating the source must not affect the stored copy
    spec.stops[0].color = '#000000';
    expect(loadGradientPresets()[0].spec.stops[0].color).toBe('#ff0000');
  });

  it('replaces a preset with the same name', () => {
    addGradientPreset('A', spec, 1);
    addGradientPreset('A', { ...spec, angle: 45 }, 2);
    const list = loadGradientPresets();
    expect(list).toHaveLength(1);
    expect(list[0].spec.angle).toBe(45);
  });

  it('ignores a blank name', () => {
    addGradientPreset('   ', spec, 1);
    expect(loadGradientPresets()).toEqual([]);
  });

  it('removes by name', () => {
    addGradientPreset('A', spec, 1);
    addGradientPreset('B', spec, 2);
    const after = removeGradientPreset('A');
    expect(after.map((p) => p.name)).toEqual(['B']);
  });

  it('drops malformed entries on load', () => {
    localStorage.setItem('markmint:gradient-presets', JSON.stringify([{ name: 'x' }, 42]));
    expect(loadGradientPresets()).toEqual([]);
  });
});
