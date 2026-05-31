/**
 * Tiny i18n layer for the markmint tool UI.
 *
 * Design goals (kept deliberately small — no runtime dep):
 *   • A flat `TRANSLATIONS` dict keyed by locale, then by message key.
 *   • `detectLocale()` picks the best supported locale from the browser.
 *   • `translate()` is a pure function (locale, key, params) → string, with
 *     `{name}` placeholder substitution and graceful fallback to English then
 *     to the raw key — so a missing translation never throws or renders blank.
 *   • A persisted Svelte store (`locale`) + a derived `t` store let components
 *     do `{$t('hero.tagline')}` and re-render reactively on language change.
 *
 * Adding strings: add the key to EVERY locale block below. `MessageKey` is the
 * union of English keys, so `astro check` (CI) flags any `$t('typo')` and any
 * locale missing a key it shouldn't.
 */

export const LOCALES = ['en', 'ja', 'zh-TW', 'es'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  ja: '日本語',
  'zh-TW': '繁體中文',
  es: 'Español',
};

export const DEFAULT_LOCALE: Locale = 'en';

const en = {
  'hero.title': 'markmint',
  'hero.tagline':
    'Turn any image into a clean, recolorable SVG logo or icon — in your browser. No upload, no signup, open source.',

  'dropzone.cta': 'Drop an image here, or click to choose',
  'dropzone.hint': 'PNG · JPG · WebP · BMP — converted locally in your browser, nothing is uploaded.',
  'dropzone.change': 'Choose different file',

  'action.convert': 'Convert',
  'action.tracing': 'Tracing…',
  'action.download': 'Download',
  'action.iconPack': 'Icon pack',
  'action.iconPack.title':
    'Download a favicon + app-icon pack (.ico, PNGs, manifest, HTML snippet) as a zip',
  'action.reset': 'Reset',
  'action.restoreAll': 'Restore all',
  'action.save': 'Save',

  'section.preset': 'Preset',
  'section.backdrop': 'Backdrop',
  'section.layers': 'Layers',
  'section.advanced': 'Advanced settings',
  'section.aspect': 'Aspect',

  'toggle.livePreview': 'Live preview',
  'toggle.svgo': 'SVGO',

  'tool.selectShape': 'Select Shape',
  'tool.eraser': 'Eraser Tool',
  'tool.hideShape': 'Hide Shape',
  'tool.isolate': 'Isolate',

  'empty.adjust': 'Adjust settings on the left to see the SVG output.',

  'switcher.label': 'Language',
} as const;

export type MessageKey = keyof typeof en;
type Dict = Record<MessageKey, string>;

const ja: Dict = {
  'hero.title': 'markmint',
  'hero.tagline':
    'どんな画像も、きれいで色を変えられる SVG ロゴ・アイコンに — ブラウザだけで。アップロード不要、登録不要、オープンソース。',

  'dropzone.cta': '画像をここにドロップ、またはクリックして選択',
  'dropzone.hint': 'PNG・JPG・WebP・BMP — ブラウザ内でローカル変換。アップロードは一切ありません。',
  'dropzone.change': '別のファイルを選ぶ',

  'action.convert': '変換',
  'action.tracing': 'トレース中…',
  'action.download': 'ダウンロード',
  'action.iconPack': 'アイコンパック',
  'action.iconPack.title':
    'ファビコン＋アプリアイコン一式（.ico、PNG、マニフェスト、HTML スニペット）を zip でダウンロード',
  'action.reset': 'リセット',
  'action.restoreAll': 'すべて復元',
  'action.save': '保存',

  'section.preset': 'プリセット',
  'section.backdrop': '背景',
  'section.layers': 'レイヤー',
  'section.advanced': '詳細設定',
  'section.aspect': 'アスペクト比',

  'toggle.livePreview': 'ライブプレビュー',
  'toggle.svgo': 'SVGO',

  'tool.selectShape': '図形を選択',
  'tool.eraser': '消しゴム',
  'tool.hideShape': '図形を隠す',
  'tool.isolate': '分離',

  'empty.adjust': '左側の設定を調整すると SVG 出力が表示されます。',

  'switcher.label': '言語',
};

// 繁體中文 (Traditional Chinese) — Taiwan. Never Simplified.
const zhTW: Dict = {
  'hero.title': 'markmint',
  'hero.tagline':
    '把任何圖片變成乾淨、可重新上色的 SVG 標誌或圖示 — 全程在瀏覽器內完成。免上傳、免註冊、開源。',

  'dropzone.cta': '把圖片拖曳到這裡，或點擊選擇',
  'dropzone.hint': 'PNG · JPG · WebP · BMP — 在你的瀏覽器內本機轉換，不會上傳任何檔案。',
  'dropzone.change': '選擇其他檔案',

  'action.convert': '轉換',
  'action.tracing': '描繪中…',
  'action.download': '下載',
  'action.iconPack': '圖示包',
  'action.iconPack.title': '下載 favicon 與 App 圖示包（.ico、PNG、manifest、HTML 片段）的 zip 壓縮檔',
  'action.reset': '重設',
  'action.restoreAll': '全部還原',
  'action.save': '儲存',

  'section.preset': '預設',
  'section.backdrop': '背景',
  'section.layers': '圖層',
  'section.advanced': '進階設定',
  'section.aspect': '長寬比',

  'toggle.livePreview': '即時預覽',
  'toggle.svgo': 'SVGO',

  'tool.selectShape': '選取形狀',
  'tool.eraser': '橡皮擦',
  'tool.hideShape': '隱藏形狀',
  'tool.isolate': '單獨顯示',

  'empty.adjust': '調整左側設定即可看到 SVG 輸出。',

  'switcher.label': '語言',
};

const es: Dict = {
  'hero.title': 'markmint',
  'hero.tagline':
    'Convierte cualquier imagen en un logo o icono SVG limpio y recoloreable — en tu navegador. Sin subidas, sin registro, código abierto.',

  'dropzone.cta': 'Arrastra una imagen aquí o haz clic para elegir',
  'dropzone.hint': 'PNG · JPG · WebP · BMP — se convierten localmente en tu navegador, no se sube nada.',
  'dropzone.change': 'Elegir otro archivo',

  'action.convert': 'Convertir',
  'action.tracing': 'Trazando…',
  'action.download': 'Descargar',
  'action.iconPack': 'Pack de iconos',
  'action.iconPack.title':
    'Descarga un pack de favicon + iconos de app (.ico, PNG, manifiesto, fragmento HTML) en un zip',
  'action.reset': 'Restablecer',
  'action.restoreAll': 'Restaurar todo',
  'action.save': 'Guardar',

  'section.preset': 'Ajuste',
  'section.backdrop': 'Fondo',
  'section.layers': 'Capas',
  'section.advanced': 'Ajustes avanzados',
  'section.aspect': 'Proporción',

  'toggle.livePreview': 'Vista previa en vivo',
  'toggle.svgo': 'SVGO',

  'tool.selectShape': 'Seleccionar forma',
  'tool.eraser': 'Borrador',
  'tool.hideShape': 'Ocultar forma',
  'tool.isolate': 'Aislar',

  'empty.adjust': 'Ajusta la configuración de la izquierda para ver la salida SVG.',

  'switcher.label': 'Idioma',
};

export const TRANSLATIONS: Record<Locale, Dict> = {
  en,
  ja,
  'zh-TW': zhTW,
  es,
};

/**
 * Translate `key` for `locale`, substituting `{placeholder}` params.
 * Falls back: requested locale → English → the raw key.
 */
export function translate(
  locale: Locale,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const template = TRANSLATIONS[locale]?.[key] ?? TRANSLATIONS[DEFAULT_LOCALE][key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in params ? String(params[name]) : m,
  );
}

/** True if `value` is one of the supported locales. */
export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * Best supported locale for a list of preferences (defaults to the browser's).
 * Matches exact tags first ("zh-TW"), then the base language ("zh", "ja").
 */
export function detectLocale(
  preferred?: readonly string[],
): Locale {
  const prefs =
    preferred ??
    (typeof navigator !== 'undefined'
      ? navigator.languages ?? [navigator.language]
      : []);
  for (const raw of prefs) {
    if (!raw) continue;
    if (isLocale(raw)) return raw;
    const base = raw.toLowerCase().split('-')[0];
    // zh without a region → default the brand's audience to Traditional.
    if (base === 'zh') return 'zh-TW';
    const match = LOCALES.find((l) => l.toLowerCase().split('-')[0] === base);
    if (match) return match;
  }
  return DEFAULT_LOCALE;
}
