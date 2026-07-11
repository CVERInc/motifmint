// svgo 3.x ships a browser-only bundle at this path. The default entry
// pulls in Node `fs`/`os`/`path`, which we don't want in a browser build.
import { optimize, type Config } from 'svgo/dist/svgo.browser.js';

const DEFAULT_CONFIG: Config = {
  multipass: true,
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          removeViewBox: false,
          collapseGroups: false,
          // Recolor/mergeNearColors key path groups by hex fills. Two guards:
          //  - removeUselessStrokeAndFill would drop "useless" fills outright;
          //  - convertColors rewrites #ff0000 → "red", which the hex-only
          //    grouping (and the color-picker swatches) can't handle.
          // (fill="#000000" still gets stripped as an SVG default by
          // removeUnknownsAndDefaults — normalizeFills re-adds it right after
          // this pass in the worker pipeline.)
          removeUselessStrokeAndFill: false,
          convertColors: false,
        },
      },
    },
    'removeDimensions',
    'sortAttrs',
  ],
};

export function optimizeSvg(svg: string): string {
  try {
    const result = optimize(svg, DEFAULT_CONFIG);
    return result.data;
  } catch {
    return svg;
  }
}
