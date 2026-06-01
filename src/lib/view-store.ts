/**
 * Shared UI state across Astro islands (the header nav lives in Layout.astro,
 * the studio is a separate island). A Svelte store in this shared module is a
 * singleton on the page, so both islands read/write the same state.
 */
import { writable } from 'svelte/store';

/** Which preview the studio shows. Driven by the nav switch in the header. */
export const previewView = writable<'svg' | 'ascii'>('svg');

/** True once an image is loaded — the nav switch only shows then. */
export const hasImage = writable(false);
