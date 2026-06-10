/**
 * User-saved gradient presets (localStorage), mirroring custom-presets.ts.
 * Lets people reuse a gradient across colors / sessions.
 */
import type { GradientSpec } from './gradient';

const STORAGE_KEY = 'motifmint:gradient-presets';

export interface SavedGradient {
  name: string;
  spec: GradientSpec;
  createdAt: number;
}

function isGradientSpec(v: unknown): v is GradientSpec {
  return (
    typeof v === 'object' &&
    v !== null &&
    Array.isArray((v as GradientSpec).stops) &&
    typeof (v as GradientSpec).angle === 'number'
  );
}

export function loadGradientPresets(): SavedGradient[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is SavedGradient =>
        typeof p === 'object' && p !== null && typeof p.name === 'string' && isGradientSpec(p.spec),
    );
  } catch {
    return [];
  }
}

export function saveGradientPresets(presets: SavedGradient[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    /* storage unavailable — non-fatal */
  }
}

/** Add (or replace by name) a gradient preset; returns the new list. */
export function addGradientPreset(name: string, spec: GradientSpec, now: number): SavedGradient[] {
  const trimmed = name.trim();
  if (!trimmed) return loadGradientPresets();
  const next = loadGradientPresets().filter((p) => p.name !== trimmed);
  next.push({ name: trimmed, spec: structuredClone(spec), createdAt: now });
  saveGradientPresets(next);
  return next;
}

export function removeGradientPreset(name: string): SavedGradient[] {
  const next = loadGradientPresets().filter((p) => p.name !== name);
  saveGradientPresets(next);
  return next;
}
