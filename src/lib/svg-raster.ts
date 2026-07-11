/**
 * Shared SVG-string → canvas rasterization for every export path (PNG/JPEG/
 * WebP downloads, icon-pack tiles, ASCII pixel sampling). One Image-load
 * pipeline, one owner of the object-URL lifecycle and the load-error message.
 */
import { readViewBox } from './backdrop';

/** Aspect ratio (w/h) from the SVG's viewBox; 1 when absent or degenerate. */
export function svgAspect(svg: string): number {
  const vb = readViewBox(svg);
  return vb && vb.h > 0 ? vb.w / vb.h : 1;
}

/** Integer (w,h) of aspect `ar` fit inside a box whose long edge is `longest`. */
export function fitDims(ar: number, longest: number): { w: number; h: number } {
  const w = ar >= 1 ? longest : Math.max(1, Math.round(longest * ar));
  const h = ar >= 1 ? Math.max(1, Math.round(longest / ar)) : longest;
  return { w, h };
}

/** Give the root <svg> explicit pixel dims so an <img> rasterizes at full res. */
export function sizeSvg(svg: string, w: number, h: number): string {
  return svg.replace(
    /<svg([^>]*)>/i,
    (_m, attrs: string) =>
      `<svg${attrs.replace(/\s(?:width|height)\s*=\s*"[^"]*"/gi, '')} width="${w}" height="${h}">`,
  );
}

export interface SvgDrawOpts {
  /** Pixel size the SVG is rendered at. */
  w: number;
  h: number;
  /** Canvas size when it differs from the render size (e.g. square icon tiles). */
  canvasW?: number;
  canvasH?: number;
  /** Where the render lands on the canvas. */
  dx?: number;
  dy?: number;
  /** Flatten transparency onto this colour first (JPEG has no alpha). */
  background?: string;
}

/** Render an SVG string onto a fresh canvas. Browser-only. */
export async function svgToCanvas(svg: string, opts: SvgDrawOpts): Promise<HTMLCanvasElement> {
  const { w, h, canvasW = w, canvasH = h, dx = 0, dy = 0, background } = opts;
  const url = URL.createObjectURL(
    new Blob([sizeSvg(svg, w, h)], { type: 'image/svg+xml;charset=utf-8' }),
  );
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Could not render SVG'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not available');
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvasW, canvasH);
    }
    ctx.drawImage(img, dx, dy, w, h);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Promise wrapper over canvas.toBlob that rejects instead of yielding null. */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type?: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Export failed'))), type, quality),
  );
}
