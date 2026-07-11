/// <reference lib="webworker" />
import { traceImage } from './trace';
import { stripBoundingBoxArtifact, normalizeFills, mergeNearColors } from './strip-artifact';
import { optimizeSvg } from './svgo';
import type { TracerParams } from './presets';

declare const self: DedicatedWorkerGlobalScope;

export interface WorkerRequest {
  id: number;
  /** RGBA bytes, transferred. May be omitted on a re-trace of the cached image. */
  pixels?: ArrayBuffer;
  /** When set alongside `pixels`, the worker keeps them (single slot) so later
   *  re-traces of the same image — every live-preview param change — can omit
   *  `pixels` instead of copying + transferring the full buffer each time. */
  cacheKey?: number;
  width: number;
  height: number;
  params: TracerParams;
  optimize: boolean;
}

export type WorkerResponse =
  | { id: number; type: 'done'; svg: string; durationMs: number }
  | { id: number; type: 'error'; message: string };

// The one image being re-traced (the base of the composition). Layer traces
// send their pixels one-shot (no cacheKey) and are never stored.
let cachedPixels: { key: number; arr: Uint8Array } | null = null;

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, pixels, cacheKey, width, height, params, optimize } = e.data;
  const t0 = performance.now();
  try {
    let arr: Uint8Array;
    if (pixels) {
      arr = new Uint8Array(pixels);
      if (cacheKey !== undefined) cachedPixels = { key: cacheKey, arr };
    } else if (cacheKey !== undefined && cachedPixels?.key === cacheKey) {
      arr = cachedPixels.arr;
    } else {
      throw new Error('trace: request omitted pixels but no cached image matches');
    }
    let svg = traceImage(arr, width, height, params);
    if (optimize) {
      svg = optimizeSvg(svg);
    }
    // Post-processing pipeline (always runs, regardless of SVGO):
    //   1. Strip the composite-bg artifact (full viewBox white rect)
    //   2. Normalize fills (paths missing fill attr → fill="#000000")
    //   3. Cluster near-identical colors so Recolor shows 1 swatch per
    //      perceptual color, not 4 near-black shades.
    svg = stripBoundingBoxArtifact(svg);
    svg = normalizeFills(svg);
    svg = mergeNearColors(svg, 24);
    const res: WorkerResponse = {
      id,
      type: 'done',
      svg,
      durationMs: performance.now() - t0,
    };
    self.postMessage(res);
  } catch (err) {
    const res: WorkerResponse = {
      id,
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(res);
  }
};
