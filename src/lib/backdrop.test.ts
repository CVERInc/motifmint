import { describe, expect, it } from 'vitest';
import {
  backdropCss,
  backdropHex,
  backdropVisible,
  bakeBackdrop,
  DEFAULT_BACKDROP,
  readViewBox,
  type BackdropOpts,
} from './backdrop';

describe('backdropVisible', () => {
  it('is false at alpha 0, true above', () => {
    expect(backdropVisible({ ...DEFAULT_BACKDROP, alpha: 0 })).toBe(false);
    expect(backdropVisible({ ...DEFAULT_BACKDROP, alpha: 1 })).toBe(true);
  });
});

describe('backdropCss', () => {
  it('is transparent at alpha 0', () => {
    expect(backdropCss({ ...DEFAULT_BACKDROP, alpha: 0 })).toBe('transparent');
  });

  it('builds an rgba() string', () => {
    expect(backdropCss({ ...DEFAULT_BACKDROP, color: '#ff8000', alpha: 50 })).toBe(
      'rgba(255, 128, 0, 0.500)',
    );
  });
});

describe('backdropHex', () => {
  it('appends an alpha byte', () => {
    expect(backdropHex({ ...DEFAULT_BACKDROP, color: '#112233', alpha: 100 })).toBe('#112233ff');
    expect(backdropHex({ ...DEFAULT_BACKDROP, color: '#112233', alpha: 0 })).toBe('#11223300');
    expect(backdropHex({ ...DEFAULT_BACKDROP, color: '#112233', alpha: 50 })).toBe('#11223380');
  });
});

describe('readViewBox', () => {
  it('parses a viewBox attribute', () => {
    expect(readViewBox('<svg viewBox="0 0 64 48">')).toEqual({ x: 0, y: 0, w: 64, h: 48 });
  });

  it('handles comma-separated values', () => {
    expect(readViewBox('<svg viewBox="1, 2, 3, 4">')).toEqual({ x: 1, y: 2, w: 3, h: 4 });
  });

  it('falls back to width/height', () => {
    expect(readViewBox('<svg width="100" height="200">')).toEqual({ x: 0, y: 0, w: 100, h: 200 });
  });

  it('returns null when nothing is parseable', () => {
    expect(readViewBox('<svg>')).toBeNull();
  });
});

describe('bakeBackdrop', () => {
  const base = '<svg viewBox="0 0 80 40"><path d="M0 0"/></svg>';

  it('is a no-op when invisible and aspect unchanged', () => {
    expect(bakeBackdrop(base, DEFAULT_BACKDROP)).toBe(base);
  });

  it('inserts a backdrop rect when visible', () => {
    const out = bakeBackdrop(base, { ...DEFAULT_BACKDROP, alpha: 100 });
    expect(out).toContain('<rect x="0" y="0" width="80" height="40"');
    expect(out).toContain('fill="#ffffffff"');
  });

  it('squares the viewBox when aspect=square', () => {
    const out = bakeBackdrop(base, { ...DEFAULT_BACKDROP, aspect: 'square' });
    // side = max(80,40)=80, y shifted up by (80-40)/2 = 20
    expect(out).toContain('viewBox="0 -20 80 80"');
  });

  it('expands the viewBox for padding', () => {
    const out = bakeBackdrop(base, { ...DEFAULT_BACKDROP, alpha: 100, padding: 10 });
    // padPx = 10% of max(80,40)=8 → x/y -8, w/h +16
    expect(out).toContain('viewBox="-8 -8 96 56"');
  });

  it('adds rounded corners when radius set', () => {
    const out = bakeBackdrop(base, { ...DEFAULT_BACKDROP, alpha: 100, radius: 25 });
    // rx = 25% of min(80,40)=10
    expect(out).toContain('rx="10"');
  });

  it('strips width/height from the svg tag', () => {
    const out = bakeBackdrop('<svg width="80" height="40" viewBox="0 0 80 40"></svg>', {
      ...DEFAULT_BACKDROP,
      alpha: 100,
    });
    expect(out).not.toMatch(/<svg[^>]*\swidth=/);
    expect(out).not.toMatch(/<svg[^>]*\sheight=/);
  });
});
