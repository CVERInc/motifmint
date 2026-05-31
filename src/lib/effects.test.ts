import { describe, expect, it } from 'vitest';
import {
  applyEffects,
  buildEffectFilter,
  EFFECT_FILTER_ID,
  hasEffects,
  type EffectOptions,
} from './effects';

describe('hasEffects', () => {
  it('is false for empty / zeroed options', () => {
    expect(hasEffects({})).toBe(false);
    expect(hasEffects({ outline: { width: 0, color: '#000' } })).toBe(false);
    expect(hasEffects({ glow: { blur: 0, color: '#fff', opacity: 1 } })).toBe(false);
    expect(hasEffects({ shadow: { blur: 0, dx: 0, dy: 0, color: '#000', opacity: 0 } })).toBe(false);
  });

  it('is true when any effect is active', () => {
    expect(hasEffects({ outline: { width: 2, color: '#000' } })).toBe(true);
    expect(hasEffects({ shadow: { blur: 3, dx: 0, dy: 2, color: '#000', opacity: 0.5 } })).toBe(true);
    expect(hasEffects({ glow: { blur: 4, color: '#fff', opacity: 0.8 } })).toBe(true);
  });
});

describe('buildEffectFilter', () => {
  it('returns empty string with no active effects', () => {
    expect(buildEffectFilter({})).toBe('');
  });

  it('builds an outline via feMorphology dilate', () => {
    const f = buildEffectFilter({ outline: { width: 3, color: '#ff0000' } });
    expect(f).toContain('<filter id="mm-fx"');
    expect(f).toContain('feMorphology');
    expect(f).toContain('operator="dilate"');
    expect(f).toContain('radius="3"');
    expect(f).toContain('flood-color="#ff0000"');
    expect(f).toContain('<feMergeNode in="outline"/>');
    expect(f).toContain('<feMergeNode in="SourceGraphic"/>');
  });

  it('builds a drop shadow with blur + offset + opacity', () => {
    const f = buildEffectFilter({ shadow: { blur: 2, dx: 1, dy: 4, color: '#000', opacity: 0.4 } });
    expect(f).toContain('stdDeviation="2"');
    expect(f).toContain('dx="1"');
    expect(f).toContain('dy="4"');
    expect(f).toContain('flood-opacity="0.4"');
    expect(f).toContain('<feMergeNode in="shadow"/>');
  });

  it('orders layers shadow → glow → outline → source', () => {
    const opts: EffectOptions = {
      outline: { width: 2, color: '#000' },
      shadow: { blur: 2, dx: 0, dy: 2, color: '#000', opacity: 0.5 },
      glow: { blur: 3, color: '#fff', opacity: 0.6 },
    };
    const f = buildEffectFilter(opts);
    const order = ['shadow', 'glow', 'outline', 'SourceGraphic'].map((m) =>
      f.indexOf(`<feMergeNode in="${m}"/>`),
    );
    expect(order.every((i) => i > -1)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b)); // strictly increasing
  });

  it('honors a custom id', () => {
    expect(buildEffectFilter({ outline: { width: 1, color: '#000' } }, 'x')).toContain('id="x"');
  });
});

describe('applyEffects', () => {
  const svg = '<svg viewBox="0 0 10 10"><path d="M0 0"/></svg>';

  it('is a no-op with no active effects', () => {
    expect(applyEffects(svg, {})).toBe(svg);
  });

  it('injects the filter def and wraps the body in a filtered group', () => {
    const out = applyEffects(svg, { outline: { width: 2, color: '#000' } });
    expect(out).toContain('<defs><filter id="mm-fx"');
    expect(out).toContain(`<g filter="url(#${EFFECT_FILTER_ID})"><path d="M0 0"/></g>`);
    expect(out.endsWith('</svg>')).toBe(true);
  });
});
