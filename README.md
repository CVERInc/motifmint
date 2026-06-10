# motifmint

> Turn any image into a clean, recolorable **SVG logo or icon** — then export a
> full **favicon / app-icon pack** — 100% in your browser. Open source, MIT, no upload.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built with Astro](https://img.shields.io/badge/Built%20with-Astro-BC52EE)](https://astro.build/)
[![Engine: VTracer](https://img.shields.io/badge/Engine-VTracer%20(WASM)-orange)](https://github.com/visioncortex/vtracer)

**Live demo:** [oss.cver.net/motifmint](https://oss.cver.net/motifmint/) · **License:** MIT · **No server, no upload, no signup**

🌐 日本語の紹介 → [cver.net/ja-jp/oss/motifmint](https://cver.net/ja-jp/oss/motifmint) ・ 繁體中文介紹 → [cver.net/zh-tw/oss/motifmint](https://cver.net/zh-tw/oss/motifmint)

---

## What is motifmint?

motifmint is a lightweight, in-browser **logo & icon studio**. Drop in a raster
image (PNG/JPG/WebP), and it traces a clean vector you can recolor, simplify and
compose — then export as an optimized SVG, a raster, or a complete favicon /
app-icon pack. It is **not** a general format converter: it's focused on making
marks look good and ship anywhere.

Why not the usual online tracers? Most upload your image to a third-party
server, lock the good output behind a paywall, or stop at a one-shot trace.
motifmint:

- Runs **entirely in your browser** via WebAssembly — your image never leaves
  your machine.
- Uses [**VTracer**](https://github.com/visioncortex/vtracer), a modern Rust
  tracing engine that handles **color**, not just black and white, in a Web Worker
  so the UI stays responsive.
- Is a **studio, not a one-shot tool** — recolor, gradient-fill, hide/erase, and
  compose your mark, then export.
- Is **MIT-licensed**, self-hostable, forkable, and free forever.

## Features

**Trace**
- Drag-and-drop or click to choose a file
- Four presets — **Logo** (flat colors, crisp edges), **Sketch** (high-contrast
  B/W), **Photo** (many colors, smooth curves), **Pixel art** (sharp edges)
- Save your own tuned presets
- Optional SVGO pass (multipass, viewBox- and fill-preserving)

**Edit (the studio)**
- **Compose multiple images** into one mark — add image layers, position
  (scale / offset), reorder, show-hide
- **Recolor** by color group or per individual shape
- **Gradient fills** — linear or radial, multi-stop, with savable presets
- **Hide / erase** shapes; **punch holes** (boolean, even-odd) so a backdrop
  shows through; **one-click background removal**
- **Outline / drop-shadow / glow** (SVG-native, crisp at any size)
- **Smart Clean** — merge near-identical colors and drop speckle noise
- **Backdrop** — solid background, square aspect, rounded corners, padding
- **Undo / redo** (Cmd/Ctrl+Z) and a before/after **compare slider**

**Export**
- **SVG** (clean, optimized)
- **Raster** — PNG / WebP / JPG at 128–1024px or source resolution, plus a
  one-click **@1×/@2×/@3× zip**
- **Icon pack** — a zip with a multi-resolution `favicon.ico` (16/32/48),
  `favicon-16/32.png`, `apple-touch-icon.png`, `icon-192/512.png`, a safe-area
  `maskable-512.png`, `site.webmanifest`, and a paste-in `<head>` snippet
- **Copy as** SVG, React component, Vue component, or data URI
- **ASCII art** — render the mark to text for CLI banners, READMEs, or
  HTML-comment easter eggs (copy or `.txt`, adjustable width)

**Always**
- No upload, no signup, **zero telemetry**
- **Installable PWA**, works offline once loaded
- Multilingual UI — English / 日本語 / 繁體中文 / Español

## Quick start (use online)

Open [`https://oss.cver.net/motifmint/`](https://oss.cver.net/motifmint/) and drag an image in.

## Self-host

```bash
git clone https://github.com/CVERInc/motifmint.git
cd motifmint
npm install
npm run dev        # http://localhost:4321
npm test           # unit tests (Vitest)
npm run build      # static output in dist/
```

Deploy `dist/` to any static host — Cloudflare Pages, Netlify, Vercel, GitHub
Pages, or your own nginx. **No server runtime is required.**

> The wasm bundle is loaded from the same origin, so configure your host to
> serve `.wasm` files with `Content-Type: application/wasm` (most platforms do
> this automatically).

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Engine | [VTracer](https://github.com/visioncortex/vtracer) (Rust → WASM via `wasm_vtracer`) | Modern color tracing, MIT |
| Framework | [Astro](https://astro.build/) + [Svelte 5](https://svelte.dev/) islands | Static-first, tiny initial bundle |
| Post-processing | [SVGO](https://svgo.dev/) (lazy-loaded) | The de-facto SVG optimizer |
| Zip / ICO | [fflate](https://github.com/101arrowz/fflate) + hand-rolled ICO | Pure JS, no extra WASM |
| Icons | [Lucide](https://lucide.dev/) | Clean line icons, ISC |
| Tests | [Vitest](https://vitest.dev/) | Pure-lib unit tests |
| Deployment | Static (Cloudflare Pages, Netlify, …) | Zero infra |

## Project layout

```
motifmint/
├─ src/
│  ├─ components/
│  │  ├─ Studio.svelte        # the studio UI (trace, edit, export)
│  │  ├─ CompareSlider.svelte # before/after slider
│  │  └─ Hero.svelte          # title + language switcher
│  ├─ lib/
│  │  ├─ trace.ts / .worker.ts      # wasm wrapper + worker
│  │  ├─ presets.ts                 # logo / sketch / photo / pixel-art
│  │  ├─ recolor.ts · path-state.ts · gradient.ts  # edit pipeline
│  │  ├─ punch-hole.ts · strip-artifact.ts · backdrop.ts
│  │  ├─ icon-pack.ts · ico.ts      # favicon / app-icon pack
│  │  ├─ i18n.ts · i18n-store.ts    # en / ja / zh-TW / es
│  │  └─ svgo.ts · format.ts · decode.ts
│  ├─ layouts/Layout.astro
│  └─ pages/index.astro
├─ astro.config.mjs
└─ package.json
```

## Privacy

motifmint does not collect, log, or transmit anything. The image is decoded via
the browser's Canvas API, traced by the WebAssembly module on the same page,
and rendered locally. There is no server backend.

## Roadmap

- [ ] Full tool-UI translations (en / ja / zh-TW / es) across the studio
- [ ] Advanced trace controls — expose VTracer knobs (corner/splice thresholds, …)
- [ ] Paste from clipboard + bundled sample logos
- [ ] Boolean ops (union / subtract / intersect) on selected shapes
- [ ] CLI: `npx @cver/motifmint input.png > out.svg` + batch (zip in → zip out)
- [ ] Light theme + remembered settings

## Contributing

See [**CONTRIBUTING.md**](./CONTRIBUTING.md). Issues, PRs, and translations
welcome.

## License

[MIT](./LICENSE). Third-party engine attributions in
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

---

---

Built by [CVER Inc.](https://cver.net)
