import type { TracerParams } from './presets';

const STORAGE_KEY = 'motifmint:custom-presets';

export interface CustomPreset {
  name: string;
  params: TracerParams;
  createdAt: number;
}

export function loadCustomPresets(): CustomPreset[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is CustomPreset =>
        typeof p === 'object' &&
        p !== null &&
        typeof p.name === 'string' &&
        typeof p.params === 'object',
    );
  } catch {
    return [];
  }
}

export function saveCustomPresets(presets: CustomPreset[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export function addCustomPreset(name: string, params: TracerParams): CustomPreset[] {
  const existing = loadCustomPresets();
  const trimmed = name.trim();
  if (!trimmed) return existing;
  // Replace if same name already exists
  const next = existing.filter((p) => p.name !== trimmed);
  next.push({ name: trimmed, params: { ...params }, createdAt: Date.now() });
  saveCustomPresets(next);
  return next;
}

export function removeCustomPreset(name: string): CustomPreset[] {
  const next = loadCustomPresets().filter((p) => p.name !== name);
  saveCustomPresets(next);
  return next;
}
