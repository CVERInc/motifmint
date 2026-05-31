/**
 * Integration tests: chain the real lib functions exactly as the studio's
 * buildFinalSvg() / displaySvg do, to prove the features compose correctly.
 * (DOM-only steps — removePaths, canvas rasterize — are excluded; they have
 * their own no-DOM guards and run in CI's build / the maintainer's click-test.)
 */
import { describe, expect, it } from 'vitest';
import { injectOrigIdx } from './punch-hole';
import { parsePathList, applyPathOverrides } from './path-state';
import { applyColorGradients, type GradientSpec } from './gradient';
import { applyEffects } from './effects';
import { bakeBackdrop, type BackdropOpts } from './backdrop';
import { composeLayers } from './compose-layers';
import { toReactComponent, toDataUri } from './copy-as';
import { imageToAscii } from './ascii';

// A worker-style traced SVG: a red full-canvas plate + a blue inner square.
const TRACED =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
  '<path fill="#ff0000" d="M0 0H100V100H0Z"/>' +
  '<path fill="#0000ff" d="M20 20H40V40H20Z"/>' +
  '</svg>';

describe('full export pipeline (recolor → gradient → effects → backdrop)', () => {
  it('composes every edit into one valid SVG', () => {
    const tagged = injectOrigIdx(TRACED);
    const pathList = parsePathList(tagged);
    expect(pathList).toEqual([
      { origIdx: 0, originalFill: '#ff0000' },
      { origIdx: 1, originalFill: '#0000ff' },
    ]);

    // 1. recolor the red plate → green (per-path override on idx 0)
    const overridden = applyPathOverrides(tagged, new Map([[0, { fill: '#00ff00' }]]));

    // 2. radial gradient on the blue group
    const grad: GradientSpec = {
      angle: 90,
      type: 'radial',
      stops: [
        { color: '#0000ff', offset: 0 },
        { color: '#00ffff', offset: 100 },
      ],
    };
    const gradiented = applyColorGradients(overridden, new Map([['#0000ff', grad]]), pathList);

    // 3. strip orig-idx (as buildFinalSvg does)
    const cleaned = gradiented.replace(/\sdata-orig-idx="\d+"/g, '');
    expect(cleaned).not.toContain('data-orig-idx');

    // 4. finishing effects (outline + shadow)
    const styled = applyEffects(cleaned, {
      outline: { width: 3, color: '#000000' },
      shadow: { blur: 2, dx: 0, dy: 2, color: '#000000', opacity: 0.4 },
    });

    // 5. square backdrop with padding + radius
    const backdrop: BackdropOpts = {
      color: '#ffffff',
      alpha: 100,
      radius: 10,
      padding: 5,
      aspect: 'square',
    };
    const final = bakeBackdrop(styled, backdrop);

    // recolor applied
    expect(final).toContain('fill="#00ff00"');
    // radial gradient injected + the blue path repainted with it
    expect(final).toContain('<radialGradient id="mmg-0000ff"');
    expect(final).toContain('fill="url(#mmg-0000ff)"');
    // effects filter wraps the mark
    expect(final).toContain('<filter id="mm-fx"');
    expect(final).toContain('<g filter="url(#mm-fx)">');
    // backdrop rect baked, opaque white, rounded
    expect(final).toMatch(/<rect[^>]*fill="#ffffffff"/);
    expect(final).toContain('rx="11"');
    // viewBox expanded for padding (square 100 + 5% padding each side)
    expect(final).toContain('viewBox="-5 -5 110 110"');
    // still a single well-formed root svg
    expect((final.match(/<svg\b/g) ?? [])).toHaveLength(1);
    expect(final.trimEnd().endsWith('</svg>')).toBe(true);
  });

  it('a no-edit pipeline returns the mark essentially untouched', () => {
    const tagged = injectOrigIdx(TRACED);
    const overridden = applyPathOverrides(tagged, new Map());
    const cleaned = overridden.replace(/\sdata-orig-idx="\d+"/g, '');
    const styled = applyEffects(cleaned, {});
    const final = bakeBackdrop(styled, {
      color: '#ffffff',
      alpha: 0,
      radius: 0,
      padding: 0,
      aspect: 'original',
    });
    expect(final).toBe(TRACED);
  });
});

describe('multi-image compose then edit', () => {
  const a = '<svg viewBox="0 0 100 100"><path fill="#ff0000" d="MA"/></svg>';
  const b = '<svg viewBox="0 0 100 100"><path fill="#00ff00" d="MB"/></svg>';

  it('re-numbers paths globally across layers so edits target them', () => {
    const composed = composeLayers([{ svg: a }, { svg: b }], 1000);
    const tagged = injectOrigIdx(composed);
    const list = parsePathList(tagged);
    expect(list.map((p) => p.origIdx)).toEqual([0, 1]);
    expect(list.map((p) => p.originalFill)).toEqual(['#ff0000', '#00ff00']);

    // recolor the second layer's path (global idx 1)
    const out = applyPathOverrides(tagged, new Map([[1, { fill: '#123456' }]]));
    expect(out).toContain('fill="#123456"');
    expect(out).toContain('fill="#ff0000"'); // layer A untouched
    // both layers wrapped in transform groups
    expect((out.match(/<g transform=/g) ?? [])).toHaveLength(2);
  });
});

describe('export-as transforms over the composed result', () => {
  const composed = composeLayers(
    [{ svg: TRACED }, { svg: '<svg viewBox="0 0 100 100"><path fill="#0f0" d="M1 1"/></svg>' }],
    1000,
  );

  it('Copy-as React produces JSX (className, spread props, no kebab attrs)', () => {
    const tagged = injectOrigIdx(composed).replace(/\sdata-orig-idx="\d+"/g, '');
    const jsx = toReactComponent(tagged, 'Logo');
    expect(jsx).toContain('export function Logo(props)');
    expect(jsx).toContain('<svg {...props}');
    expect(jsx).not.toContain('data-orig-idx');
  });

  it('Copy-as data URI is url()-safe', () => {
    const uri = toDataUri(composed);
    expect(uri.startsWith('data:image/svg+xml,')).toBe(true);
    expect(uri).not.toContain('<');
  });

  it('ASCII renders an opaque mark to glyphs and transparent areas to spaces', () => {
    // 4×4: left two columns opaque black, right two transparent
    const w = 4;
    const h = 4;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        data[i + 3] = x < 2 ? 255 : 0; // alpha
      }
    const art = imageToAscii(data, w, h, { cols: 4, charAspect: 1 });
    expect(art.split('\n')).toHaveLength(4);
    expect(art.split('\n').every((l) => l === '@@')).toBe(true);
  });
});
