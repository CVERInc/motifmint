/**
 * Favicon / app-icon pack definitions and the text artifacts that ship with it
 * (`site.webmanifest` + a copy-paste `<head>` snippet).
 *
 * The actual rasterization (SVG → canvas → PNG) and zipping live in the
 * component, which has the browser APIs. Everything here is pure data/string
 * generation so it can be unit-tested in-session.
 *
 * Pipeline reuse: each spec's PNG is produced from the composed result via the
 * same `buildFinalSvg()` + `rasterize()` path the raster export already uses;
 * `padding`/`safeArea` only change how much transparent margin we inset before
 * drawing, so icons aren't clipped by platform masks.
 */

/** What an icon is for — drives the manifest `purpose` field. */
export type IconPurpose = 'any' | 'maskable';

export interface IconSpec {
  /** Output filename inside the zip. */
  file: string;
  /** Square pixel size. */
  size: number;
  /**
   * Fraction (0–1) of the canvas kept as transparent margin around the mark.
   * Apple touch icons want a little breathing room; maskable icons need a
   * generous safe area because platforms crop them to a circle/squircle.
   */
  inset: number;
  /** Include this PNG as an entry in `site.webmanifest`. */
  manifest?: IconPurpose;
}

/**
 * The standard pack. `.ico` is handled separately (multi-res, see ICO_SIZES).
 * Insets follow platform guidance: Apple ~10%, maskable ~10% safe area, plain
 * favicons/PWA icons full-bleed (0).
 */
export const ICON_SPECS: IconSpec[] = [
  { file: 'favicon-16.png', size: 16, inset: 0 },
  { file: 'favicon-32.png', size: 32, inset: 0 },
  { file: 'apple-touch-icon.png', size: 180, inset: 0.1 },
  { file: 'icon-192.png', size: 192, inset: 0, manifest: 'any' },
  { file: 'icon-512.png', size: 512, inset: 0, manifest: 'any' },
  { file: 'maskable-512.png', size: 512, inset: 0.1, manifest: 'maskable' },
];

/** Resolutions packed into the multi-res `favicon.ico`. */
export const ICO_SIZES = [16, 32, 48];

export interface ManifestOpts {
  /** App name (e.g. derived from the source filename). */
  name: string;
  /** Short name for home-screen labels. Defaults to `name`. */
  shortName?: string;
  /** Theme color for the manifest + meta tag. */
  themeColor?: string;
  /** Background color shown behind the icon on splash screens. */
  backgroundColor?: string;
}

const DEFAULT_THEME = '#0b3b3b';
const DEFAULT_BG = '#ffffff';

/** Build the `site.webmanifest` JSON string. */
export function generateWebManifest(opts: ManifestOpts): string {
  const name = opts.name.trim() || 'My App';
  const manifest = {
    name,
    short_name: (opts.shortName ?? name).trim() || name,
    icons: ICON_SPECS.filter((s) => s.manifest).map((s) => ({
      src: s.file,
      sizes: `${s.size}x${s.size}`,
      type: 'image/png',
      purpose: s.manifest as IconPurpose,
    })),
    theme_color: opts.themeColor ?? DEFAULT_THEME,
    background_color: opts.backgroundColor ?? DEFAULT_BG,
    display: 'standalone',
  };
  return JSON.stringify(manifest, null, 2);
}

/** Build the copy-paste `<head>` snippet that wires the pack up. */
export function generateHtmlSnippet(opts?: Pick<ManifestOpts, 'themeColor'>): string {
  const theme = opts?.themeColor ?? DEFAULT_THEME;
  return [
    '<link rel="icon" href="/favicon.ico" sizes="any">',
    '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">',
    '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">',
    '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">',
    '<link rel="manifest" href="/site.webmanifest">',
    `<meta name="theme-color" content="${theme}">`,
  ].join('\n');
}

/** Everything that goes into the downloadable pack, by filename. */
export function packFileList(): string[] {
  return [
    'favicon.ico',
    ...ICON_SPECS.map((s) => s.file),
    'site.webmanifest',
    'README.txt',
  ];
}
