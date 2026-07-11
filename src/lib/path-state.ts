/**
 * Per-path state model: each path (identified by its original document
 * index, tagged via `data-orig-idx`) carries an optional fill override
 * and/or a removal flag. This replaces the per-color recolor and per-path
 * remove sets with a unified model that matches how users actually think
 * ("change this shape", not "change this color bucket").
 *
 * The pipeline:
 *   raw svg → injectOrigIdx → applyPathOverrides → removePaths → display
 *
 * Per-color bulk operations (e.g. "change all black to white") are
 * implemented by writing the same fill override into every path that
 * originally shared that color.
 */

export interface PathState {
  /** Override fill color (hex). Falsy / undefined = use original. */
  fill?: string;
  /** Hide this path (will be punched into parent if enclosed, else fill=none). */
  removed?: boolean;
}

export interface PathInfo {
  origIdx: number;
  /** Original fill as it came out of the worker (post-trace, post-mergeNearColors). */
  originalFill: string;
}

/** Read every `<path data-orig-idx="..." fill="...">` from the tagged SVG. */
export function parsePathList(taggedSvg: string): PathInfo[] {
  const out: PathInfo[] = [];
  const re = /<path\b([^>]*?)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(taggedSvg)) !== null) {
    const attrs = m[1];
    const idxM = attrs.match(/\bdata-orig-idx\s*=\s*["'](\d+)["']/);
    if (!idxM) continue;
    const idx = parseInt(idxM[1], 10);
    const fillM = attrs.match(/\bfill\s*=\s*["']([^"']+)["']/);
    let fill = fillM?.[1] ?? '#000000';
    fill = fill.toLowerCase();
    out.push({ origIdx: idx, originalFill: fill });
  }
  return out;
}

/**
 * Apply per-path fill overrides. Paths whose `data-orig-idx` is in `states`
 * and has a `fill` get their `fill` attribute rewritten.
 */
export function applyPathOverrides(
  svg: string,
  states: Map<number, PathState>,
  autoHideIdxs?: Set<number>,
  previewMode: boolean = false,
): string {
  if (states.size === 0 && (!autoHideIdxs || autoHideIdxs.size === 0)) return svg;
  return svg.replace(/<path\b([^>]*?)(\/?)>/gi, (match, attrs: string, slash: string) => {
    const idxM = attrs.match(/\bdata-orig-idx\s*=\s*["'](\d+)["']/);
    if (!idxM) return match;
    const idx = parseInt(idxM[1], 10);

    // If auto-hidden by speckle filter
    if (autoHideIdxs && autoHideIdxs.has(idx)) {
      // Preview mode: highlight the path in red instead of hiding it, so the
      // user can see exactly which paths the slider would remove.
      if (previewMode) {
        const marker = ' data-preview-remove="1"';
        if (/\bfill\s*=\s*["'][^"']*["']/i.test(attrs)) {
          return `<path${attrs.replace(/\bfill\s*=\s*["'][^"']*["']/i, 'fill="#ef4444"')}${marker}${slash}>`;
        }
        return `<path${attrs} fill="#ef4444"${marker}${slash}>`;
      }
      if (/\bfill\s*=\s*["'][^"']*["']/i.test(attrs)) {
        return `<path${attrs.replace(/\bfill\s*=\s*["'][^"']*["']/i, 'fill="none"')}${slash}>`;
      }
      return `<path${attrs} fill="none"${slash}>`;
    }

    const state = states.get(idx);
    if (!state?.fill) return match;
    if (/\bfill\s*=\s*["'][^"']*["']/i.test(attrs)) {
      const next = attrs.replace(/\bfill\s*=\s*["'][^"']*["']/i, `fill="${state.fill}"`);
      return `<path${next}${slash}>`;
    }
    return `<path${attrs} fill="${state.fill}"${slash}>`;
  });
}

/** Indices of paths the user has marked as removed. */
export function collectRemoved(states: Map<number, PathState>): number[] {
  const out: number[] = [];
  for (const [idx, s] of states) {
    if (s.removed) out.push(idx);
  }
  return out;
}

/**
 * Write a patch into `next` IN PLACE, dropping the entry when it becomes
 * empty. Callers clone once and may then write any number of paths — bulk
 * operations stay O(paths), not O(paths × states).
 */
function writeState(next: Map<number, PathState>, idx: number, patch: Partial<PathState>): void {
  const cur = { ...(next.get(idx) ?? {}), ...patch };
  if (cur.fill === undefined && !cur.removed) next.delete(idx);
  else next.set(idx, cur);
}

export function setPathFill(
  states: Map<number, PathState>,
  idx: number,
  fill: string | undefined,
): Map<number, PathState> {
  const next = new Map(states);
  writeState(next, idx, { fill });
  return next;
}

export function setPathRemoved(
  states: Map<number, PathState>,
  idx: number,
  removed: boolean,
): Map<number, PathState> {
  const next = new Map(states);
  writeState(next, idx, { removed });
  return next;
}

/** Mark a whole set of paths (e.g. a marquee selection) removed / restored. */
export function setPathsRemoved(
  states: Map<number, PathState>,
  idxs: Iterable<number>,
  removed: boolean,
): Map<number, PathState> {
  const next = new Map(states);
  for (const idx of idxs) writeState(next, idx, { removed });
  return next;
}

/** Apply a fill override to every path whose originalFill matches. */
export function bulkSetFill(
  states: Map<number, PathState>,
  pathList: PathInfo[],
  originalFill: string,
  fill: string | undefined,
): Map<number, PathState> {
  const key = originalFill.toLowerCase();
  const next = new Map(states);
  for (const p of pathList) {
    if (p.originalFill === key) writeState(next, p.origIdx, { fill });
  }
  return next;
}

/** Hide / unhide every path whose originalFill matches. */
export function bulkSetRemoved(
  states: Map<number, PathState>,
  pathList: PathInfo[],
  originalFill: string,
  removed: boolean,
): Map<number, PathState> {
  const key = originalFill.toLowerCase();
  const next = new Map(states);
  for (const p of pathList) {
    if (p.originalFill === key) writeState(next, p.origIdx, { removed });
  }
  return next;
}
