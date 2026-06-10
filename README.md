# motifmint

> Turn any image into a clean, recolorable **SVG logo or icon** — then export a
> full **favicon / app-icon pack** — 100% in your browser. Open source, MIT, no upload.
>
> どんな画像も、きれいで色を変えられる **SVG ロゴ・アイコン** に。**ファビコン /
> アプリアイコン一式** までブラウザだけで書き出し。アップロード不要、MIT ライセンス。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built with Astro](https://img.shields.io/badge/Built%20with-Astro-BC52EE)](https://astro.build/)
[![Engine: VTracer](https://img.shields.io/badge/Engine-VTracer%20(WASM)-orange)](https://github.com/visioncortex/vtracer)

**Live demo:** [oss.cver.net/motifmint](https://oss.cver.net/motifmint/) · **License:** MIT · **No server, no upload, no signup**

[**English**](#english) ・ [**日本語**](#日本語)

---

## English

### What is motifmint?

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

### Features

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
- Multilingual UI — English / 日本語 / 繁體中文 / Español *(rolling out; see roadmap)*

### Quick start (use online)

Open [`https://oss.cver.net/motifmint/`](https://oss.cver.net/motifmint/) and drag an image in.

### Self-host

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

### Tech stack

| Layer | Choice | Why |
|---|---|---|
| Engine | [VTracer](https://github.com/visioncortex/vtracer) (Rust → WASM via `wasm_vtracer`) | Modern color tracing, MIT |
| Framework | [Astro](https://astro.build/) + [Svelte 5](https://svelte.dev/) islands | Static-first, tiny initial bundle |
| Post-processing | [SVGO](https://svgo.dev/) (lazy-loaded) | The de-facto SVG optimizer |
| Zip / ICO | [fflate](https://github.com/101arrowz/fflate) + hand-rolled ICO | Pure JS, no extra WASM |
| Icons | [Lucide](https://lucide.dev/) | Clean line icons, ISC |
| Tests | [Vitest](https://vitest.dev/) | Pure-lib unit tests |
| Deployment | Static (Cloudflare Pages, Netlify, …) | Zero infra |

### Project layout

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

### Privacy

motifmint does not collect, log, or transmit anything. The image is decoded via
the browser's Canvas API, traced by the WebAssembly module on the same page,
and rendered locally. There is no server backend.

### Roadmap

- [ ] Full tool-UI translations (en / ja / zh-TW / es) across the studio
- [ ] Advanced trace controls — expose VTracer knobs (corner/splice thresholds, …)
- [ ] Paste from clipboard + bundled sample logos
- [ ] Boolean ops (union / subtract / intersect) on selected shapes
- [ ] CLI: `npx @cver/motifmint input.png > out.svg` + batch (zip in → zip out)
- [ ] Light theme + remembered settings

### Contributing

See [**CONTRIBUTING.md**](./CONTRIBUTING.md). Issues, PRs, and translations
welcome.

### License

[MIT](./LICENSE). Third-party engine attributions in
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

---

## 日本語

### motifmint とは？

motifmint は、軽量でブラウザ完結の **ロゴ・アイコンスタジオ** です。ラスター画像
（PNG/JPG/WebP）をドロップするとクリーンなベクターにトレースし、色変更・簡略化・
合成まで行えます。仕上げは最適化 SVG、ラスター、あるいは **ファビコン /
アプリアイコン一式** として書き出し。汎用フォーマット変換ツールではなく、
「マークをきれいに、どこでも使える形に」することに特化しています。

オンラインのトレーサーの多くは、画像を第三者サーバーにアップロードするか、
良い出力を有料化するか、一発トレースで終わりです。motifmint は：

- **完全にブラウザ上で動作**（WebAssembly）— 画像は端末から出ません。
- [**VTracer**](https://github.com/visioncortex/vtracer)（Rust 製のモダンな
  ベクトル化エンジン）を Web Worker 上で実行 — モノクロだけでなく **カラー**
  に対応し、UI も固まりません。
- **一発変換ではなくスタジオ** — 色変更・グラデーション・非表示/消去・合成して
  から書き出し。
- **MIT ライセンス**、セルフホスト可、フォーク自由、永久無料。

### 機能

**トレース**
- ドラッグ＆ドロップ、またはクリックで選択
- 4 つのプリセット — **Logo**（フラットカラー）/ **Sketch**（白黒）/ **Photo**
  （多色・滑らか）/ **Pixel art**（シャープなエッジ）
- 調整したプリセットの保存
- SVGO による最適化（任意・viewBox と fill を保持）

**編集（スタジオ）**
- **複数画像の合成** — 画像レイヤーを追加し、位置（拡大縮小・オフセット）・
  並び順・表示/非表示を調整して 1 つのマークに
- 色グループ単位・個別シェイプ単位の **色変更**
- **グラデーション** — 線形 / 放射状、多ストップ、プリセット保存可
- シェイプの **非表示 / 消去**、**穴あけ**（boolean）で背景を透過、
  **ワンクリック背景除去**
- **アウトライン / ドロップシャドウ / グロー**（SVG ネイティブ・任意サイズで鮮明）
- **スマートクリーン** — 近似色の統合とノイズ除去
- **背景** — 単色背景・正方形アスペクト・角丸・余白
- **取り消し / やり直し**（Cmd/Ctrl+Z）とビフォー/アフター **比較スライダー**

**書き出し**
- **SVG**（最適化済み）
- **ラスター** — PNG / WebP / JPG（128〜1024px または元解像度）、
  ワンクリック **@1×/@2×/@3× zip** も
- **アイコンパック** — マルチ解像度 `favicon.ico`（16/32/48）、`favicon-16/32`、
  `apple-touch-icon`、`icon-192/512`、セーフエリア付き `maskable-512`、
  `site.webmanifest`、貼り付け用 `<head>` スニペットを zip で
- **コピー** — SVG / React コンポーネント / Vue コンポーネント / data URI
- **ASCII アート** — マークをテキスト化（CLI バナー、README、HTML コメントの
  隠し要素に）。コピーまたは `.txt`、桁数調整可

**常時**
- アップロード・登録なし、**テレメトリゼロ**
- **インストール可能な PWA**、読み込み後はオフラインでも動作
- 多言語 UI — English / 日本語 / 繁體中文 / Español *(順次対応・ロードマップ参照)*

### 使い方（オンライン版）

[`https://oss.cver.net/motifmint/`](https://oss.cver.net/motifmint/) を開いて画像をドラッグするだけ。

### セルフホスト

```bash
git clone https://github.com/CVERInc/motifmint.git
cd motifmint
npm install
npm run dev        # http://localhost:4321
npm test           # ユニットテスト (Vitest)
npm run build      # dist/ に静的出力
```

`dist/` を任意の静的ホスティング（Cloudflare Pages / Netlify / Vercel /
GitHub Pages / nginx）にデプロイすればOK。**サーバランタイムは不要**。

### プライバシー

motifmint は何も収集・記録・送信しません。画像は Canvas API でデコード、同じ
ページ上の WebAssembly モジュールでトレース、ローカルで描画されます。
バックエンドサーバは存在しません。

### ロードマップ

- [ ] スタジオ全体の UI 翻訳（en / ja / zh-TW / es）
- [ ] 高度なトレース設定（VTracer の各パラメータを公開）
- [ ] クリップボードからの貼り付け＋サンプルロゴ同梱
- [ ] ブール演算（合体 / 減算 / 交差）を選択シェイプに
- [ ] CLI: `npx @cver/motifmint input.png > out.svg` ＋ バッチ（zip in → zip out）
- [ ] ライトテーマ＋設定の記憶

### 貢献

[**CONTRIBUTING.md**](./CONTRIBUTING.md) を参照。Issue、PR、翻訳、すべて
歓迎します。

### ライセンス

[MIT](./LICENSE)。同梱の third-party 表記は
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) を参照。

---

Built by [CVER Inc.](https://cver.net)
