import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_THEME,
  THEMES,
  THEME_STORAGE_KEY,
  isTheme,
  loadTheme,
  resolveInitialTheme,
  saveTheme,
  toggleTheme,
} from './theme';

// Minimal localStorage stub (node test env has none), matching the pattern in
// gradient-presets.test.ts.
function installLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
  return store;
}

describe('theme model', () => {
  it('exposes exactly dark + light, default dark', () => {
    expect(THEMES).toEqual(['dark', 'light']);
    expect(DEFAULT_THEME).toBe('dark');
  });

  describe('isTheme', () => {
    it('accepts known themes', () => {
      expect(isTheme('dark')).toBe(true);
      expect(isTheme('light')).toBe(true);
    });
    it('rejects anything else', () => {
      expect(isTheme('blue')).toBe(false);
      expect(isTheme('')).toBe(false);
      expect(isTheme(null)).toBe(false);
      expect(isTheme(undefined)).toBe(false);
      expect(isTheme(1)).toBe(false);
      expect(isTheme({})).toBe(false);
    });
  });

  describe('toggleTheme', () => {
    it('flips dark <-> light', () => {
      expect(toggleTheme('dark')).toBe('light');
      expect(toggleTheme('light')).toBe('dark');
    });
    it('is its own inverse', () => {
      expect(toggleTheme(toggleTheme('dark'))).toBe('dark');
    });
  });

  describe('resolveInitialTheme', () => {
    it('saved valid choice wins over the OS hint', () => {
      expect(resolveInitialTheme('light', false)).toBe('light');
      // explicit dark must survive even when the OS prefers light
      expect(resolveInitialTheme('dark', true)).toBe('dark');
    });
    it('falls back to the OS prefers-light hint when nothing is saved', () => {
      expect(resolveInitialTheme(null, true)).toBe('light');
      expect(resolveInitialTheme(null, false)).toBe('dark');
    });
    it('ignores a saved invalid value and uses the hint', () => {
      expect(resolveInitialTheme('chartreuse', true)).toBe('light');
      expect(resolveInitialTheme('chartreuse', false)).toBe('dark');
      expect(resolveInitialTheme(undefined, false)).toBe('dark');
    });
  });

  describe('persistence', () => {
    beforeEach(() => installLocalStorage());
    afterEach(() => vi.unstubAllGlobals());

    it('round-trips a saved theme', () => {
      expect(loadTheme()).toBeNull();
      saveTheme('light');
      expect(loadTheme()).toBe('light');
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    });

    it('loadTheme returns null for a corrupt stored value', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'neon');
      expect(loadTheme()).toBeNull();
    });

    it('resolveInitialTheme consumes a saved value end-to-end', () => {
      saveTheme('light');
      expect(resolveInitialTheme(loadTheme(), false)).toBe('light');
    });
  });

  describe('storage unavailable (SSR / no localStorage)', () => {
    beforeEach(() => vi.stubGlobal('localStorage', undefined));
    afterEach(() => vi.unstubAllGlobals());

    it('loadTheme returns null and saveTheme does not throw', () => {
      expect(loadTheme()).toBeNull();
      expect(() => saveTheme('light')).not.toThrow();
    });
  });

  describe('storage that throws (private mode / quota)', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('loadTheme swallows getItem errors', () => {
      vi.stubGlobal('localStorage', {
        getItem: () => {
          throw new Error('SecurityError');
        },
        setItem: () => {},
      });
      expect(loadTheme()).toBeNull();
    });

    it('saveTheme swallows setItem errors', () => {
      vi.stubGlobal('localStorage', {
        getItem: () => null,
        setItem: () => {
          throw new Error('QuotaExceeded');
        },
      });
      expect(() => saveTheme('light')).not.toThrow();
    });
  });
});
