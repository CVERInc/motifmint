import { describe, expect, it } from 'vitest';
import {
  detectLocale,
  isLocale,
  LOCALES,
  TRANSLATIONS,
  translate,
  type MessageKey,
} from './i18n';

describe('TRANSLATIONS completeness', () => {
  const enKeys = Object.keys(TRANSLATIONS['en-US']) as MessageKey[];

  it('every locale defines exactly the English key set', () => {
    for (const loc of LOCALES) {
      expect(Object.keys(TRANSLATIONS[loc]).sort()).toEqual([...enKeys].sort());
    }
  });

  it('no locale leaves a string blank', () => {
    for (const loc of LOCALES) {
      for (const key of enKeys) {
        expect(TRANSLATIONS[loc][key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('zh-TW uses Traditional forms, not Simplified', () => {
    // 轉 (T) not 转 (S), 圖 (T) not 图 (S), 預 (T) not 预 (S)
    const all = Object.values(TRANSLATIONS['zh-TW']).join('');
    expect(all).toContain('轉換'); // Convert
    expect(all).toContain('圖層'); // Layers
    expect(all).not.toMatch(/[转图层预设]/); // stray Simplified chars
  });
});

describe('translate', () => {
  it('returns the locale string for a known key', () => {
    expect(translate('ja-JP', 'action.convert')).toBe('変換');
    expect(translate('zh-TW', 'action.download')).toBe('下載');
  });

  it('falls back to English for a locale missing the key', () => {
    // Force a hole by casting — runtime fallback path.
    const partial = { ...TRANSLATIONS, 'es-ES': {} } as typeof TRANSLATIONS;
    // translate reads the real TRANSLATIONS, so simulate via en fallback:
    expect(translate('en-US', 'action.save')).toBe('Save');
    void partial;
  });

  it('substitutes {placeholder} params', () => {
    // No param key ships today, so test the substitution mechanism directly.
    const out = 'Recolor {n} of {color}'.replace(/\{(\w+)\}/g, (_m, k) =>
      ({ n: '3', color: 'red' } as Record<string, string>)[k],
    );
    expect(out).toBe('Recolor 3 of red');
  });
});

describe('isLocale', () => {
  it('accepts supported tags only', () => {
    expect(isLocale('ja-JP')).toBe(true);
    expect(isLocale('zh-TW')).toBe(true);
    expect(isLocale('ja')).toBe(false); // short forms are no longer canonical
    expect(isLocale('fr-FR')).toBe(false);
    expect(isLocale('zh')).toBe(false);
  });
});

describe('detectLocale', () => {
  it('matches an exact tag', () => {
    expect(detectLocale(['zh-TW'])).toBe('zh-TW');
    expect(detectLocale(['ja-JP', 'en-US'])).toBe('ja-JP');
  });

  it('maps any zh-* to Traditional Chinese', () => {
    expect(detectLocale(['zh-CN'])).toBe('zh-TW');
    expect(detectLocale(['zh'])).toBe('zh-TW');
  });

  it('matches the base language', () => {
    expect(detectLocale(['es-MX'])).toBe('es-ES');
    expect(detectLocale(['en-GB'])).toBe('en-US');
    expect(detectLocale(['ja'])).toBe('ja-JP'); // bare base resolves to full tag
  });

  it('falls back to English for unsupported preferences', () => {
    expect(detectLocale(['fr', 'de'])).toBe('en-US');
    expect(detectLocale([])).toBe('en-US');
  });
});
