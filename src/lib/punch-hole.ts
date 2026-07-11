/**
 * Pathfinder-style path removal:
 *   • If the target path is enclosed by another visible path, MERGE it into
 *     that parent via SVG even-odd fill rule → produces a real hole the
 *     backdrop can show through.
 *   • Otherwise, fall back to `fill="none"` (just makes it invisible).
 *
 * Geometric containment uses the browser's native `isPointInFill()` on an
 * off-DOM render of the SVG.
 *
 * Targets are referenced by **original index** in document order — we mark
 * each path with `data-orig-idx` before processing so the function can find
 * them even after prior merges have removed siblings.
 */

/**
 * Inject `data-orig-idx="N"` into every `<path>` so we can refer to the
 * original position later, even after some paths have been merged away.
 * Idempotent — won't double-inject if already present.
 */
export function injectOrigIdx(svg: string): string {
  if (/<path\b[^>]*\bdata-orig-idx=/i.test(svg)) return svg;
  let i = 0;
  return svg.replace(/<path\b/gi, () => `<path data-orig-idx="${i++}"`);
}

/**
 * Remove (punch into parent, else hide) all paths whose original index
 * is in `targetOrigIndices`. Returns the modified SVG string.
 *
 * `svg` MUST have been processed with `injectOrigIdx` first.
 */
export function removePaths(svg: string, targetOrigIndices: number[]): string {
  if (targetOrigIndices.length === 0) return svg;
  if (typeof document === 'undefined') return svg;
  // Pure in (svg, targets) but expensive: off-DOM mount + per-target geometry
  // queries against every path. The display pipeline re-runs it with identical
  // inputs on every effect/backdrop tweak — one memo slot absorbs those.
  const key = targetOrigIndices.join(',');
  if (memoized && memoized.svg === svg && memoized.key === key) return memoized.out;
  const out = removePathsUncached(svg, targetOrigIndices);
  memoized = { svg, key, out };
  return out;
}

let memoized: { svg: string; key: string; out: string } | null = null;

function removePathsUncached(svg: string, targetOrigIndices: number[]): string {
  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-99999px';
  wrapper.style.width = '1px';
  wrapper.style.height = '1px';
  wrapper.style.visibility = 'hidden';
  wrapper.innerHTML = svg;
  const svgEl = wrapper.querySelector('svg') as SVGSVGElement | null;
  if (!svgEl) return svg;
  document.body.appendChild(wrapper);

  try {
    const targetSet = new Set(targetOrigIndices);
    const allPaths = Array.from(svgEl.querySelectorAll('path[data-orig-idx]')) as SVGPathElement[];

    // Index paths by their original idx for fast lookup.
    const byOrigIdx = new Map<number, SVGPathElement>();
    for (const p of allPaths) {
      const idx = parseInt(p.getAttribute('data-orig-idx') ?? '-1', 10);
      if (idx >= 0) byOrigIdx.set(idx, p);
    }

    // For each target, decide punch-or-hide.
    type MergeOp = { parent: SVGPathElement; childD: string; child: SVGPathElement };
    const punches: MergeOp[] = [];
    const hides: SVGPathElement[] = [];

    for (const origIdx of targetOrigIndices) {
      const child = byOrigIdx.get(origIdx);
      if (!child) continue;

      const bb = child.getBBox();
      const pt = svgEl.createSVGPoint();
      pt.x = bb.x + bb.width / 2;
      pt.y = bb.y + bb.height / 2;

      // Find smallest enclosing parent that is NOT itself a target.
      let bestParent: SVGPathElement | null = null;
      let bestArea = Infinity;
      for (const candidate of allPaths) {
        if (candidate === child) continue;
        const cIdx = parseInt(candidate.getAttribute('data-orig-idx') ?? '-1', 10);
        if (targetSet.has(cIdx)) continue;
        try {
          if (!candidate.isPointInFill(pt)) continue;
        } catch {
          continue;
        }
        const cb = candidate.getBBox();
        const area = cb.width * cb.height;
        if (area < bestArea) {
          bestArea = area;
          bestParent = candidate;
        }
      }

      if (bestParent) {
        const childD = child.getAttribute('d') ?? '';
        if (childD) punches.push({ parent: bestParent, childD, child });
        else hides.push(child);
      } else {
        hides.push(child);
      }
    }

    // Apply punches: merge child d into parent + evenodd, remove child.
    // Group by parent for fewer rewrites.
    const punchedByParent = new Map<SVGPathElement, string[]>();
    const consumedChildren = new Set<SVGPathElement>();
    for (const op of punches) {
      const list = punchedByParent.get(op.parent) ?? [];
      list.push(op.childD);
      punchedByParent.set(op.parent, list);
      consumedChildren.add(op.child);
    }
    punchedByParent.forEach((extraDs, parent) => {
      const baseD = parent.getAttribute('d') ?? '';
      parent.setAttribute('d', [baseD, ...extraDs].filter(Boolean).join(' '));
      parent.setAttribute('fill-rule', 'evenodd');
    });
    consumedChildren.forEach((c) => c.remove());

    // Apply hides: set fill="none" on remaining targets.
    for (const h of hides) {
      h.setAttribute('fill', 'none');
    }

    return new XMLSerializer().serializeToString(svgEl);
  } finally {
    wrapper.remove();
  }
}
