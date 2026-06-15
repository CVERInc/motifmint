/**
 * Reactive theme state, shared across Astro islands (a singleton on the page,
 * like view-store / i18n-store).
 *
 * Responsibilities the pure `theme.ts` deliberately doesn't have:
 *   - read the OS `prefers-color-scheme` hint,
 *   - reflect the active theme onto `<html data-theme>` so the global CSS
 *     variable overrides in Layout.astro take effect,
 *   - persist the user's choice to localStorage.
 */
import { writable } from 'svelte/store';
import {
  DEFAULT_THEME,
  loadTheme,
  resolveInitialTheme,
  saveTheme,
  toggleTheme as flip,
  type Theme,
} from './theme';

function prefersLight(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches;
  } catch {
    return false;
  }
}

// Keep the browser chrome (status bar / address bar tint) in sync with the
// theme. These two values match Layout.astro's --bg-base tokens.
const THEME_COLOR: Record<Theme, string> = {
  dark: '#052829',
  light: '#eef4f3',
};

function applyToDocument(value: Theme): void {
  if (typeof document === 'undefined' || !document.documentElement) return;
  document.documentElement.setAttribute('data-theme', value);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR[value]);
}

function initialTheme(): Theme {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  return resolveInitialTheme(loadTheme(), prefersLight());
}

export const theme = writable<Theme>(initialTheme());

// Apply + persist on every change (browser only). The first run also reflects
// the resolved initial value onto <html> so SSR'd dark markup gets corrected
// to a remembered light choice on hydration.
theme.subscribe((value) => {
  applyToDocument(value);
  saveTheme(value);
});

/** Flip between dark and light. */
export function toggleTheme(): void {
  theme.update(flip);
}
