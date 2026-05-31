import { describe, expect, it } from 'vitest';
import {
  toComponentName,
  toDataUri,
  toReactComponent,
  toVueComponent,
} from './copy-as';

describe('toComponentName', () => {
  it('PascalCases a filename', () => {
    expect(toComponentName('my-cool logo.png')).toBe('MyCoolLogo');
    expect(toComponentName('acme_brand.svg')).toBe('AcmeBrand');
  });

  it('prefixes a leading digit', () => {
    expect(toComponentName('1up.png')).toBe('Icon1up');
  });

  it('falls back to Icon for empty/garbage', () => {
    expect(toComponentName('   ')).toBe('Icon');
    expect(toComponentName('!!!')).toBe('Icon');
  });
});

describe('toDataUri', () => {
  it('produces a url()-safe svg+xml data URI', () => {
    const uri = toDataUri('<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>');
    expect(uri.startsWith('data:image/svg+xml,')).toBe(true);
    expect(uri).toContain('%3Csvg'); // < encoded
    expect(uri).toContain("viewBox='0 0 1 1'"); // double → single quotes
    expect(uri).not.toContain('<'); // no raw angle brackets
    expect(uri).not.toContain('>');
  });

  it('encodes # so colors do not break the URI', () => {
    expect(toDataUri('<svg><path fill="#abc"/></svg>')).toContain('%23abc');
  });
});

describe('toReactComponent', () => {
  const svg = '<svg viewBox="0 0 10 10" class="x"><path fill-rule="evenodd" d="M0 0"/></svg>';

  it('wraps in an export function with the given name', () => {
    const out = toReactComponent(svg, 'Logo');
    expect(out).toContain('export function Logo(props)');
    expect(out).toContain('return (');
  });

  it('camelCases attributes and class→className', () => {
    const out = toReactComponent(svg, 'Logo');
    expect(out).toContain('className="x"');
    expect(out).toContain('fillRule="evenodd"');
    expect(out).not.toContain('fill-rule');
  });

  it('spreads props onto the root svg', () => {
    expect(toReactComponent(svg, 'Logo')).toContain('<svg {...props}');
  });

  it('converts inline style to a JSX style object', () => {
    const out = toReactComponent('<svg><path style="fill:#000;stroke-width:2"/></svg>', 'S');
    expect(out).toContain("fill: '#000'");
    expect(out).toContain("strokeWidth: '2'");
  });

  it('leaves data-* / aria-* attributes untouched', () => {
    const out = toReactComponent('<svg aria-label="logo" data-x="1"></svg>', 'S');
    expect(out).toContain('aria-label="logo"');
    expect(out).toContain('data-x="1"');
  });
});

describe('toVueComponent', () => {
  it('wraps the svg in a <template>', () => {
    const out = toVueComponent('<svg><path d="M0 0"/></svg>');
    expect(out.startsWith('<template>')).toBe(true);
    expect(out.trimEnd().endsWith('</template>')).toBe(true);
    // Vue keeps kebab-case attributes as-is
    expect(out).toContain('<svg>');
  });
});
