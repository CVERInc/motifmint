import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Guards for the contributor-facing docs and package metadata: the things a new
// contributor copies verbatim (Node version, dev URL, file paths) must match the
// repo as it actually is.

const ROOT = join(import.meta.dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const DOCS = ['README.md', 'CONTRIBUTING.md'];

const pkg = JSON.parse(read('package.json'));
const nvmrcMajor = Number(read('.nvmrc').trim().replace(/^v/, '').split('.')[0]);

describe('Node version', () => {
  it('package.json declares engines.node', () => {
    expect(pkg.engines?.node).toBeTruthy();
  });

  it.each(DOCS)('%s states the same Node major as .nvmrc', (doc) => {
    const stated = [...read(doc).matchAll(/Node(?:\.js)?\s+v?(\d+)/g)].map((m) => Number(m[1]));
    for (const major of stated) expect(major).toBe(nvmrcMajor);
  });
});

describe('dev server URL', () => {
  const base = read('astro.config.mjs').match(/base:\s*['"]([^'"]+)['"]/)?.[1] ?? '';

  it.each(DOCS)('%s points at the configured base path', (doc) => {
    const urls = [...read(doc).matchAll(/https?:\/\/localhost:\d+[^\s)`]*/g)].map((m) => m[0]);
    for (const url of urls) expect(new URL(url).pathname.replace(/\/$/, '')).toBe(base);
  });
});

describe('documented paths exist', () => {
  it('every file in the README project layout exists', () => {
    const layout = read('README.md').split('## Project layout')[1]?.split('```')[1] ?? '';
    const names = [...layout.matchAll(/[\w-]+(?:\.[\w-]+)*\.(?:ts|svelte|astro|mjs|json)\b/g)].map(
      (m) => m[0],
    );
    expect(names.length).toBeGreaterThan(0);
    const all = new Set(
      ['', 'src/components', 'src/lib', 'src/layouts', 'src/pages'].flatMap((d) =>
        readdirSync(join(ROOT, d)),
      ),
    );
    expect(names.filter((n) => !all.has(n.split('/').pop()!))).toEqual([]);
  });

  it('every `src/...` path in CONTRIBUTING exists', () => {
    const paths = [...read('CONTRIBUTING.md').matchAll(/`(src\/[^`<>]+)`/g)].map((m) => m[1]);
    expect(paths.filter((p) => !existsSync(join(ROOT, p)))).toEqual([]);
  });
});

describe('dependencies', () => {
  it('pins every dependency to a version range, not a dist-tag', () => {
    const specs = { ...pkg.dependencies, ...pkg.devDependencies } as Record<string, string>;
    const floating = Object.entries(specs).filter(([, v]) => !/\d/.test(v));
    expect(floating).toEqual([]);
  });
});
