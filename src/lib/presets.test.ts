import { describe, expect, it } from 'vitest';
import { clonePreset, paramsEqual, PRESET_PARAMS, PRESETS } from './presets';

describe('presets', () => {
  it('exposes one param set per listed preset', () => {
    for (const meta of PRESETS) {
      expect(PRESET_PARAMS[meta.id]).toBeDefined();
    }
  });

  it('clonePreset returns an independent copy', () => {
    const a = clonePreset('logo');
    a.filterSpeckle = 999;
    expect(PRESET_PARAMS.logo.filterSpeckle).not.toBe(999);
  });

  it('paramsEqual is true for a clone, false after a tweak', () => {
    const a = clonePreset('photo');
    const b = clonePreset('photo');
    expect(paramsEqual(a, b)).toBe(true);
    b.colorPrecision += 1;
    expect(paramsEqual(a, b)).toBe(false);
  });

  it('sketch preset uses binary color mode', () => {
    expect(PRESET_PARAMS.sketch.colorMode).toBe(1);
  });

  it('pixel-art preset disables smoothing (polygon mode)', () => {
    expect(PRESET_PARAMS['pixel-art'].pathSimplifyMode).toBe(0);
  });
});
