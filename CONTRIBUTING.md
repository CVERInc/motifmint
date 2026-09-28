# Contributing to motifmint

Issues, pull requests, translations — all welcome.

[**English**](#english) ・ [**日本語**](#日本語)

---

## English

### Types of contribution

| Type             | How                                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------- |
| Bug reports      | Open an [Issue](https://github.com/CVERInc/motifmint/issues), include a reproducible image or steps |
| Feature requests | Discuss in an Issue first if non-trivial                                                            |
| Translations     | PR — see [Adding a new language](#-adding-a-new-language)                                           |
| New presets      | PR — see [Adding a new preset](#-adding-a-new-preset)                                               |
| Docs / README    | PR directly                                                                                         |

### Local development

Requires Node.js 22 (see `.nvmrc`; CI runs the same version). Older Node
releases are rejected by Astro at build time.

```bash
git clone https://github.com/CVERInc/motifmint.git
cd motifmint
npm install
npm run dev       # http://localhost:4321/motifmint
npm run check     # type-check
npm test          # unit tests (Vitest)
npm run build     # production build to dist/
```

`bash scripts/test.sh` runs the same steps as CI (check, test, build) in one go.
To run it automatically before every `git push`, enable the tracked hook once:

```bash
git config core.hooksPath hooks
```

### Code style

- TypeScript strict mode (extends `astro/tsconfigs/strict`)
- Indentation: 2 spaces, semicolons, single quotes
- Run `npm run format` (Prettier) before submitting a PR — CI fails on
  unformatted files (`npm run format:check`)
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

Translations live in [`src/lib/i18n.ts`](src/lib/i18n.ts): `LOCALES` lists the
supported BCP-47 tags (`en-US`, `ja-JP`, `zh-TW`, `es-ES`) and each locale has a
flat dictionary of dotted keys (e.g. `hero.tagline`). They are used by
`Hero.svelte` and `LanguageSwitcher.svelte`; the studio UI (`Studio.svelte`) is
still English-only (see Roadmap in the README).

1. Discuss the language addition in an Issue first.
2. Add the tag to `LOCALES` and `LOCALE_LABELS`, and add a dictionary with
   every key the English one has.
3. Run `npm run check` and `npm test` — the type check and `i18n.test.ts` flag
   missing keys.

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

| 種類         | 方法                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------ |
| バグ報告     | [Issue](https://github.com/CVERInc/motifmint/issues) を作成、再現可能な画像 / 手順を添える |
| 機能提案     | 大きい変更は事前に Issue で議論                                                            |
| 翻訳         | PR — [新言語の追加](#-新言語の追加) を参照                                                 |
| 新プリセット | PR — [新プリセットの追加](#-新プリセットの追加) を参照                                     |
| ドキュメント | 直接 PR                                                                                    |

### ローカル開発

Node.js 22 が必要です（`.nvmrc` 参照、CI も同じバージョン）。それより古い
Node はビルド時に Astro に拒否されます。

```bash
git clone https://github.com/CVERInc/motifmint.git
cd motifmint
npm install
npm run dev       # http://localhost:4321/motifmint
npm run check     # 型チェック
npm test          # ユニットテスト (Vitest)
npm run build     # 本番ビルド (dist/)
```

`bash scripts/test.sh` で CI と同じ手順（check・test・build）をまとめて実行できます。
`git push` の前に自動で走らせるには、追跡済みの hook を一度だけ有効化してください：

```bash
git config core.hooksPath hooks
```

### コードスタイル

- TypeScript strict モード（`astro/tsconfigs/strict` を継承）
- インデント 2 スペース、セミコロン必須、シングルクォート
- PR 前に `npm run format`（Prettier）を実行 — 未整形のファイルがあると CI が
  失敗します（`npm run format:check`）
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

翻訳は [`src/lib/i18n.ts`](src/lib/i18n.ts) にあります。`LOCALES` に対応する
BCP-47 タグ（`en-US`, `ja-JP`, `zh-TW`, `es-ES`）が並び、各ロケールはドット区切り
キー（例: `hero.tagline`）のフラットな辞書です。`Hero.svelte` と
`LanguageSwitcher.svelte` が使用しており、スタジオ UI（`Studio.svelte`）はまだ
英語のみです（README の Roadmap 参照）。

1. 言語追加について事前に Issue で議論。
2. `LOCALES` と `LOCALE_LABELS` にタグを追加し、英語辞書と同じキーをすべて
   持つ辞書を追加。
3. `npm run check` と `npm test` を実行 — 型チェックと `i18n.test.ts` が
   キーの欠落を検出します。

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
