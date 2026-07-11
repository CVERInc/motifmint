/**
 * Decode a File (PNG/JPG/WebP/...) into raw RGBA pixel data via the browser's
 * Canvas API. Lives on the main thread (no wasm dependency).
 *
 * Transparent pixels in the source are pre-composited against `bgColor`
 * (default white). This is critical for VTracer — it traces RGB, not alpha,
 * so a transparent PNG with a black foreground would otherwise look like
 * "all black" to the tracer (RGB=000 everywhere, alpha just varies) and
 * trace nothing.
 */
/**
 * Longest edge the tracer ever sees. Tracing works on shapes, not pixels — a
 * 2048px source resolves the same paths as a 12MP photo of it, while the RGBA
 * buffer (and VTracer's runtime) grows with the square of the edge: 12MP is a
 * ~48MB buffer and a many-second trace for no visible gain in the vector.
 */
export const MAX_TRACE_EDGE = 2048;

export async function decodeImage(
  file: File,
  bgColor: string = '#ffffff',
): Promise<{ data: Uint8Array; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_TRACE_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2D context');
  // Pre-fill so any transparent regions in the source become this color
  // BEFORE the source is drawn on top.
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const imageData = ctx.getImageData(0, 0, width, height);
  return { data: new Uint8Array(imageData.data.buffer), width, height };
}
