/**
 * Theme model — pure, framework-free, unit-tested in plain Node.
 *
 * The reactive Svelte wrapper (apply `data-theme`, persist) lives in
 * `theme-store.ts`, mirroring the i18n split (`i18n.ts` / `i18n-store.ts`).
 *
 * Two themes only: the default deep-teal `dark` and a `light` variant.
 * The actual colour tokens are CSS variables overridden under
 * `:root[data-theme='light']` in `Layout.astro` — this module only decides
 * *which* theme string is active and remembers it.
 */

export const THEMES = ['dark', 'light'] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = 'dark';

export const THEME_STORAGE_KEY = 'motifmint:theme';

/** Narrow an arbitrary value to a known `Theme`. */
export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

/**
 * Decide the theme to start with.
 *
 * Priority:
 *   1. A previously saved, valid choice (explicit user intent wins).
 *   2. The OS `prefers-color-scheme: light` hint.
 *   3. The default (`dark`).
 *
 * Pure so it can be tested without a DOM: pass the saved string and the
 * media-query result in directly.
 */
export function resolveInitialTheme(
  saved: string | null | undefined,
  prefersLight: boolean,
): Theme {
  if (isTheme(saved)) return saved;
  return prefersLight ? 'light' : DEFAULT_THEME;
}

/** Flip to the other theme. */
export function toggleTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark';
}

/** Read the persisted theme, or `null` if absent/unavailable/invalid. */
export function loadTheme(): Theme | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** Persist the chosen theme (no-op when storage is unavailable). */
export function saveTheme(theme: Theme): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* private mode / quota — non-fatal, the choice just won't persist */
  }
}
