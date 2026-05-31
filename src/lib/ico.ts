/**
 * Minimal ICO container builder — pure JS, no dependencies.
 *
 * Modern browsers (and Windows Vista+) accept PNG-compressed images inside an
 * `.ico`, so we don't hand-roll a BMP/DIB encoder: we wrap already-rasterized
 * PNG buffers (produced by the Canvas `toBlob` path) in the classic ICONDIR /
 * ICONDIRENTRY structure and concatenate the PNG payloads.
 *
 * Spec: https://en.wikipedia.org/wiki/ICO_(file_format)
 *   ICONDIR        (6 bytes)  reserved=0, type=1, count
 *   ICONDIRENTRY  (16 bytes)  w, h, palette, reserved, planes, bpp, size, offset
 *   …then each image's bytes, in entry order.
 */

export interface IcoImage {
  /** Square edge length in px (16/32/48/…). 256 is encoded as the byte 0. */
  size: number;
  /** PNG file bytes for this resolution. */
  png: Uint8Array;
}

/** Build a multi-resolution `.ico` (Uint8Array) from PNG buffers. */
export function buildIco(images: IcoImage[]): Uint8Array {
  if (images.length === 0) throw new Error('buildIco: need at least one image');

  const HEADER = 6;
  const ENTRY = 16;
  const dirSize = HEADER + ENTRY * images.length;
  const total = dirSize + images.reduce((n, img) => n + img.png.length, 0);

  const buf = new ArrayBuffer(total);
  const view = new DataView(buf);
  const out = new Uint8Array(buf);

  // ICONDIR
  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type: 1 = icon
  view.setUint16(4, images.length, true); // image count

  let offset = dirSize;
  images.forEach((img, i) => {
    const entry = HEADER + ENTRY * i;
    // 256px is stored as 0 in the single width/height bytes.
    const dim = img.size >= 256 ? 0 : img.size;
    view.setUint8(entry + 0, dim); // width
    view.setUint8(entry + 1, dim); // height
    view.setUint8(entry + 2, 0); // palette colors (0 = no palette)
    view.setUint8(entry + 3, 0); // reserved
    view.setUint16(entry + 4, 1, true); // color planes
    view.setUint16(entry + 6, 32, true); // bits per pixel
    view.setUint32(entry + 8, img.png.length, true); // bytes in resource
    view.setUint32(entry + 12, offset, true); // offset to image data

    out.set(img.png, offset);
    offset += img.png.length;
  });

  return out;
}
