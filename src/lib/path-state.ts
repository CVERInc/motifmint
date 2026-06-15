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
    // `(?<![-:\w])` so `data-fill`/`xlink:fill` aren't read as the real fill.
    const fillM = attrs.match(/(?<![-:\w])fill\s*=\s*["']([^"']+)["']/);
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
        if (/(?<![-:\w])fill\s*=\s*["'][^"']*["']/i.test(attrs)) {
          return `<path${attrs.replace(/(?<![-:\w])fill\s*=\s*["'][^"']*["']/i, 'fill="#ef4444"')}${marker}${slash}>`;
        }
        return `<path${attrs} fill="#ef4444"${marker}${slash}>`;
      }
      if (/(?<![-:\w])fill\s*=\s*["'][^"']*["']/i.test(attrs)) {
        return `<path${attrs.replace(/(?<![-:\w])fill\s*=\s*["'][^"']*["']/i, 'fill="none"')}${slash}>`;
      }
      return `<path${attrs} fill="none"${slash}>`;
    }

    const state = states.get(idx);
    if (!state?.fill) return match;
    if (/(?<![-:\w])fill\s*=\s*["'][^"']*["']/i.test(attrs)) {
      const next = attrs.replace(/(?<![-:\w])fill\s*=\s*["'][^"']*["']/i, `fill="${state.fill}"`);
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

/** Returns a new Map with the path's state cleaned up if it becomes empty. */
function compactState(states: Map<number, PathState>, idx: number): Map<number, PathState> {
  const next = new Map(states);
  const s = next.get(idx);
  if (!s) return next;
  if (s.fill === undefined && !s.removed) {
    next.delete(idx);
  } else {
    next.set(idx, s);
  }
  return next;
}

export function setPathFill(
  states: Map<number, PathState>,
  idx: number,
  fill: string | undefined,
): Map<number, PathState> {
  const next = new Map(states);
  const cur = { ...(next.get(idx) ?? {}) };
  cur.fill = fill;
  next.set(idx, cur);
  return compactState(next, idx);
}

export function setPathRemoved(
  states: Map<number, PathState>,
  idx: number,
  removed: boolean,
): Map<number, PathState> {
  const next = new Map(states);
  const cur = { ...(next.get(idx) ?? {}) };
  cur.removed = removed;
  next.set(idx, cur);
  return compactState(next, idx);
}

/** Apply a fill override to every path whose originalFill matches. */
export function bulkSetFill(
  states: Map<number, PathState>,
  pathList: PathInfo[],
  originalFill: string,
  fill: string | undefined,
): Map<number, PathState> {
  let next = states;
  const key = originalFill.toLowerCase();
  for (const p of pathList) {
    if (p.originalFill === key) {
      next = setPathFill(next, p.origIdx, fill);
    }
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
  let next = states;
  const key = originalFill.toLowerCase();
  for (const p of pathList) {
    if (p.originalFill === key) {
      next = setPathRemoved(next, p.origIdx, removed);
    }
  }
  return next;
}
