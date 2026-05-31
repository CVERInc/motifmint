/**
 * Reactive locale state for Svelte components.
 *
 * Kept separate from the pure `i18n.ts` (which has no framework dep and is
 * unit-tested) so the dictionary/translate logic stays testable in plain Node.
 *
 * Usage in a component:
 *   import { locale, t } from '~/lib/i18n-store';
 *   <h1>{$t('hero.title')}</h1>
 *   <button onclick={() => locale.set('ja')}>日本語</button>
 */
import { derived, writable } from 'svelte/store';
import {
  DEFAULT_LOCALE,
  detectLocale,
  isLocale,
  translate,
  type Locale,
  type MessageKey,
} from './i18n';

const STORAGE_KEY = 'markmint:locale';

function initialLocale(): Locale {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && isLocale(saved)) return saved;
  }
  return detectLocale();
}

export const locale = writable<Locale>(
  typeof window === 'undefined' ? DEFAULT_LOCALE : initialLocale(),
);

// Persist the user's choice (browser only).
locale.subscribe((value) => {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* storage may be unavailable (private mode) — non-fatal */
    }
  }
});

/** `$t('key', params?)` — reactive translator bound to the current locale. */
export const t = derived(
  locale,
  ($locale) =>
    (key: MessageKey, params?: Record<string, string | number>): string =>
      translate($locale, key, params),
);
