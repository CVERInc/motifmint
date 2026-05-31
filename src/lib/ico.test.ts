import { describe, expect, it } from 'vitest';
import { buildIco } from './ico';

// A tiny fake "PNG" payload — buildIco doesn't parse it, it only embeds bytes.
const fakePng = (n: number, fill: number) => new Uint8Array(n).fill(fill);

describe('buildIco', () => {
  it('throws on an empty image list', () => {
    expect(() => buildIco([])).toThrow();
  });

  it('writes a valid ICONDIR header', () => {
    const ico = buildIco([{ size: 16, png: fakePng(4, 0xaa) }]);
    const view = new DataView(ico.buffer);
    expect(view.getUint16(0, true)).toBe(0); // reserved
    expect(view.getUint16(2, true)).toBe(1); // type = icon
    expect(view.getUint16(4, true)).toBe(1); // count
  });

  it('lays out entries and appends image bytes at the right offset', () => {
    const a = fakePng(4, 0x11);
    const b = fakePng(6, 0x22);
    const ico = buildIco([
      { size: 16, png: a },
      { size: 32, png: b },
    ]);
    const view = new DataView(ico.buffer);

    const dirSize = 6 + 16 * 2; // header + 2 entries = 38
    // entry 0
    expect(view.getUint8(6 + 0)).toBe(16); // width
    expect(view.getUint8(6 + 1)).toBe(16); // height
    expect(view.getUint16(6 + 6, true)).toBe(32); // bpp
    expect(view.getUint32(6 + 8, true)).toBe(4); // bytesInRes
    expect(view.getUint32(6 + 12, true)).toBe(dirSize); // offset
    // entry 1 offset = dirSize + len(a)
    expect(view.getUint32(6 + 16 + 12, true)).toBe(dirSize + 4);

    // payload bytes land where the offsets say
    expect(ico[dirSize]).toBe(0x11);
    expect(ico[dirSize + 4]).toBe(0x22);
    expect(ico.length).toBe(dirSize + 4 + 6);
  });

  it('encodes 256px as the byte 0', () => {
    const ico = buildIco([{ size: 256, png: fakePng(2, 0) }]);
    const view = new DataView(ico.buffer);
    expect(view.getUint8(6 + 0)).toBe(0);
    expect(view.getUint8(6 + 1)).toBe(0);
  });
});
