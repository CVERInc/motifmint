# Contributing to motifmint

Issues, pull requests, translations — all welcome.

[**English**](#english) ・ [**日本語**](#日本語)

---

## English

### Types of contribution

| Type | How |
|---|---|
| Bug reports | Open an [Issue](https://github.com/CVERInc/motifmint/issues), include a reproducible image or steps |
| Feature requests | Discuss in an Issue first if non-trivial |
| Translations | PR — see [Adding a new language](#-adding-a-new-language) |
| New presets | PR — see [Adding a new preset](#-adding-a-new-preset) |
| Docs / README | PR directly |

### Local development

Requires Node.js 18+.

```bash
git clone https://github.com/CVERInc/motifmint.git
cd motifmint
npm install
npm run dev       # http://localhost:4321
npm run check     # type-check
npm run build     # production build to dist/
```

### Code style

- TypeScript strict mode (extends `astro/tsconfigs/strict`)
- Indentation: 2 spaces, semicolons, single quotes
- Run `npm run format` (Prettier) before submitting a PR
- Constants: `UPPER_SNAKE_CASE`
- Files: `kebab-case.ts` for libs, `PascalCase.svelte` for components
- No emojis in UI strings — use Lucide icons instead

### Adding a new preset

Each preset is a function that mutates a `TracerConfig`. The four built-in
presets live in [`src/lib/presets.ts`](src/lib/presets.ts).

Steps to add a `comic` preset:

1. Add the ID to the `PresetId` union:
   ```ts
   export type PresetId = 'logo' | 'sketch' | 'photo' | 'pixel-art' | 'comic';
   ```
2. Add metadata to `PRESETS`:
   ```ts
   { id: 'comic', label: 'Comic / Manga', description: '…' }
   ```
3. Add a `case 'comic':` to `applyPreset()`. Call `config.setColorMode()`,
   `config.setFilterSpeckle()`, etc. See the existing `logo` case for the full
   list of knobs.
4. Test with a few representative images. Include before/after in your PR.

### Adding a new language

The UI strings currently live inline in `Studio.svelte` and
`index.astro`. Before adding new languages we will extract them into a JSON
dictionary under `src/i18n/` (see Roadmap). Until then:

1. Discuss the language addition in an Issue first.
2. PR: factor out the strings into `src/i18n/<locale>.json` (BCP-47, e.g.
   `ja-JP`, `zh-TW`).
3. Wire up a language switcher in the header.

The keys should be flat `SCREAMING_SNAKE_CASE`, matching the CVER house
convention.

### Pull request etiquette

- 1 PR = 1 feature / 1 fix (don't mix concerns).
- Run `npm run check` and `npm run build` before opening the PR.
- Include before/after screenshots for UI changes.
- For preset / engine changes, attach a representative sample image and the
  resulting SVG (or its size).

### Security

Do **not** open a public issue for security reports. See
[SECURITY.md](./SECURITY.md).

---

## 日本語

### 貢献の種類

| 種類 | 方法 |
|---|---|
| バグ報告 | [Issue](https://github.com/CVERInc/motifmint/issues) を作成、再現可能な画像 / 手順を添える |
| 機能提案 | 大きい変更は事前に Issue で議論 |
| 翻訳 | PR — [新言語の追加](#-新言語の追加) を参照 |
| 新プリセット | PR — [新プリセットの追加](#-新プリセットの追加) を参照 |
| ドキュメント | 直接 PR |

### ローカル開発

Node.js 18+ が必要です。

```bash
git clone https://github.com/CVERInc/motifmint.git
cd motifmint
npm install
npm run dev       # http://localhost:4321
npm run check     # 型チェック
npm run build     # 本番ビルド (dist/)
```

### コードスタイル

- TypeScript strict モード（`astro/tsconfigs/strict` を継承）
- インデント 2 スペース、セミコロン必須、シングルクォート
- PR 前に `npm run format`（Prettier）を実行
- 定数: `UPPER_SNAKE_CASE`
- ファイル: ライブラリは `kebab-case.ts`、コンポーネントは `PascalCase.svelte`
- UI 文字列で emoji は使わない — Lucide icon を使うこと

### 新プリセットの追加

各プリセットは `TracerConfig` を mutate する関数です。組込みプリセット 4 つは
[`src/lib/presets.ts`](src/lib/presets.ts) にあります。

例として `comic` プリセットを追加する手順：

1. `PresetId` union に ID を追加：
   ```ts
   export type PresetId = 'logo' | 'sketch' | 'photo' | 'pixel-art' | 'comic';
   ```
2. メタデータを `PRESETS` に追加：
   ```ts
   { id: 'comic', label: 'Comic / Manga', description: '…' }
   ```
3. `applyPreset()` に `case 'comic':` を追加。`setColorMode()` /
   `setFilterSpeckle()` 等を設定。既存の `logo` ケースが全パラメータの参考に
   なります。
4. 代表的な画像数枚でテストし、before/after を PR に添付してください。

### 新言語の追加

UI 文字列は現在 `Studio.svelte` と `index.astro` に直書きされています。
新言語追加の前に、文字列を `src/i18n/` 配下の JSON 辞書に抽出する予定です
（Roadmap 参照）。それまでの流れ：

1. 言語追加について事前に Issue で議論。
2. PR で文字列を `src/i18n/<locale>.json` に抽出（BCP-47、例: `ja-JP`,
   `zh-TW`）。
3. ヘッダーに言語切り替え UI を追加。

キーは flat `SCREAMING_SNAKE_CASE` で、CVER のハウスコンベンションに揃え
てください。

### PR の心得

- 1 PR = 1 機能 / 1 修正（混ぜない）
- PR 前に `npm run check` と `npm run build` を実行
- UI 変更は before/after スクリーンショットを添付
- プリセット / エンジン変更は、サンプル画像と出力 SVG（またはサイズ）を添付

### セキュリティ

セキュリティ報告は public issue にしないでください。
[SECURITY.md](./SECURITY.md) を参照。

---

ありがとうございます 🙌
