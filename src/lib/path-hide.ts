/**
 * Per-path hide: lets the user click an individual `<path>` in the preview
 * to make just that one transparent (`fill="none"`), without affecting
 * other paths that happen to share the same color.
 *
 * This complements the color-based Recolor: useful when a color appears in
 * multiple semantic regions (e.g. the inside of an "R" bowl AND the page
 * background), and you only want to hide one of them.
 *
 * Paths are identified by their index in document order in the rendered SVG.
 * That index is stable as long as the source SVG doesn't change. When the
 * user re-traces (preset / params change), the worker emits a fresh SVG and
 * the path set should be reset.
 */
export function applyPathHides(svg: string, hidden: Set<number>): string {
  if (hidden.size === 0) return svg;
  let i = 0;
  return svg.replace(/<path\b([^>]*?)(\/?)>/gi, (match, attrs: string, slash: string) => {
    const idx = i++;
    if (!hidden.has(idx)) return match;
    // `(?<![-:\w])` so `data-fill`/`xlink:fill` aren't mistaken for the fill.
    if (/(?<![-:\w])fill\s*=\s*["'][^"']*["']/i.test(attrs)) {
      return `<path${attrs.replace(/(?<![-:\w])fill\s*=\s*["'][^"']*["']/i, 'fill="none"')}${slash}>`;
    }
    return `<path${attrs} fill="none"${slash}>`;
  });
}
