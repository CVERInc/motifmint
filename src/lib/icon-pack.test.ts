import { describe, expect, it } from 'vitest';
import {
  generateHtmlSnippet,
  generateWebManifest,
  ICON_SPECS,
  ICO_SIZES,
  packFileList,
} from './icon-pack';

describe('ICON_SPECS', () => {
  it('covers the standard favicon/app-icon sizes', () => {
    const files = ICON_SPECS.map((s) => s.file);
    expect(files).toContain('favicon-16.png');
    expect(files).toContain('favicon-32.png');
    expect(files).toContain('apple-touch-icon.png');
    expect(files).toContain('icon-192.png');
    expect(files).toContain('icon-512.png');
    expect(files).toContain('maskable-512.png');
  });

  it('gives the apple-touch and maskable icons a safe-area inset', () => {
    const apple = ICON_SPECS.find((s) => s.file === 'apple-touch-icon.png')!;
    const maskable = ICON_SPECS.find((s) => s.file === 'maskable-512.png')!;
    expect(apple.inset).toBeGreaterThan(0);
    expect(maskable.inset).toBeGreaterThan(0);
  });

  it('keeps plain favicons full-bleed', () => {
    expect(ICON_SPECS.find((s) => s.file === 'favicon-16.png')!.inset).toBe(0);
  });

  it('packs 16/32/48 into the .ico', () => {
    expect(ICO_SIZES).toEqual([16, 32, 48]);
  });
});

describe('generateWebManifest', () => {
  it('produces valid JSON with name + short_name', () => {
    const m = JSON.parse(generateWebManifest({ name: 'Acme' }));
    expect(m.name).toBe('Acme');
    expect(m.short_name).toBe('Acme');
    expect(m.display).toBe('standalone');
  });

  it('only lists manifest-flagged icons, with the right purpose', () => {
    const m = JSON.parse(generateWebManifest({ name: 'Acme' }));
    const srcs = m.icons.map((i: { src: string }) => i.src).sort();
    expect(srcs).toEqual(['icon-192.png', 'icon-512.png', 'maskable-512.png']);
    const maskable = m.icons.find((i: { src: string }) => i.src === 'maskable-512.png');
    expect(maskable.purpose).toBe('maskable');
  });

  it('falls back for a blank name and honors a custom short name + theme', () => {
    const m = JSON.parse(
      generateWebManifest({ name: '   ', shortName: 'Sh', themeColor: '#123456' }),
    );
    expect(m.name).toBe('My App');
    expect(m.short_name).toBe('Sh');
    expect(m.theme_color).toBe('#123456');
  });
});

describe('generateHtmlSnippet', () => {
  it('wires up every linked file + theme-color', () => {
    const snip = generateHtmlSnippet({ themeColor: '#abcdef' });
    expect(snip).toContain('href="/favicon.ico"');
    expect(snip).toContain('rel="apple-touch-icon"');
    expect(snip).toContain('rel="manifest"');
    expect(snip).toContain('content="#abcdef"');
  });
});

describe('packFileList', () => {
  it('lists the ico, every png, the manifest and a readme', () => {
    const files = packFileList();
    expect(files).toContain('favicon.ico');
    expect(files).toContain('site.webmanifest');
    expect(files).toContain('README.txt');
    expect(files).toContain('maskable-512.png');
  });
});
