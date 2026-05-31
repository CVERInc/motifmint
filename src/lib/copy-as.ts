/**
 * "Copy as …" transforms for the composed SVG result.
 *
 * All pure string → string (no DOM, no clipboard) so they're fully unit-
 * testable; the component layer is what actually writes to the clipboard.
 *
 * Targets: a URL-encoded data URI, a React (JSX) component, and a Vue SFC.
 */

/** Turn a filename / arbitrary label into a PascalCase JS identifier. */
export function toComponentName(base: string): string {
  const cleaned = base
    .replace(/\.[^.]+$/, '') // drop extension
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
  // Identifiers can't start with a digit.
  const name = /^[0-9]/.test(cleaned) ? `Icon${cleaned}` : cleaned;
  return name || 'Icon';
}

/**
 * Compact URL-encoded `data:image/svg+xml` URI. Encodes the few characters
 * that actually break in a CSS `url()` / `src` context, leaving the rest
 * readable (smaller and friendlier than base64).
 */
export function toDataUri(svg: string): string {
  const collapsed = svg.replace(/\s+/g, ' ').trim();
  const encoded = collapsed
    .replace(/"/g, "'") // double → single quotes (avoids escaping in url())
    .replace(/%/g, '%25')
    .replace(/#/g, '%23')
    .replace(/&/g, '%26')
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E')
    .replace(/\{/g, '%7B')
    .replace(/\}/g, '%7D');
  return `data:image/svg+xml,${encoded}`;
}

// Attributes React expects in a non-standard casing.
const REACT_ATTR_OVERRIDES: Record<string, string> = {
  class: 'className',
  'xlink:href': 'xlinkHref',
  'xmlns:xlink': 'xmlnsXlink',
};

/** kebab/colon attribute → React camelCase. `data-` and `aria-` are left alone. */
function toReactAttrName(name: string): string {
  const lower = name.toLowerCase();
  if (REACT_ATTR_OVERRIDES[lower]) return REACT_ATTR_OVERRIDES[lower];
  if (lower.startsWith('data-') || lower.startsWith('aria-')) return lower;
  // fill-rule → fillRule, stop-color → stopColor, xlink:href handled above
  return name.replace(/[-:]([a-z])/g, (_m, c: string) => c.toUpperCase());
}

/** `fill:#000;stroke:red` → `{fill:'#000',stroke:'red'}` as a JSX style object. */
function toReactStyleObject(style: string): string {
  const props = style
    .split(';')
    .map((d) => d.trim())
    .filter(Boolean)
    .map((decl) => {
      const i = decl.indexOf(':');
      if (i === -1) return null;
      const key = decl.slice(0, i).trim().replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
      const val = decl.slice(i + 1).trim();
      return `${key}: '${val}'`;
    })
    .filter(Boolean);
  return `{{ ${props.join(', ')} }}`;
}

/** Rewrite an SVG element's attributes for JSX. */
function jsxifyAttrs(attrs: string): string {
  return attrs.replace(
    /([a-zA-Z_][\w:-]*)\s*=\s*"([^"]*)"/g,
    (_m, name: string, value: string) => {
      if (name.toLowerCase() === 'style') return `style=${toReactStyleObject(value)}`;
      return `${toReactAttrName(name)}="${value}"`;
    },
  );
}

/**
 * Convert the SVG to a self-contained React component. Attributes are
 * camelCased, `class`→`className`, inline styles become JSX objects, and
 * `{...props}` is spread onto the root `<svg>` so callers can pass size/etc.
 */
export function toReactComponent(svg: string, name = 'Icon'): string {
  const body = svg
    .replace(/<\?xml[^>]*\?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim()
    // rewrite attributes on every tag
    .replace(/<([a-zA-Z][\w-]*)((?:\s+[^<>]*?)?)(\/?)>/g, (_m, tag: string, attrs: string, close: string) => {
      const rewritten = jsxifyAttrs(attrs);
      return `<${tag}${rewritten}${close}>`;
    })
    // spread props onto the root svg
    .replace(/<svg\b/, '<svg {...props}');
  return (
    `export function ${name}(props) {\n` +
    `  return (\n    ${body.replace(/\n/g, '\n    ')}\n  );\n` +
    `}\n`
  );
}

/** Convert the SVG to a Vue Single-File Component (template keeps kebab-case). */
export function toVueComponent(svg: string): string {
  const body = svg
    .replace(/<\?xml[^>]*\?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim()
    .replace(/\n/g, '\n  ');
  return `<template>\n  ${body}\n</template>\n`;
}
