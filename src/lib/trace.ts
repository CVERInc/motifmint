// IMPORTANT: this module pulls in the wasm_vtracer wasm. It MUST only be
// imported from the worker (`trace.worker.ts`), never from main-thread
// code, otherwise the wasm gets duplicated into the page bundle.
//
// For main-thread image decoding, see `./decode.ts`.

import { TracerConfig, convertImageToSvg, init, isReady } from 'wasm_vtracer';
import { applyParams, type TracerParams } from './presets';

let initialized = false;

function ensureInit(): void {
  if (!initialized && !isReady()) {
    init();
    initialized = true;
  }
}

export function traceImage(
  pixels: Uint8Array,
  width: number,
  height: number,
  params: TracerParams,
): string {
  ensureInit();
  const config = new TracerConfig();
  applyParams(config, params);
  try {
    return convertImageToSvg(pixels, width, height, config);
  } finally {
    config.free();
  }
}
