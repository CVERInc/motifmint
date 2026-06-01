<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Upload from '@lucide/svelte/icons/upload';
  import Download from '@lucide/svelte/icons/download';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import Loader2 from '@lucide/svelte/icons/loader-2';
  import AlertCircle from '@lucide/svelte/icons/alert-circle';
  import ImageIcon from '@lucide/svelte/icons/image';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import Save from '@lucide/svelte/icons/save';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import EyeOff from '@lucide/svelte/icons/eye-off';
  import MousePointer from '@lucide/svelte/icons/mouse-pointer';
  import Eraser from '@lucide/svelte/icons/eraser';
  import {
    PRESETS,
    PRESET_PARAMS,
    clonePreset,
    paramsEqual,
    type PresetId,
    type TracerParams,
  } from '~/lib/presets';
  import { decodeImage } from '~/lib/decode';
  import { formatBytes, stripExtension } from '~/lib/format';
  import {
    loadCustomPresets,
    addCustomPreset,
    removeCustomPreset,
    type CustomPreset,
  } from '~/lib/custom-presets';
  import {
    bakeBackdrop,
    DEFAULT_BACKDROP,
    backdropCss,
    backdropVisible,
    readViewBox,
    type BackdropOpts,
  } from '~/lib/backdrop';
  import { injectOrigIdx, removePaths } from '~/lib/punch-hole';
  import {
    parsePathList,
    applyPathOverrides,
    collectRemoved,
    setPathFill,
    setPathRemoved,
    bulkSetFill,
    bulkSetRemoved,
    type PathState,
    type PathInfo,
  } from '~/lib/path-state';
  import {
    applyColorGradients,
    shade,
    GRADIENT_PRESETS,
    type GradientSpec,
  } from '~/lib/gradient';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import Package from '@lucide/svelte/icons/package';
  import Copy from '@lucide/svelte/icons/copy';
  import Check from '@lucide/svelte/icons/check';
  import { zipSync } from 'fflate';
  import { buildIco } from '~/lib/ico';
  import {
    ICON_SPECS,
    ICO_SIZES,
    generateWebManifest,
    generateHtmlSnippet,
  } from '~/lib/icon-pack';
  import {
    toComponentName,
    toDataUri,
    toReactComponent,
    toVueComponent,
  } from '~/lib/copy-as';
  import {
    composeLayers,
    IDENTITY_TRANSFORM,
    type ComposeLayer,
    type LayerTransform,
  } from '~/lib/compose-layers';
  import Plus from '@lucide/svelte/icons/plus';
  import Eye from '@lucide/svelte/icons/eye';
  import Images from '@lucide/svelte/icons/images';
  import Undo2 from '@lucide/svelte/icons/undo-2';
  import Redo2 from '@lucide/svelte/icons/redo-2';
  import Wand2 from '@lucide/svelte/icons/wand-2';
  import { History } from '~/lib/history';
  import { detectBackgroundColor, type PathBox } from '~/lib/background';
  import { applyEffects, type EffectOptions } from '~/lib/effects';
  import { imageToAscii } from '~/lib/ascii';
  import { previewView, hasImage } from '~/lib/view-store';
  import { buildSizeSet, DEFAULT_SCALES } from '~/lib/export-set';
  import {
    loadGradientPresets,
    addGradientPreset,
    removeGradientPreset,
    type SavedGradient,
  } from '~/lib/gradient-presets';
  import type { WorkerRequest, WorkerResponse } from '~/lib/trace.worker';
  import CompareSlider from './CompareSlider.svelte';
  import AsciiCompare from './AsciiCompare.svelte';

  type Status = 'idle' | 'converting' | 'done' | 'error';

  let file = $state<File | null>(null);
  let previewUrl = $state<string | null>(null);
  let pixelsCache = $state<{ buffer: ArrayBuffer; width: number; height: number } | null>(null);

  let preset = $state<PresetId>('logo');
  let params = $state<TracerParams>(clonePreset('logo'));
  let advancedOpen = $state(false);
  let livePreview = $state(true);
  let optimize = $state(true);

  // The primary image's traced SVG (the one the left panel tunes). The
  // pipeline consumes `svg`, which is the composition of this base layer plus
  // any added image layers — see the `svg` derived below.
  let baseSvg = $state<string | null>(null);
  let baseTransform = $state<LayerTransform>({ ...IDENTITY_TRANSFORM });
  let baseHidden = $state(false);

  // Extra image layers, each independently traced and composited into the
  // single mark. Empty = classic single-image behaviour (byte-identical).
  interface ImageLayer {
    id: number;
    name: string;
    previewUrl: string;
    rawSvg: string | null; // null until its trace finishes
    transform: LayerTransform;
    hidden: boolean;
  }
  let extraLayers = $state<ImageLayer[]>([]);
  let selectedLayerId = $state<number | 'base'>('base');
  let nextLayerId = 1;

  // Composed mark fed to the whole edit/export pipeline. A lone, untransformed
  // base passes through verbatim (composeLayers short-circuits), so adding no
  // layers changes nothing.
  const svg = $derived.by<string | null>(() => {
    if (baseSvg == null) return null;
    const layers: ComposeLayer[] = [{ svg: baseSvg, transform: baseTransform, hidden: baseHidden }];
    for (const l of extraLayers) {
      if (l.rawSvg) layers.push({ svg: l.rawSvg, transform: l.transform, hidden: l.hidden });
    }
    return composeLayers(layers);
  });
  const hasLayers = $derived(extraLayers.length > 0);
  // Always reflects the composed output, not just the base trace.
  const outputBytes = $derived(svg ? new TextEncoder().encode(svg).length : 0);

  // Tell the header nav whether there's an image to switch views on.
  $effect(() => {
    hasImage.set(svg != null);
  });

  let durationMs = $state(0);
  let status = $state<Status>('idle');
  let errorMessage = $state<string | null>(null);
  let dragOver = $state(false);

  let customPresets = $state<CustomPreset[]>([]);
  let newPresetName = $state('');

  let backdrop = $state<BackdropOpts>({ ...DEFAULT_BACKDROP });
  let pathStates = $state<Map<number, PathState>>(new Map());
  // Per-color-group gradient fills, keyed by the group's original fill hex.
  let colorGradients = $state<Map<string, GradientSpec>>(new Map());
  let expandedGroups = $state<Set<string>>(new Set());
  let hoveredPathIdx = $state<number | null>(null);
  let speckleThreshold = $state(0);
  let specklePreviewing = $state(false);
  let specklePreviewTimer: ReturnType<typeof setTimeout> | null = null;
  let pathBBoxes = $state<Map<number, { w: number; h: number; x: number; y: number }>>(new Map());

  function specklePreviewOn() {
    if (specklePreviewTimer) {
      clearTimeout(specklePreviewTimer);
      specklePreviewTimer = null;
    }
    specklePreviewing = true;
  }
  function specklePreviewOffSoon() {
    if (specklePreviewTimer) clearTimeout(specklePreviewTimer);
    specklePreviewTimer = setTimeout(() => {
      specklePreviewing = false;
      specklePreviewTimer = null;
    }, 600);
  }

  // Measure all paths once when taggedSvg changes, caching their bounding boxes.
  $effect(() => {
    if (taggedSvg && typeof document !== 'undefined') {
      const wrapper = document.createElement('div');
      wrapper.style.position = 'fixed';
      wrapper.style.left = '-99999px';
      wrapper.style.width = '1px';
      wrapper.style.height = '1px';
      wrapper.style.visibility = 'hidden';
      wrapper.innerHTML = taggedSvg;
      const svgEl = wrapper.querySelector('svg');
      if (svgEl) {
        document.body.appendChild(wrapper);
        const paths = Array.from(svgEl.querySelectorAll('path[data-orig-idx]')) as SVGPathElement[];
        const nextBBoxes = new Map<number, { w: number; h: number; x: number; y: number }>();
        for (const p of paths) {
          const idxAttr = p.getAttribute('data-orig-idx');
          if (idxAttr) {
            const idx = parseInt(idxAttr, 10);
            try {
              const bb = p.getBBox();
              nextBBoxes.set(idx, { w: bb.width, h: bb.height, x: bb.x, y: bb.y });
            } catch {
              nextBBoxes.set(idx, { w: 0, h: 0, x: 0, y: 0 });
            }
          }
        }
        pathBBoxes = nextBBoxes;
        wrapper.remove();
      } else {
        pathBBoxes = new Map();
      }
    } else {
      pathBBoxes = new Map();
    }
  });

  const autoHiddenIdxs = $derived.by(() => {
    const set = new Set<number>();
    if (speckleThreshold > 0) {
      for (const [idx, box] of pathBBoxes) {
        if (box.w * box.h <= speckleThreshold) {
          set.add(idx);
        }
      }
    }
    return set;
  });

  function setHoveredOrigIdx(origIdx: number | null) {
    hoveredPathIdx = origIdx;
  }

  // Tagged SVG (with data-orig-idx on every <path>) so we can refer to
  // paths by their original index even after some are merged away.
  const taggedSvg = $derived(svg ? injectOrigIdx(svg) : null);
  const pathList = $derived(taggedSvg ? parsePathList(taggedSvg) : []);

  // Group paths by original fill color for the Layers panel.
  interface PathGroup {
    color: string;
    paths: PathInfo[];
  }
  const groupedPaths = $derived.by<PathGroup[]>(() => {
    const groups = new Map<string, PathInfo[]>();
    for (const p of pathList) {
      const list = groups.get(p.originalFill) ?? [];
      list.push(p);
      groups.set(p.originalFill, list);
    }
    return [...groups.entries()].map(([color, paths]) => ({ color, paths }));
  });

  // Display pipeline:
  //  1. Apply per-path fill overrides
  //  2. Punch / hide paths marked as removed
  const withOverrides = $derived(
    taggedSvg ? applyPathOverrides(taggedSvg, pathStates, autoHiddenIdxs, specklePreviewing) : null,
  );
  const removedIdxs = $derived(collectRemoved(pathStates));

  // Finishing effects (outline / shadow / glow). Slider values are percentages
  // of the mark's shorter side; `effectOptions` scales them into user units.
  let fx = $state({
    outline: { on: false, width: 3, color: '#ffffff' },
    shadow: { on: false, blur: 3, dx: 0, dy: 4, color: '#000000', opacity: 0.35 },
    glow: { on: false, blur: 4, color: '#ffffff', opacity: 0.6 },
  });
  const effectOptions = $derived.by<EffectOptions>(() => {
    const vb = svg ? readViewBox(svg) : null;
    const base = vb ? Math.min(vb.w, vb.h) : 100;
    const pct = (n: number) => (n / 100) * base;
    const o: EffectOptions = {};
    if (fx.outline.on) o.outline = { width: pct(fx.outline.width), color: fx.outline.color };
    if (fx.shadow.on)
      o.shadow = {
        blur: pct(fx.shadow.blur),
        dx: pct(fx.shadow.dx),
        dy: pct(fx.shadow.dy),
        color: fx.shadow.color,
        opacity: fx.shadow.opacity,
      };
    if (fx.glow.on) o.glow = { blur: pct(fx.glow.blur), color: fx.glow.color, opacity: fx.glow.opacity };
    return o;
  });

  const displaySvg = $derived.by(() => {
    if (!withOverrides) return null;
    const withGradients =
      colorGradients.size > 0
        ? applyColorGradients(withOverrides, colorGradients, pathList)
        : withOverrides;
    const composed =
      removedIdxs.length > 0 ? removePaths(withGradients, removedIdxs) : withGradients;
    return applyEffects(composed, effectOptions);
  });

  // ── Undo / redo for shape edits (recolor / hide / erase / gradient) ─────────
  interface EditSnapshot {
    pathStates: Map<number, PathState>;
    colorGradients: Map<string, GradientSpec>;
  }
  const editHistory = new History<EditSnapshot>(100);
  let canUndo = $state(false);
  let canRedo = $state(false);

  function editSnapshot(): EditSnapshot {
    return { pathStates: new Map(pathStates), colorGradients: new Map(colorGradients) };
  }
  function snapEqual(a: EditSnapshot, b: EditSnapshot): boolean {
    if (a.pathStates.size !== b.pathStates.size) return false;
    if (a.colorGradients.size !== b.colorGradients.size) return false;
    for (const [k, v] of a.pathStates) {
      const o = b.pathStates.get(k);
      if (!o || o.fill !== v.fill || o.removed !== v.removed) return false;
    }
    for (const [k, v] of a.colorGradients) {
      if (JSON.stringify(b.colorGradients.get(k)) !== JSON.stringify(v)) return false;
    }
    return true;
  }
  function syncHistoryFlags() {
    canUndo = editHistory.canUndo;
    canRedo = editHistory.canRedo;
  }
  function applySnapshot(s: EditSnapshot) {
    pathStates = new Map(s.pathStates);
    colorGradients = new Map(s.colorGradients);
  }
  function undoEdit() {
    const s = editHistory.undo();
    if (s) applySnapshot(s); // cursor now equals s → recorder self-skips
    syncHistoryFlags();
  }
  function redoEdit() {
    const s = editHistory.redo();
    if (s) applySnapshot(s);
    syncHistoryFlags();
  }
  function onKeydown(e: KeyboardEvent) {
    if (!(e.metaKey || e.ctrlKey)) return;
    const t = e.target as HTMLElement | null;
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    const key = e.key.toLowerCase();
    if (key === 'z') {
      e.preventDefault();
      if (e.shiftKey) redoEdit();
      else undoEdit();
    } else if (key === 'y') {
      e.preventDefault();
      redoEdit();
    }
  }

  // Reset per-path state whenever the source SVG changes (new trace / recompose).
  let lastSvgRef = $state<string | null>(null);
  $effect(() => {
    if (svg !== lastSvgRef) {
      lastSvgRef = svg;
      pathStates = new Map();
      colorGradients = new Map();
      expandedGroups = new Set();
      hoveredPathIdx = null;
      speckleThreshold = 0;
      editHistory.reset({ pathStates: new Map(), colorGradients: new Map() });
      syncHistoryFlags();
    }
  });

  // Record an undo step whenever the edit maps drift from the history cursor.
  // After undo/redo the cursor already holds the restored state, so this
  // self-skips — no restore flag needed.
  $effect(() => {
    pathStates;
    colorGradients; // track
    const top = editHistory.current;
    if (!top) return;
    const snap = editSnapshot();
    if (snapEqual(snap, top)) return;
    editHistory.push(snap);
    syncHistoryFlags();
  });

  // Bidirectional hover sync: highlight the canvas path when hovering a
  // Layers row, and vice versa.
  $effect(() => {
    if (typeof document === 'undefined') return;
    const idx = hoveredPathIdx;
    const wraps = document.querySelectorAll('.result-preview svg path, .svg-layer svg path');
    wraps.forEach((p) => {
      const pidx = parseInt((p as Element).getAttribute('data-orig-idx') ?? '-1', 10);
      if (pidx === idx) {
        (p as SVGElement).setAttribute('data-hovered', 'true');
      } else {
        (p as SVGElement).removeAttribute('data-hovered');
      }
    });
  });

  let worker: Worker | null = null;
  let pendingId = 0;
  let lastBaseId = 0; // most-recent base-trace request (older ones are stale)
  // Routes each worker request to its target: the base image or a layer id.
  const pendingTargets = new Map<number, number | 'base'>();
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const presetLabel = $derived(PRESETS.find((p) => p.id === preset)?.label ?? '');
  const modified = $derived(!paramsEqual(params, PRESET_PARAMS[preset]));

  const detailLevel = $derived(deriveDetail(params));

  function deriveDetail(p: TracerParams): number {
    const fromSpeckle = Math.round(((12 - Math.min(12, p.filterSpeckle)) * 9) / 12 + 1);
    return Math.max(1, Math.min(10, fromSpeckle));
  }

  function setDetail(d: number) {
    params.filterSpeckle = Math.round(((10 - d) * 12) / 9);
    params.colorPrecision = Math.max(1, Math.min(8, Math.round(2 + ((d - 1) * 6) / 9)));
  }

  onMount(() => {
    customPresets = loadCustomPresets();
    savedGradients = loadGradientPresets();
    measureCellAspect();
    worker = new Worker(new URL('../lib/trace.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const target = pendingTargets.get(e.data.id);
      if (target === undefined) return; // stale / unknown request
      pendingTargets.delete(e.data.id);

      if (e.data.type === 'error') {
        errorMessage = e.data.message;
        status = 'error';
        return;
      }
      if (target === 'base') {
        if (e.data.id !== lastBaseId) return; // a newer base trace superseded this
        baseSvg = e.data.svg;
        durationMs = e.data.durationMs;
        status = 'done';
      } else {
        const layer = extraLayers.find((l) => l.id === target);
        if (layer) layer.rawSvg = e.data.svg; // $state is deep-reactive
        status = 'done';
      }
    };
  });

  onDestroy(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (worker) worker.terminate();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    for (const l of extraLayers) URL.revokeObjectURL(l.previewUrl);
  });

  function selectPreset(id: PresetId) {
    preset = id;
    params = clonePreset(id);
    schedule();
  }

  function loadCustomPreset(p: CustomPreset) {
    params = { ...p.params };
    schedule();
  }

  function saveCurrentAsPreset() {
    const name = newPresetName.trim();
    if (!name) return;
    customPresets = addCustomPreset(name, params);
    newPresetName = '';
  }

  function deleteCustomPreset(name: string) {
    customPresets = removeCustomPreset(name);
  }

  function resetToPreset() {
    params = clonePreset(preset);
    schedule();
  }

  function togglePathRemoved(origIdx: number) {
    const cur = pathStates.get(origIdx);
    pathStates = setPathRemoved(pathStates, origIdx, !cur?.removed);
  }
  function setPathColor(origIdx: number, color: string) {
    pathStates = setPathFill(pathStates, origIdx, color);
  }
  function clearPathColor(origIdx: number) {
    pathStates = setPathFill(pathStates, origIdx, undefined);
  }
  function bulkColor(originalFill: string, color: string) {
    pathStates = bulkSetFill(pathStates, pathList, originalFill, color);
  }
  function bulkRemove(originalFill: string, removed: boolean) {
    pathStates = bulkSetRemoved(pathStates, pathList, originalFill, removed);
  }

  // ── One-click background removal ────────────────────────────────────────────
  const detectedBackground = $derived.by<string | null>(() => {
    if (!svg || pathBBoxes.size === 0) return null;
    const vb = readViewBox(svg);
    if (!vb) return null;
    const boxes: PathBox[] = [];
    for (const p of pathList) {
      const bb = pathBBoxes.get(p.origIdx);
      if (bb) boxes.push({ fill: p.originalFill, x: bb.x, y: bb.y, w: bb.w, h: bb.h });
    }
    return detectBackgroundColor(boxes, vb);
  });
  // Hide the button once the detected background's paths are all removed.
  const backgroundRemoved = $derived.by(() => {
    if (!detectedBackground) return false;
    const grp = pathList.filter((p) => p.originalFill === detectedBackground);
    return grp.length > 0 && grp.every((p) => pathStates.get(p.origIdx)?.removed);
  });
  function removeBackground() {
    if (detectedBackground) bulkRemove(detectedBackground, true);
  }

  // ── Gradient fills (per color group) ──────────────────────────────
  function setColorGradient(key: string, spec: GradientSpec | undefined) {
    const next = new Map(colorGradients);
    if (spec) next.set(key, spec);
    else next.delete(key);
    colorGradients = next;
  }
  function toggleGroupGradient(key: string, baseFill: string) {
    if (colorGradients.has(key)) {
      setColorGradient(key, undefined);
    } else {
      setColorGradient(key, {
        stops: [
          { color: baseFill, offset: 0 },
          { color: shade(baseFill, 0.55), offset: 100 },
        ],
        angle: 90,
      });
    }
  }
  function setGradientStop(key: string, i: number, color: string) {
    const cur = colorGradients.get(key);
    if (!cur) return;
    const stops = cur.stops.map((s, idx) => (idx === i ? { ...s, color } : s));
    setColorGradient(key, { ...cur, stops });
  }
  function setGradientAngle(key: string, angle: number) {
    const cur = colorGradients.get(key);
    if (!cur) return;
    setColorGradient(key, { ...cur, angle });
  }
  function setGradientType(key: string, type: 'linear' | 'radial') {
    const cur = colorGradients.get(key);
    if (!cur) return;
    setColorGradient(key, { ...cur, type });
  }
  // Savable gradient presets (reuse a gradient across colors / sessions).
  let savedGradients = $state<SavedGradient[]>([]);
  function saveCurrentGradient(key: string) {
    const cur = colorGradients.get(key);
    if (!cur) return;
    savedGradients = addGradientPreset(`Gradient ${savedGradients.length + 1}`, cur, Date.now());
  }
  function applySavedGradient(key: string, sg: SavedGradient) {
    setColorGradient(key, structuredClone(sg.spec));
  }
  function deleteSavedGradient(name: string) {
    savedGradients = removeGradientPreset(name);
  }
  function applyGradientPreset(key: string, a: string, b: string, angle: number) {
    setColorGradient(key, {
      stops: [
        { color: a, offset: 0 },
        { color: b, offset: 100 },
      ],
      angle,
    });
  }

  function resetAllPaths() {
    pathStates = new Map();
    colorGradients = new Map();
    speckleThreshold = 0;
  }
  function runSmartClean() {
    speckleThreshold = 30;
    if (params.filterSpeckle < 6) {
      params.filterSpeckle = 6;
    }
    if (params.colorMode === 0 && params.layerDifference < 24) {
      params.layerDifference = 24;
    }
  }
  function toggleGroup(color: string) {
    const next = new Set(expandedGroups);
    if (next.has(color)) next.delete(color);
    else next.add(color);
    expandedGroups = next;
  }

  let activeTool = $state<'select' | 'eraser'>('select');
  let selectedPathIdx = $state<number | null>(null);
  let popoverPosition = $state<{ x: number; y: number } | null>(null);

  function handlePathClick(origIdx: number, event?: MouseEvent) {
    if (activeTool === 'eraser') {
      togglePathRemoved(origIdx);
    } else {
      // Select mode: Open popover
      if (selectedPathIdx === origIdx) {
        selectedPathIdx = null;
        popoverPosition = null;
      } else {
        selectedPathIdx = origIdx;
        if (event) {
          popoverPosition = { x: event.clientX, y: event.clientY };
        } else {
          popoverPosition = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        }
      }
    }
  }

  function handleMarqueeSelect(box: { x: number; y: number; w: number; h: number }) {
    if (typeof document === 'undefined') return;
    const compareContainer = document.querySelector('.compare');
    const svgEl = compareContainer?.querySelector('.svg-layer svg') as SVGSVGElement | null;
    if (!compareContainer || !svgEl) return;

    const vbAttr = svgEl.getAttribute('viewBox');
    if (!vbAttr) return;
    const vbParts = vbAttr.trim().split(/[\s,]+/).map(Number);
    if (vbParts.length !== 4) return;
    const [vbX, vbY, vbW, vbH] = vbParts;

    const svgRect = svgEl.getBoundingClientRect();
    const containerRect = compareContainer.getBoundingClientRect();

    const relativeX = box.x - (svgRect.left - containerRect.left);
    const relativeY = box.y - (svgRect.top - containerRect.top);

    const scaleX = vbW / svgRect.width;
    const scaleY = vbH / svgRect.height;

    const selX = vbX + relativeX * scaleX;
    const selY = vbY + relativeY * scaleY;
    const selW = box.w * scaleX;
    const selH = box.h * scaleY;

    const toRemove: number[] = [];
    for (const [idx, pathBox] of pathBBoxes) {
      const intersects = (
        pathBox.x < selX + selW &&
        pathBox.x + pathBox.w > selX &&
        pathBox.y < selY + selH &&
        pathBox.y + pathBox.h > selY
      );
      if (intersects) {
        toRemove.push(idx);
      }
    }

    if (toRemove.length > 0) {
      let nextStates = pathStates;
      for (const idx of toRemove) {
        nextStates = setPathRemoved(nextStates, idx, true);
      }
      pathStates = nextStates;
    }
  }

  $effect(() => {
    JSON.stringify(params);
    optimize;
    schedule();
  });

  function schedule() {
    if (!livePreview || !pixelsCache || !worker) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => runConvert(), 350);
  }

  async function pickFile(f: File) {
    if (!/^image\/(png|jpe?g|webp|bmp)$/i.test(f.type)) {
      errorMessage = `Unsupported file type: ${f.type || 'unknown'}`;
      status = 'error';
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    // A fresh primary image starts a new composition, in SVG view.
    clearExtraLayers();
    baseTransform = { ...IDENTITY_TRANSFORM };
    baseHidden = false;
    selectedLayerId = 'base';
    previewView.set('svg');
    file = f;
    previewUrl = URL.createObjectURL(f);
    baseSvg = null;
    errorMessage = null;
    status = 'idle';

    try {
      const decoded = await decodeImage(f);
      pixelsCache = {
        buffer: decoded.data.buffer.slice(0),
        width: decoded.width,
        height: decoded.height,
      };
      if (livePreview) runConvert();
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      status = 'error';
    }
  }

  function onFileInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    if (f) pickFile(f);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    const f = e.dataTransfer?.files?.[0];
    if (f) pickFile(f);
  }

  // ── Image layers: add / remove / order / position ──────────────────────────
  function clearExtraLayers() {
    for (const l of extraLayers) URL.revokeObjectURL(l.previewUrl);
    extraLayers = [];
  }

  async function addImageLayer(f: File) {
    if (!/^image\/(png|jpe?g|webp|bmp)$/i.test(f.type)) {
      errorMessage = `Unsupported file type: ${f.type || 'unknown'}`;
      status = 'error';
      return;
    }
    if (!worker) return;
    const id = nextLayerId++;
    const layer: ImageLayer = {
      id,
      name: f.name,
      previewUrl: URL.createObjectURL(f),
      rawSvg: null,
      transform: { ...IDENTITY_TRANSFORM },
      hidden: false,
    };
    extraLayers = [...extraLayers, layer];
    selectedLayerId = id;
    try {
      const decoded = await decodeImage(f);
      const reqId = ++pendingId;
      pendingTargets.set(reqId, id);
      status = 'converting';
      const clone = decoded.data.buffer.slice(0);
      const req: WorkerRequest = {
        id: reqId,
        pixels: clone,
        width: decoded.width,
        height: decoded.height,
        params: { ...params }, // traced with the current preset/params
        optimize,
      };
      worker.postMessage(req, [clone]);
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      status = 'error';
    }
  }

  function onAddLayerInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    if (f) addImageLayer(f);
    input.value = ''; // allow re-adding the same file
  }

  function removeLayer(id: number | 'base') {
    if (id === 'base') return; // base can't be removed, only replaced
    const layer = extraLayers.find((l) => l.id === id);
    if (layer) URL.revokeObjectURL(layer.previewUrl);
    extraLayers = extraLayers.filter((l) => l.id !== id);
    if (selectedLayerId === id) selectedLayerId = 'base';
  }

  function toggleLayerHidden(id: number | 'base') {
    if (id === 'base') baseHidden = !baseHidden;
    else {
      const l = extraLayers.find((x) => x.id === id);
      if (l) l.hidden = !l.hidden;
    }
  }

  function moveLayer(id: number | 'base', dir: -1 | 1) {
    if (id === 'base') return;
    const i = extraLayers.findIndex((l) => l.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= extraLayers.length) return;
    const next = [...extraLayers];
    [next[i], next[j]] = [next[j], next[i]];
    extraLayers = next;
  }

  /** The transform of whichever layer the position panel is editing. */
  const selectedTransform = $derived.by<LayerTransform>(() => {
    if (selectedLayerId === 'base') return baseTransform;
    return extraLayers.find((l) => l.id === selectedLayerId)?.transform ?? baseTransform;
  });
  const selectedHidden = $derived(
    selectedLayerId === 'base'
      ? baseHidden
      : (extraLayers.find((l) => l.id === selectedLayerId)?.hidden ?? false),
  );

  function updateSelectedTransform(patch: Partial<LayerTransform>) {
    if (selectedLayerId === 'base') {
      baseTransform = { ...baseTransform, ...patch };
    } else {
      const l = extraLayers.find((x) => x.id === selectedLayerId);
      if (l) l.transform = { ...l.transform, ...patch };
    }
  }

  function runConvert() {
    if (!pixelsCache || !worker) return;
    errorMessage = null;
    status = 'converting';
    lastBaseId = ++pendingId;
    pendingTargets.set(lastBaseId, 'base');
    const clone = pixelsCache.buffer.slice(0);
    const req: WorkerRequest = {
      id: lastBaseId,
      pixels: clone,
      width: pixelsCache.width,
      height: pixelsCache.height,
      params: { ...params },
      optimize,
    };
    worker.postMessage(req, [clone]);
  }

  // Bake all edits (recolor / hide / punch-hole / backdrop) into one clean SVG.
  function buildFinalSvg(): string | null {
    if (!svg) return null;
    const tagged = injectOrigIdx(svg);
    const overridden = applyPathOverrides(tagged, pathStates);
    // Gradients need data-orig-idx, so apply before the strip below.
    const gradiented =
      colorGradients.size > 0
        ? applyColorGradients(overridden, colorGradients, pathList)
        : overridden;
    const removed = removedIdxs.length > 0 ? removePaths(gradiented, removedIdxs) : gradiented;
    // Strip the data-orig-idx attrs from the final output (clean SVG)
    const cleaned = removed.replace(/\sdata-orig-idx="\d+"/g, '');
    // Finishing effects wrap the mark; the backdrop is then baked behind it.
    const styled = applyEffects(cleaned, effectOptions);
    return bakeBackdrop(styled, backdrop);
  }

  function saveBlob(blob: Blob, ext: string, baseName?: string) {
    if (!file) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName ?? stripExtension(file.name)}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Raster export: render the composed SVG to a canvas via the browser's own
  // image pipeline (no extra WASM) and read it back with toBlob. Single
  // direction only — we export the traced/composed result, never transcode
  // an arbitrary upload.
  type RasterFmt = 'png' | 'webp' | 'jpeg';
  const RASTER_MIME: Record<RasterFmt, string> = {
    png: 'image/png',
    webp: 'image/webp',
    jpeg: 'image/jpeg',
  };

  let downloadFormat = $state<'svg' | RasterFmt>('svg');
  let rasterSize = $state<number>(512); // longest edge in px (0 = source resolution)
  let exporting = $state(false);

  async function rasterize(finalSvg: string, fmt: RasterFmt, sizeOverride?: number): Promise<Blob> {
    const vb = readViewBox(finalSvg);
    const ar = vb && vb.h > 0 ? vb.w / vb.h : 1;
    const longest =
      sizeOverride ??
      (rasterSize > 0
        ? rasterSize
        : Math.max(pixelsCache?.width ?? 512, pixelsCache?.height ?? 512));
    const w = ar >= 1 ? longest : Math.max(1, Math.round(longest * ar));
    const h = ar >= 1 ? Math.max(1, Math.round(longest / ar)) : longest;

    // Give the SVG explicit pixel dims so the <img> rasterizes at full res.
    const sized = finalSvg.replace(
      /<svg([^>]*)>/i,
      (_m, attrs: string) =>
        `<svg${attrs.replace(/\s(?:width|height)\s*=\s*"[^"]*"/gi, '')} width="${w}" height="${h}">`,
    );

    const url = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const img = new Image();
      img.decoding = 'async';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Could not render SVG'));
        img.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not available');
      // JPEG has no alpha — flatten transparency onto white instead of black.
      if (fmt === 'jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
      }
      ctx.drawImage(img, 0, 0, w, h);
      return await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Export failed'))),
          RASTER_MIME[fmt],
          fmt === 'jpeg' ? 0.92 : undefined,
        ),
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function download() {
    if (!svg || !file || exporting) return;
    const finalSvg = buildFinalSvg();
    if (!finalSvg) return;
    if (downloadFormat === 'svg') {
      saveBlob(new Blob([finalSvg], { type: 'image/svg+xml' }), 'svg');
      return;
    }
    exporting = true;
    try {
      const blob = await rasterize(finalSvg, downloadFormat);
      saveBlob(blob, downloadFormat === 'jpeg' ? 'jpg' : downloadFormat);
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      status = 'error';
    } finally {
      exporting = false;
    }
  }

  // Export the same raster at @1x/@2x/@3x, bundled as a zip.
  async function downloadSizeSet() {
    if (!svg || !file || exporting) return;
    const finalSvg = buildFinalSvg();
    if (!finalSvg) return;
    const fmt: RasterFmt = downloadFormat === 'svg' ? 'png' : downloadFormat;
    const ext = fmt === 'jpeg' ? 'jpg' : fmt;
    const base = rasterSize > 0 ? rasterSize : 512;
    const name = stripExtension(file.name) || 'icon';
    exporting = true;
    try {
      const files: Record<string, Uint8Array> = {};
      for (const { size, suffix } of buildSizeSet(base, DEFAULT_SCALES)) {
        const blob = await rasterize(finalSvg, fmt, size);
        files[`${name}${suffix}.${ext}`] = new Uint8Array(await blob.arrayBuffer());
      }
      const zipped = zipSync(files, { level: 6 });
      saveBlob(new Blob([zipped], { type: 'application/zip' }), 'zip', `${name}-${ext}-sizes`);
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      status = 'error';
    } finally {
      exporting = false;
    }
  }

  // ── Icon pack ────────────────────────────────────────────────────────────
  // Render the composed result to a square PNG of `size`px, with the mark
  // fit inside a (1 - 2*inset) safe area so platform masks (rounded/circle
  // crops, maskable PWA icons) never clip it. Returns the PNG file bytes.
  let packing = $state(false);

  async function rasterizeSquarePng(
    finalSvg: string,
    size: number,
    inset: number,
  ): Promise<Uint8Array> {
    const vb = readViewBox(finalSvg);
    const ar = vb && vb.h > 0 ? vb.w / vb.h : 1;
    // Content box after the safe-area inset, then fit the mark's aspect inside.
    const box = Math.max(1, Math.round(size * (1 - 2 * inset)));
    const drawW = ar >= 1 ? box : Math.max(1, Math.round(box * ar));
    const drawH = ar >= 1 ? Math.max(1, Math.round(box / ar)) : box;

    const sized = finalSvg.replace(
      /<svg([^>]*)>/i,
      (_m, attrs: string) =>
        `<svg${attrs.replace(/\s(?:width|height)\s*=\s*"[^"]*"/gi, '')} width="${drawW}" height="${drawH}">`,
    );
    const url = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const img = new Image();
      img.decoding = 'async';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Could not render SVG'));
        img.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not available');
      ctx.drawImage(img, (size - drawW) / 2, (size - drawH) / 2, drawW, drawH);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Icon render failed'))), 'image/png'),
      );
      return new Uint8Array(await blob.arrayBuffer());
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function downloadIconPack() {
    if (!svg || !file || packing) return;
    const finalSvg = buildFinalSvg();
    if (!finalSvg) return;
    packing = true;
    try {
      const name = stripExtension(file.name) || 'icon';
      const files: Record<string, Uint8Array> = {};

      // PNG set (favicons, apple-touch, PWA icons, maskable).
      for (const spec of ICON_SPECS) {
        files[spec.file] = await rasterizeSquarePng(finalSvg, spec.size, spec.inset);
      }

      // Multi-resolution favicon.ico from freshly rendered PNGs.
      const icoImages = [];
      for (const size of ICO_SIZES) {
        icoImages.push({ size, png: await rasterizeSquarePng(finalSvg, size, 0) });
      }
      files['favicon.ico'] = buildIco(icoImages);

      // Text artifacts.
      const enc = new TextEncoder();
      files['site.webmanifest'] = enc.encode(
        generateWebManifest({ name, themeColor: backdropVisible(backdrop) ? `#${backdrop.color.replace('#', '')}` : undefined }),
      );
      files['README.txt'] = enc.encode(
        `${name} icon pack — generated by markmint (https://oss.cver.net/markmint/)\n\n` +
          `Drop these files in your site root and paste this into <head>:\n\n` +
          generateHtmlSnippet() +
          `\n`,
      );

      const zipped = zipSync(files, { level: 6 });
      saveBlob(new Blob([zipped], { type: 'application/zip' }), 'zip', `${name}-icons`);
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      status = 'error';
    } finally {
      packing = false;
    }
  }

  // ── Copy as … ─────────────────────────────────────────────────────────────
  type CopyKind = 'svg' | 'react' | 'vue' | 'datauri' | 'ascii';
  let copiedKind = $state<CopyKind | null>(null);
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  let asciiCols = $state(100);

  // Rasterize the composed mark and read its pixels back (for ASCII).
  async function renderImageData(finalSvg: string, longest: number): Promise<ImageData | null> {
    const vb = readViewBox(finalSvg);
    const ar = vb && vb.h > 0 ? vb.w / vb.h : 1;
    const w = ar >= 1 ? longest : Math.max(1, Math.round(longest * ar));
    const h = ar >= 1 ? Math.max(1, Math.round(longest / ar)) : longest;
    const sized = finalSvg.replace(
      /<svg([^>]*)>/i,
      (_m, a: string) =>
        `<svg${a.replace(/\s(?:width|height)\s*=\s*"[^"]*"/gi, '')} width="${w}" height="${h}">`,
    );
    const url = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const im = new Image();
      im.decoding = 'async';
      await new Promise<void>((res, rej) => {
        im.onload = () => res();
        im.onerror = () => rej(new Error('Could not render SVG'));
        im.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(im, 0, 0, w, h);
      return ctx.getImageData(0, 0, w, h);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /** Build the ASCII rendering of the current mark, or null. */
  async function buildAsciiText(): Promise<string | null> {
    const finalSvg = buildFinalSvg();
    if (!finalSvg) return null;
    const id = await renderImageData(finalSvg, Math.max(240, asciiCols * 3));
    if (!id) return null;
    // charAspect ≈ monospace cell width/height at line-height 1 (~0.6 for the
    // SF Mono / Menlo family) so the art keeps the mark's proportions.
    return imageToAscii(id.data, id.width, id.height, {
      cols: asciiCols,
      charAspect: cellAspect, // measured, not guessed
      ramp: asciiRamp,
      invert: asciiInvert,
    });
  }

  async function copyAs(kind: CopyKind) {
    const finalSvg = buildFinalSvg();
    if (!finalSvg) return;
    try {
      let text = finalSvg;
      if (kind === 'react') text = toReactComponent(finalSvg, toComponentName(file?.name ?? 'Icon'));
      else if (kind === 'vue') text = toVueComponent(finalSvg);
      else if (kind === 'datauri') text = toDataUri(finalSvg);
      else if (kind === 'ascii') text = (await buildAsciiText()) ?? '';
      await navigator.clipboard.writeText(text);
      copiedKind = kind;
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => (copiedKind = null), 1500);
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      status = 'error';
    }
  }

  async function downloadAscii() {
    const text = await buildAsciiText();
    if (text == null || !file) return;
    saveBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), 'txt', `${stripExtension(file.name)}-ascii`);
  }

  // ── Preview view mode: the traced SVG (compare slider) or live ASCII ────────
  let asciiArt = $state('');
  let asciiBusy = $state(false);
  let asciiSeq = 0;
  let asciiRamp = $state<'standard' | 'blocks' | 'detailed'>('standard');
  let asciiInvert = $state(false);
  // Measured monospace cell ratio (charWidth / lineHeight) of the preview font,
  // so the art keeps the mark's proportions on any font / zoom (no guessing).
  let cellAspect = $state(0.6);

  function measureCellAspect() {
    if (typeof document === 'undefined') return;
    const el = document.createElement('pre');
    el.style.cssText =
      'position:absolute;visibility:hidden;left:-9999px;top:0;margin:0;padding:0;' +
      'font-family:var(--font-mono);font-size:10px;line-height:1;white-space:pre;';
    el.textContent = Array.from({ length: 10 }, () => '0000000000').join('\n'); // 10×10
    document.body.appendChild(el);
    const r = el.getBoundingClientRect();
    el.remove();
    const w = r.width / 10;
    const h = r.height / 10;
    if (w > 0 && h > 0) cellAspect = w / h;
  }

  // Recompute the ASCII (debounced) whenever the mark / width / ramp / invert
  // change — but only while the ASCII view is active, to avoid idle work.
  $effect(() => {
    // tracked dependencies (read synchronously)
    const live = displaySvg;
    const cols = asciiCols;
    const ramp = asciiRamp;
    const invert = asciiInvert;
    const aspect = cellAspect;
    const bd = `${backdrop.color}${backdrop.alpha}${backdrop.aspect}${backdrop.padding}${backdrop.radius}`;
    const enabled = $previewView === 'ascii';
    void cols;
    void ramp;
    void invert;
    void aspect;
    void bd;
    void live;
    if (!enabled || !svg) {
      asciiArt = '';
      return;
    }
    const seq = ++asciiSeq;
    asciiBusy = true;
    const timer = setTimeout(async () => {
      const text = await buildAsciiText();
      if (seq === asciiSeq) {
        asciiArt = text ?? '';
        asciiBusy = false;
      }
    }, 250);
    return () => clearTimeout(timer);
  });

  async function copyAsciiArt() {
    if (!asciiArt) return;
    try {
      await navigator.clipboard.writeText(asciiArt);
      copiedKind = 'ascii';
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => (copiedKind = null), 1500);
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      status = 'error';
    }
  }

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (debounceTimer) clearTimeout(debounceTimer);
    clearExtraLayers();
    baseTransform = { ...IDENTITY_TRANSFORM };
    baseHidden = false;
    selectedLayerId = 'base';
    file = null;
    previewUrl = null;
    pixelsCache = null;
    baseSvg = null;
    durationMs = 0;
    errorMessage = null;
    status = 'idle';
    pathStates = new Map();
    expandedGroups = new Set();
    hoveredPathIdx = null;
  }
</script>

<svelte:window onkeydown={onKeydown} />

<section class="studio">
  {#if !file}
    <label
      class="dropzone"
      class:drag-over={dragOver}
      ondragover={(e) => {
        e.preventDefault();
        dragOver = true;
      }}
      ondragleave={() => (dragOver = false)}
      ondrop={onDrop}
    >
      <input type="file" accept="image/png,image/jpeg,image/webp,image/bmp" onchange={onFileInput} hidden />
      <Upload size={40} strokeWidth={1.5} />
      <p class="dropzone-title">Drop an image here, or click to choose</p>
      <p class="dropzone-hint">PNG · JPG · WebP · BMP — converted locally in your browser, nothing is uploaded.</p>
    </label>
  {:else}
    <div class="workspace" class:ascii-mode={$previewView === 'ascii'}>
      <!-- LEFT: controls (hidden in ASCII mode — tune the mark in SVG view) -->
      <aside class="controls">
        <div class="card">
          <div class="card-row">
            <span class="card-label">Preset</span>
            <fieldset class="seg">
              <div class="seg-buttons">
                {#each PRESETS as p}
                  <button
                    type="button"
                    class:on={preset === p.id}
                    title={p.description}
                    onclick={() => selectPreset(p.id)}
                  >{p.label}</button>
                {/each}
              </div>
            </fieldset>
          </div>
          {#if customPresets.length > 0}
            <div class="custom-presets">
              {#each customPresets as cp}
                <fieldset class="seg">
                  <div class="seg-buttons">
                    <button type="button" onclick={() => loadCustomPreset(cp)} title={cp.name}>{cp.name}</button>
                    <button type="button" class="seg-x" onclick={() => deleteCustomPreset(cp.name)} aria-label="Delete {cp.name}">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </fieldset>
              {/each}
            </div>
          {/if}

          <div class="slider tight">
            <div class="slider-head">
              <label for="detail">Detail level</label>
              <span class="value">{detailLevel} / 10</span>
            </div>
            <input
              id="detail"
              type="range"
              min="1"
              max="10"
              step="1"
              value={detailLevel}
              oninput={(e) => setDetail(Number((e.target as HTMLInputElement).value))}
            />
            <div class="slider-hint"><span>Coarse</span><span>Fine</span></div>
          </div>

          <div class="slider tight">
            <div class="slider-head">
              <label for="speckle-filter">Speckle Filter (Noise Clean)</label>
              <span class="value">
                {#if speckleThreshold === 0}
                  Off
                {:else}
                  {speckleThreshold} px²
                  {#if autoHiddenIdxs.size > 0}
                    <span class="speckle-count" class:active={specklePreviewing}>
                      − {autoHiddenIdxs.size}
                    </span>
                  {/if}
                {/if}
              </span>
            </div>
            <input
              id="speckle-filter"
              type="range"
              min="0"
              max="400"
              step="2"
              bind:value={speckleThreshold}
              oninput={specklePreviewOn}
              onpointerdown={specklePreviewOn}
              onpointerup={specklePreviewOffSoon}
              onpointercancel={specklePreviewOffSoon}
              onfocus={specklePreviewOn}
              onblur={specklePreviewOffSoon}
              onmouseenter={specklePreviewOn}
              onmouseleave={specklePreviewOffSoon}
            />
            <div class="slider-hint">
              <span>Keep all</span>
              <span>{specklePreviewing && autoHiddenIdxs.size > 0 ? 'Red = will be removed' : 'Aggressive clean'}</span>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-row">
            <span class="card-label">Aspect</span>
            <div class="seg-buttons">
              <button type="button" class:on={backdrop.aspect === 'original'} onclick={() => (backdrop.aspect = 'original')}>Original</button>
              <button type="button" class:on={backdrop.aspect === 'square'} onclick={() => (backdrop.aspect = 'square')}>Square</button>
            </div>
          </div>

          <div class="card-row">
            <span class="card-label">Backdrop</span>
            <div class="color-pick">
              <input type="color" bind:value={backdrop.color} aria-label="Backdrop color" />
              <input
                type="text"
                class="hex"
                maxlength="9"
                bind:value={backdrop.color}
              />
            </div>
          </div>

          <div class="slider-grid three">
            <div class="slider tight">
              <div class="slider-head">
                <label for="bd-alpha">Alpha</label>
                <span class="value">{backdrop.alpha}%</span>
              </div>
              <input id="bd-alpha" type="range" min="0" max="100" step="1" bind:value={backdrop.alpha} />
            </div>
            <div class="slider tight">
              <div class="slider-head">
                <label for="bd-radius">Radius</label>
                <span class="value">{backdrop.radius}%</span>
              </div>
              <input id="bd-radius" type="range" min="0" max="50" step="1" bind:value={backdrop.radius} />
            </div>
            <div class="slider tight">
              <div class="slider-head">
                <label for="bd-padding">Padding</label>
                <span class="value">{backdrop.padding}%</span>
              </div>
              <input id="bd-padding" type="range" min="0" max="30" step="1" bind:value={backdrop.padding} />
            </div>
          </div>

          <div class="card-row" style="width: 100%;">
            <span class="card-label">Effects</span>
          </div>
          <div class="fx-stack">
            <div class="fx-group">
              <label class="fx-toggle">
                <input type="checkbox" bind:checked={fx.outline.on} />
                <span>Outline</span>
              </label>
              {#if fx.outline.on}
                <div class="color-pick">
                  <input type="color" bind:value={fx.outline.color} aria-label="Outline color" />
                </div>
                <div class="slider tight">
                  <div class="slider-head"><label for="fx-ow">Width</label><span class="value">{fx.outline.width}%</span></div>
                  <input id="fx-ow" type="range" min="0.5" max="8" step="0.5" bind:value={fx.outline.width} />
                </div>
              {/if}
            </div>

            <div class="fx-group">
              <label class="fx-toggle">
                <input type="checkbox" bind:checked={fx.shadow.on} />
                <span>Shadow</span>
              </label>
              {#if fx.shadow.on}
                <div class="color-pick">
                  <input type="color" bind:value={fx.shadow.color} aria-label="Shadow color" />
                </div>
                <div class="slider-grid three">
                  <div class="slider tight">
                    <div class="slider-head"><label for="fx-sb">Blur</label><span class="value">{fx.shadow.blur}%</span></div>
                    <input id="fx-sb" type="range" min="0" max="12" step="0.5" bind:value={fx.shadow.blur} />
                  </div>
                  <div class="slider tight">
                    <div class="slider-head"><label for="fx-sx">X</label><span class="value">{fx.shadow.dx}%</span></div>
                    <input id="fx-sx" type="range" min="-10" max="10" step="0.5" bind:value={fx.shadow.dx} />
                  </div>
                  <div class="slider tight">
                    <div class="slider-head"><label for="fx-sy">Y</label><span class="value">{fx.shadow.dy}%</span></div>
                    <input id="fx-sy" type="range" min="-10" max="10" step="0.5" bind:value={fx.shadow.dy} />
                  </div>
                </div>
                <div class="slider tight">
                  <div class="slider-head"><label for="fx-so">Opacity</label><span class="value">{Math.round(fx.shadow.opacity * 100)}%</span></div>
                  <input id="fx-so" type="range" min="0" max="1" step="0.05" bind:value={fx.shadow.opacity} />
                </div>
              {/if}
            </div>

            <div class="fx-group">
              <label class="fx-toggle">
                <input type="checkbox" bind:checked={fx.glow.on} />
                <span>Glow</span>
              </label>
              {#if fx.glow.on}
                <div class="color-pick">
                  <input type="color" bind:value={fx.glow.color} aria-label="Glow color" />
                </div>
                <div class="slider-grid">
                  <div class="slider tight">
                    <div class="slider-head"><label for="fx-gb">Blur</label><span class="value">{fx.glow.blur}%</span></div>
                    <input id="fx-gb" type="range" min="0" max="14" step="0.5" bind:value={fx.glow.blur} />
                  </div>
                  <div class="slider tight">
                    <div class="slider-head"><label for="fx-go">Opacity</label><span class="value">{Math.round(fx.glow.opacity * 100)}%</span></div>
                    <input id="fx-go" type="range" min="0" max="1" step="0.05" bind:value={fx.glow.opacity} />
                  </div>
                </div>
              {/if}
            </div>
          </div>

          {#if pathList.length > 0}
            <div class="layers">
              <div class="card-row" style="justify-content: space-between; width: 100%;">
                <span class="card-label">Layers</span>
                <div class="layer-header-actions" style="display: flex; gap: 0.375rem;">
                  <button class="tiny-btn primary-tiny" type="button" onclick={runSmartClean} title="Clean small noise paths and group near colors">
                    <span>🧹 Smart Clean</span>
                  </button>
                  {#if pathStates.size > 0 || speckleThreshold > 0}
                    <button class="tiny-btn" type="button" onclick={resetAllPaths}>
                      <RotateCcw size={11} />
                      <span>Reset all</span>
                    </button>
                  {/if}
                </div>
              </div>
              {#each groupedPaths as group (group.color)}
                {@const expanded = expandedGroups.has(group.color)}
                {@const allRemoved = group.paths.every((p) => pathStates.get(p.origIdx)?.removed)}
                {@const groupFill = group.paths[0]
                  ? (pathStates.get(group.paths[0].origIdx)?.fill ?? group.color)
                  : group.color}
                {@const grad = colorGradients.get(group.color)}
                <div class="layer-group">
                  <div class="group-row">
                    <button
                      class="expand-btn"
                      type="button"
                      onclick={() => toggleGroup(group.color)}
                      aria-label={expanded ? 'Collapse' : 'Expand'}
                    >
                      <ChevronRight size={12} class={expanded ? 'rotated' : ''} />
                    </button>
                    <label
                      class="layer-swatch"
                      class:hidden={allRemoved}
                      style:background={allRemoved
                        ? undefined
                        : grad
                          ? `linear-gradient(${grad.angle + 90}deg, ${grad.stops[0].color}, ${grad.stops[grad.stops.length - 1].color})`
                          : groupFill}
                    >
                      <input
                        type="color"
                        value={groupFill}
                        oninput={(e) => bulkColor(group.color, (e.target as HTMLInputElement).value)}
                        disabled={allRemoved || !!grad}
                        aria-label="Recolor all {group.paths.length} paths of {group.color}"
                      />
                    </label>
                    <span class="layer-meta">{group.paths.length} path{group.paths.length === 1 ? '' : 's'}</span>
                    <button
                      class="grad-toggle"
                      class:on={!!grad}
                      type="button"
                      disabled={allRemoved}
                      onclick={() => toggleGroupGradient(group.color, groupFill)}
                      aria-label={grad ? 'Remove gradient' : 'Add gradient fill'}
                      title={grad ? 'Remove gradient' : 'Gradient fill'}
                    >
                      <span class="grad-chip"></span>
                    </button>
                    <button
                      class="layer-hide"
                      class:on={allRemoved}
                      type="button"
                      onclick={() => bulkRemove(group.color, !allRemoved)}
                      aria-label={allRemoved ? 'Show group' : 'Hide group'}
                    >
                      <EyeOff size={11} />
                    </button>
                  </div>
                  {#if grad}
                    <div class="grad-editor">
                      <label class="grad-stop" style:background={grad.stops[0].color}>
                        <input
                          type="color"
                          value={grad.stops[0].color}
                          oninput={(e) => setGradientStop(group.color, 0, (e.target as HTMLInputElement).value)}
                          aria-label="Gradient start color"
                        />
                      </label>
                      <div class="grad-type" role="group" aria-label="Gradient type">
                        <button
                          type="button"
                          class:on={(grad.type ?? 'linear') === 'linear'}
                          onclick={() => setGradientType(group.color, 'linear')}
                          title="Linear gradient"
                          aria-label="Linear gradient"
                        >Lin</button>
                        <button
                          type="button"
                          class:on={grad.type === 'radial'}
                          onclick={() => setGradientType(group.color, 'radial')}
                          title="Radial gradient"
                          aria-label="Radial gradient"
                        >Rad</button>
                      </div>
                      <input
                        class="grad-angle-range"
                        type="range"
                        min="0"
                        max="360"
                        step="15"
                        value={grad.angle}
                        disabled={grad.type === 'radial'}
                        oninput={(e) => setGradientAngle(group.color, +(e.target as HTMLInputElement).value)}
                        aria-label="Gradient angle"
                      />
                      <label class="grad-stop" style:background={grad.stops[grad.stops.length - 1].color}>
                        <input
                          type="color"
                          value={grad.stops[grad.stops.length - 1].color}
                          oninput={(e) => setGradientStop(group.color, grad.stops.length - 1, (e.target as HTMLInputElement).value)}
                          aria-label="Gradient end color"
                        />
                      </label>
                      <div class="grad-presets">
                        {#each GRADIENT_PRESETS as gp (gp.name)}
                          <button
                            type="button"
                            class="grad-preset"
                            style:background={`linear-gradient(${gp.angle + 90}deg, ${gp.a}, ${gp.b})`}
                            onclick={() => applyGradientPreset(group.color, gp.a, gp.b, gp.angle)}
                            title={gp.name}
                            aria-label="Apply {gp.name} gradient"
                          ></button>
                        {/each}
                        {#each savedGradients as sg (sg.name)}
                          <button
                            type="button"
                            class="grad-preset saved"
                            style:background={`${sg.spec.type === 'radial' ? 'radial-gradient(circle' : `linear-gradient(${sg.spec.angle + 90}deg`}, ${sg.spec.stops.map((s) => `${s.color} ${s.offset}%`).join(', ')})`}
                            onclick={() => applySavedGradient(group.color, sg)}
                            oncontextmenu={(e) => { e.preventDefault(); deleteSavedGradient(sg.name); }}
                            title={`${sg.name} (right-click to delete)`}
                            aria-label="Apply {sg.name}"
                          ></button>
                        {/each}
                        <button
                          type="button"
                          class="grad-save"
                          onclick={() => saveCurrentGradient(group.color)}
                          title="Save this gradient"
                          aria-label="Save this gradient"
                        >+</button>
                      </div>
                    </div>
                  {/if}
                  {#if expanded}
                    <ul class="layer-children">
                      {#each group.paths as p (p.origIdx)}
                        {@const st = pathStates.get(p.origIdx)}
                        {@const removed = st?.removed ?? false}
                        {@const fill = st?.fill ?? p.originalFill}
                        <li
                          class:hovered={hoveredPathIdx === p.origIdx}
                          class:removed
                          onmouseenter={() => (hoveredPathIdx = p.origIdx)}
                          onmouseleave={() => (hoveredPathIdx = null)}
                        >
                          <label class="layer-swatch small" class:hidden={removed} style:background={removed ? undefined : fill}>
                            <input
                              type="color"
                              value={fill}
                              oninput={(e) => setPathColor(p.origIdx, (e.target as HTMLInputElement).value)}
                              disabled={removed}
                              aria-label="Recolor path {p.origIdx}"
                            />
                          </label>
                          <span class="layer-meta path-meta">Path {p.origIdx}</span>
                          <button
                            class="layer-hide small"
                            class:on={removed}
                            type="button"
                            onclick={() => togglePathRemoved(p.origIdx)}
                            aria-label={removed ? 'Show path' : 'Hide path'}
                          >
                            <EyeOff size={11} />
                          </button>
                        </li>
                      {/each}
                    </ul>
                  {/if}
                </div>
              {/each}
              <p class="hint">Click on canvas to remove a path. Use ▶ to recolor individual paths.</p>
            </div>
          {/if}
        </div>

        <details class="advanced" bind:open={advancedOpen}>
          <summary>
            <ChevronDown size={16} class="chev" />
            <span>Advanced settings</span>
            {#if modified}
              <span class="badge">modified</span>
            {/if}
          </summary>
          <div class="sliders">
            <div class="modes">
              <fieldset class="seg">
                <legend>Color mode</legend>
                <div class="seg-buttons">
                  <button type="button" class:on={params.colorMode === 0} onclick={() => (params.colorMode = 0)}>Color</button>
                  <button type="button" class:on={params.colorMode === 1} onclick={() => (params.colorMode = 1)}>Binary</button>
                </div>
              </fieldset>

              <fieldset class="seg">
                <legend>Curves</legend>
                <div class="seg-buttons">
                  <button type="button" class:on={params.pathSimplifyMode === 0} onclick={() => (params.pathSimplifyMode = 0)}>Polygon</button>
                  <button type="button" class:on={params.pathSimplifyMode === 1} onclick={() => (params.pathSimplifyMode = 1)}>Spline</button>
                  <button type="button" class:on={params.pathSimplifyMode === 2} onclick={() => (params.pathSimplifyMode = 2)}>None</button>
                </div>
              </fieldset>
            </div>

            <div class="slider tight">
              <div class="slider-head">
                <label for="filter-speckle">Filter speckle</label>
                <span class="value">{params.filterSpeckle}</span>
              </div>
              <input id="filter-speckle" type="range" min="0" max="16" step="1" bind:value={params.filterSpeckle} />
            </div>

            <div class="slider tight">
              <div class="slider-head">
                <label for="color-precision">Color precision</label>
                <span class="value">{params.colorPrecision}</span>
              </div>
              <input id="color-precision" type="range" min="1" max="8" step="1" bind:value={params.colorPrecision} disabled={params.colorMode === 1} />
            </div>

            <div class="slider tight">
              <div class="slider-head">
                <label for="corner-threshold">Corners</label>
                <span class="value">{params.cornerThreshold}°</span>
              </div>
              <input id="corner-threshold" type="range" min="0" max="180" step="1" bind:value={params.cornerThreshold} />
            </div>

            <div class="slider tight">
              <div class="slider-head">
                <label for="splice-threshold">Smoothness</label>
                <span class="value">{params.spliceThreshold}°</span>
              </div>
              <input id="splice-threshold" type="range" min="0" max="180" step="1" bind:value={params.spliceThreshold} />
            </div>

            <div class="slider tight">
              <div class="slider-head">
                <label for="layer-difference">Layer split</label>
                <span class="value">{params.layerDifference}</span>
              </div>
              <input id="layer-difference" type="range" min="0" max="64" step="1" bind:value={params.layerDifference} disabled={params.colorMode === 1} />
            </div>

            <div class="slider tight">
              <div class="slider-head">
                <label for="path-precision">Output decimals</label>
                <span class="value">{params.pathPrecision}</span>
              </div>
              <input id="path-precision" type="range" min="0" max="8" step="1" bind:value={params.pathPrecision} />
            </div>

            <div class="advanced-actions">
              {#if modified}
                <button class="ghost tiny-btn" type="button" onclick={resetToPreset}>
                  <RotateCcw size={12} />
                  <span>Reset to "{presetLabel}"</span>
                </button>
              {/if}
              <div class="save-preset">
                <input
                  type="text"
                  placeholder="Save as preset…"
                  maxlength="32"
                  bind:value={newPresetName}
                  onkeydown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      saveCurrentAsPreset();
                    }
                  }}
                />
                <button class="ghost tiny-btn" type="button" onclick={saveCurrentAsPreset} disabled={!newPresetName.trim()}>
                  <Save size={12} />
                  <span>Save</span>
                </button>
              </div>
            </div>
          </div>
        </details>

        <div class="toggles-row">
          <label class="toggle small">
            <input type="checkbox" bind:checked={livePreview} />
            <span>Live preview</span>
          </label>
          <label class="toggle small">
            <input type="checkbox" bind:checked={optimize} />
            <span>SVGO</span>
          </label>
          {#if !livePreview}
            <button class="primary" type="button" onclick={runConvert} disabled={status === 'converting' || !pixelsCache}>
              {#if status === 'converting'}
                <Loader2 size={14} class="spin" />
                <span>Tracing…</span>
              {:else}
                <ImageIcon size={14} />
                <span>Convert</span>
              {/if}
            </button>
          {/if}
        </div>
      </aside>

      <!-- RIGHT: preview -->
      <div class="preview-pane">
        {#if errorMessage}
          <div class="error" role="alert">
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        {/if}

        {#if displaySvg}
          <div class="result">
            <!-- Source row: filename + replace — persistent across SVG/ASCII. -->
            <div class="file-row">
              <div class="file-meta">
                <div class="file-name">{file.name}</div>
                <div class="file-size">{formatBytes(file.size)}</div>
              </div>
              <button class="ghost icon-btn" type="button" onclick={reset} aria-label="Choose different file">
                <RefreshCw size={16} />
              </button>
            </div>

            <div class="result-header">
              <div class="size-compare">
                <span>{formatBytes(file.size)}</span>
                <span class="arrow">→</span>
                <span class="output-size">{formatBytes(outputBytes)}</span>
                {#if durationMs > 0}
                  <span class="dot">·</span>
                  <span class="duration">{durationMs.toFixed(0)}ms</span>
                {/if}
                {#if status === 'converting'}
                  <span class="dot">·</span>
                  <Loader2 size={14} class="spin muted" />
                {/if}
              </div>
              {#if $previewView === 'svg'}
              <div class="result-actions">
                <label class="export-select" title="Output format">
                  <select bind:value={downloadFormat} aria-label="Output format">
                    <option value="svg">SVG</option>
                    <option value="png">PNG</option>
                    <option value="webp">WebP</option>
                    <option value="jpeg">JPG</option>
                  </select>
                </label>
                {#if downloadFormat !== 'svg'}
                  <label class="export-select" title="Pixel size (longest edge)">
                    <select bind:value={rasterSize} aria-label="Pixel size">
                      <option value={0}>Source</option>
                      <option value={1024}>1024px</option>
                      <option value={512}>512px</option>
                      <option value={256}>256px</option>
                      <option value={128}>128px</option>
                    </select>
                  </label>
                {/if}
                <button class="primary" type="button" onclick={download} disabled={exporting}>
                  {#if exporting}
                    <Loader2 size={16} class="spin" />
                  {:else}
                    <Download size={16} />
                  {/if}
                  <span>Download</span>
                </button>
                <button
                  class="ghost"
                  type="button"
                  onclick={downloadIconPack}
                  disabled={packing}
                  title="Download a favicon + app-icon pack (.ico, PNGs, manifest, HTML snippet) as a zip"
                >
                  {#if packing}
                    <Loader2 size={16} class="spin" />
                  {:else}
                    <Package size={16} />
                  {/if}
                  <span>Icon pack</span>
                </button>
                <button
                  class="ghost"
                  type="button"
                  onclick={downloadSizeSet}
                  disabled={exporting}
                  title="Export the raster at @1x / @2x / @3x as a zip"
                >
                  <Images size={16} />
                  <span>@1–3×</span>
                </button>
                <details class="copy-menu">
                  <summary class="ghost" title="Copy the result to the clipboard">
                    {#if copiedKind}
                      <Check size={16} />
                    {:else}
                      <Copy size={16} />
                    {/if}
                    <span>Copy</span>
                  </summary>
                  <div class="copy-options" role="menu">
                    <button type="button" role="menuitem" onclick={() => copyAs('svg')}>
                      SVG{copiedKind === 'svg' ? ' ✓' : ''}
                    </button>
                    <button type="button" role="menuitem" onclick={() => copyAs('react')}>
                      React component{copiedKind === 'react' ? ' ✓' : ''}
                    </button>
                    <button type="button" role="menuitem" onclick={() => copyAs('vue')}>
                      Vue component{copiedKind === 'vue' ? ' ✓' : ''}
                    </button>
                    <button type="button" role="menuitem" onclick={() => copyAs('datauri')}>
                      Data URI{copiedKind === 'datauri' ? ' ✓' : ''}
                    </button>
                  </div>
                </details>
              </div>
              {/if}
            </div>

            <!-- Image layers: compose several traced images into one mark.
                 Persistent across SVG/ASCII — it defines what the mark IS. -->
            <div class="image-layers">
              <div class="layers-row">
                <button
                  type="button"
                  class="layer-chip"
                  class:active={selectedLayerId === 'base'}
                  class:dim={baseHidden}
                  onclick={() => (selectedLayerId = 'base')}
                  title="Base image"
                >
                  {#if previewUrl}<img src={previewUrl} alt="" />{/if}
                  <span class="chip-name">Base</span>
                </button>
                {#each extraLayers as l, i (l.id)}
                  <button
                    type="button"
                    class="layer-chip"
                    class:active={selectedLayerId === l.id}
                    class:dim={l.hidden || !l.rawSvg}
                    onclick={() => (selectedLayerId = l.id)}
                    title={l.name}
                  >
                    <img src={l.previewUrl} alt="" />
                    <span class="chip-name">{l.rawSvg ? `#${i + 2}` : '…'}</span>
                  </button>
                {/each}
                <label class="add-layer" title="Add another image as a layer">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/bmp"
                    onchange={onAddLayerInput}
                    hidden
                  />
                  <Plus size={16} />
                  <span>Add image</span>
                </label>
              </div>

              {#if hasLayers}
                <div class="layer-controls">
                  <div class="layer-actions">
                    <button type="button" class="tiny-btn" onclick={() => toggleLayerHidden(selectedLayerId)}>
                      {#if selectedHidden}<Eye size={12} /><span>Show</span>{:else}<EyeOff size={12} /><span>Hide</span>{/if}
                    </button>
                    {#if selectedLayerId !== 'base'}
                      <button type="button" class="tiny-btn" onclick={() => moveLayer(selectedLayerId, -1)} title="Send backward">↓</button>
                      <button type="button" class="tiny-btn" onclick={() => moveLayer(selectedLayerId, 1)} title="Bring forward">↑</button>
                      <button type="button" class="tiny-btn" onclick={() => removeLayer(selectedLayerId)}>
                        <Trash2 size={12} /><span>Remove</span>
                      </button>
                    {/if}
                  </div>
                  <div class="layer-sliders">
                    <label class="layer-slider">
                      <span>Scale</span>
                      <input type="range" min="0.1" max="2" step="0.05" value={selectedTransform.scale}
                        oninput={(e) => updateSelectedTransform({ scale: +(e.currentTarget as HTMLInputElement).value })} />
                    </label>
                    <label class="layer-slider">
                      <span>X</span>
                      <input type="range" min="-0.5" max="0.5" step="0.01" value={selectedTransform.dx}
                        oninput={(e) => updateSelectedTransform({ dx: +(e.currentTarget as HTMLInputElement).value })} />
                    </label>
                    <label class="layer-slider">
                      <span>Y</span>
                      <input type="range" min="-0.5" max="0.5" step="0.01" value={selectedTransform.dy}
                        oninput={(e) => updateSelectedTransform({ dy: +(e.currentTarget as HTMLInputElement).value })} />
                    </label>
                  </div>
                </div>
              {/if}
            </div>

            {#if $previewView === 'svg'}
            <div class="editor-toolbar">
              <div class="tool-group">
                <button
                  type="button"
                  class="tool-btn"
                  class:active={activeTool === 'select'}
                  onclick={() => { activeTool = 'select'; selectedPathIdx = null; popoverPosition = null; }}
                  title="Select mode: click shape to inspect/recolor/isolate"
                >
                  <MousePointer size={14} />
                  <span>Select Shape</span>
                </button>
                <button
                  type="button"
                  class="tool-btn"
                  class:active={activeTool === 'eraser'}
                  onclick={() => { activeTool = 'eraser'; selectedPathIdx = null; popoverPosition = null; }}
                  title="Eraser mode: click or drag-select to delete paths"
                >
                  <Eraser size={14} />
                  <span>Eraser Tool</span>
                </button>
                <div class="tool-divider" aria-hidden="true"></div>
                <button
                  type="button"
                  class="tool-btn icon-only"
                  onclick={undoEdit}
                  disabled={!canUndo}
                  title="Undo (⌘/Ctrl+Z)"
                  aria-label="Undo"
                >
                  <Undo2 size={14} />
                </button>
                <button
                  type="button"
                  class="tool-btn icon-only"
                  onclick={redoEdit}
                  disabled={!canRedo}
                  title="Redo (⌘/Ctrl+Shift+Z)"
                  aria-label="Redo"
                >
                  <Redo2 size={14} />
                </button>
                {#if detectedBackground && !backgroundRemoved}
                  <div class="tool-divider" aria-hidden="true"></div>
                  <button
                    type="button"
                    class="tool-btn"
                    onclick={removeBackground}
                    title={`Remove the detected background (${detectedBackground})`}
                  >
                    <Wand2 size={14} />
                    <span>Remove BG</span>
                  </button>
                {/if}
              </div>

              <div class="hide-actions">
                {#if removedIdxs.length > 0}
                  <span class="hide-count">{removedIdxs.length} hidden</span>
                  <button type="button" class="tiny-btn" onclick={resetAllPaths}>
                    <RotateCcw size={11} />
                    <span>Restore all</span>
                  </button>
                {:else}
                  <span class="hide-hint">
                    {activeTool === 'select' ? 'Click shape to inspect' : 'Click/drag box to delete'}
                  </span>
                {/if}
              </div>
            </div>

              {#if previewUrl}
                <CompareSlider
                  originalUrl={previewUrl}
                  svg={displaySvg}
                  {backdrop}
                  {activeTool}
                  onPathClick={handlePathClick}
                  onPathHover={setHoveredOrigIdx}
                  onMarqueeSelect={handleMarqueeSelect}
                />
              {/if}
            {:else}
              <div class="ascii-view">
                <div class="ascii-bar">
                  <label class="ascii-width">
                    <span>Width</span>
                    <input type="range" min="20" max="200" step="2" bind:value={asciiCols} />
                    <span class="value">{asciiCols} cols</span>
                  </label>
                  <label class="ascii-opt">
                    <span>Charset</span>
                    <select bind:value={asciiRamp} aria-label="ASCII character set">
                      <option value="standard">Standard</option>
                      <option value="blocks">Blocks</option>
                      <option value="detailed">Detailed</option>
                    </select>
                  </label>
                  <label class="ascii-opt">
                    <input type="checkbox" bind:checked={asciiInvert} />
                    <span>Invert</span>
                  </label>
                  <div class="ascii-actions">
                    <button type="button" class="tiny-btn" onclick={copyAsciiArt} disabled={!asciiArt}>
                      <Copy size={12} />
                      <span>{copiedKind === 'ascii' ? 'Copied ✓' : 'Copy'}</span>
                    </button>
                    <button type="button" class="tiny-btn" onclick={downloadAscii} disabled={!asciiArt}>
                      <Download size={12} />
                      <span>.txt</span>
                    </button>
                  </div>
                </div>
                {#if previewUrl}
                  <AsciiCompare originalUrl={previewUrl} ascii={asciiArt} busy={asciiBusy} />
                {:else}
                  <pre class="ascii-preview big" class:busy={asciiBusy} aria-label="ASCII preview">{asciiArt || '…'}</pre>
                {/if}
              </div>
            {/if}

            {#if selectedPathIdx !== null && popoverPosition}
              {@const pathInfo = pathList.find((p) => p.origIdx === selectedPathIdx)}
              {#if pathInfo}
                {@const state = pathStates.get(selectedPathIdx)}
                {@const currentFill = state?.fill ?? pathInfo.originalFill}
                {@const group = groupedPaths.find((g) => g.paths.some((p) => p.origIdx === selectedPathIdx))}
                {@const pathCount = group ? group.paths.length : 1}
                <div class="popover-backdrop" onclick={() => { selectedPathIdx = null; popoverPosition = null; }} role="presentation"></div>
                <div
                  class="popover glass"
                  style:left="{popoverPosition.x}px"
                  style:top="{popoverPosition.y - 10}px"
                >
                  <div class="popover-arrow"></div>
                  <div class="popover-header">
                    <span class="popover-title">Shape #{selectedPathIdx}</span>
                    <button type="button" class="popover-close" onclick={() => { selectedPathIdx = null; popoverPosition = null; }}>×</button>
                  </div>
                  <div class="popover-body">
                    <div class="popover-row">
                      <span class="popover-label">Color</span>
                      <div class="color-pick small">
                        <input
                          type="color"
                          value={currentFill}
                          oninput={(e) => setPathColor(selectedPathIdx, (e.target as HTMLInputElement).value)}
                          aria-label="Recolor shape #{selectedPathIdx}"
                        />
                        <span class="popover-color-hex">{currentFill}</span>
                        {#if state?.fill}
                          <button type="button" class="tiny-btn" onclick={() => clearPathColor(selectedPathIdx)}>Reset</button>
                        {/if}
                      </div>
                    </div>
                    <div class="popover-row actions">
                      <button
                        type="button"
                        class="tiny-btn popover-action-btn"
                        onclick={() => { togglePathRemoved(selectedPathIdx); selectedPathIdx = null; popoverPosition = null; }}
                      >
                        <EyeOff size={11} />
                        <span>Hide Shape</span>
                      </button>
                      <button
                        type="button"
                        class="tiny-btn popover-action-btn"
                        onclick={() => {
                          let nextStates = pathStates;
                          for (const p of pathList) {
                            if (p.origIdx !== selectedPathIdx) {
                              nextStates = setPathRemoved(nextStates, p.origIdx, true);
                            } else {
                              nextStates = setPathRemoved(nextStates, p.origIdx, false);
                            }
                          }
                          pathStates = nextStates;
                          selectedPathIdx = null;
                          popoverPosition = null;
                        }}
                        title="Hide all other shapes"
                      >
                        <span>Isolate</span>
                      </button>
                      <button
                        type="button"
                        class="tiny-btn popover-action-btn"
                        onclick={() => {
                          if (group) {
                            expandedGroups = new Set([group.color]);
                          }
                          selectedPathIdx = null;
                          popoverPosition = null;
                        }}
                        title="Expand layers to this color group"
                      >
                        <span>Show in Layers ({pathCount})</span>
                      </button>
                    </div>
                  </div>
                </div>
              {/if}
            {/if}
          </div>
        {:else}
          <div class="placeholder">
            {#if status === 'converting'}
              <Loader2 size={32} class="spin muted" />
              <p>Tracing…</p>
            {:else}
              <ImageIcon size={32} strokeWidth={1.5} class="muted" />
              <p>Adjust settings on the left to see the SVG output.</p>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</section>

<style>
  .studio {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  /* ─── Drop zone ─── */
  .dropzone {
    border: 1.5px dashed var(--border);
    border-radius: 12px;
    padding: 3rem 1.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    text-align: center;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    color: var(--text);
  }
  .dropzone:hover,
  .dropzone.drag-over {
    border-color: var(--accent);
    background: var(--accent-bg);
  }
  .dropzone-title {
    margin: 0;
    font-weight: 500;
  }
  .dropzone-hint {
    margin: 0;
    font-size: 0.875rem;
    color: var(--muted);
  }

  /* ─── Two-column workspace ─── */
  .workspace {
    display: grid;
    grid-template-columns: minmax(340px, 420px) minmax(0, 1fr);
    gap: 1.25rem;
    align-items: start;
  }
  /* ASCII is a focused top-level mode: drop the SVG control column, go full width. */
  .workspace.ascii-mode {
    grid-template-columns: 1fr;
  }
  .workspace.ascii-mode .controls {
    display: none;
  }
  @media (max-width: 880px) {
    .workspace {
      grid-template-columns: 1fr;
    }
  }
  .controls {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 0;
  }
  .preview-pane {
    position: sticky;
    top: 1rem;
    min-width: 0;
  }
  @media (max-width: 880px) {
    .preview-pane {
      position: static;
    }
  }

  /* ─── File row ─── */
  .file-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }
  .file-meta {
    flex: 1;
    min-width: 0;
  }
  .file-name {
    font-weight: 500;
    font-size: 0.875rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .file-size {
    font-size: 0.75rem;
    color: var(--muted);
  }
  .icon-btn {
    padding: 0.4rem !important;
  }

  /* ─── Card ─── */
  .card {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    padding: 0.875rem;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
  }
  .card-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .card-label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--muted);
    min-width: 56px;
  }

  /* ─── Custom presets row ─── */
  .custom-presets {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-top: -0.25rem;
  }
  .seg-x {
    padding-left: 0.4rem !important;
    padding-right: 0.4rem !important;
    color: var(--muted);
  }
  .seg-x:hover {
    color: #dc2626 !important;
  }

  /* ─── Segmented buttons ─── */
  .seg {
    border: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .seg.compact {
    gap: 0;
  }
  .seg legend {
    padding: 0;
    font-size: 0.75rem;
    color: var(--muted);
  }
  .seg-buttons {
    display: flex;
  }
  .seg-buttons button {
    padding: 0.35rem 0.7rem;
    font-family: inherit;
    font-size: 0.8125rem;
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text);
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s;
  }
  .seg-buttons button:first-child {
    border-radius: 6px 0 0 6px;
  }
  .seg-buttons button:last-child {
    border-radius: 0 6px 6px 0;
  }
  .seg-buttons button:not(:first-child) {
    margin-left: -1px;
  }
  .seg-buttons button.on {
    background: var(--accent);
    color: var(--accent-fg);
    border-color: var(--accent);
    position: relative;
    z-index: 1;
  }

  /* ─── Color picker ─── */
  .color-pick {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    margin-left: auto;
  }
  .color-pick input[type='color'] {
    width: 28px;
    height: 28px;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
  }
  .color-pick .hex {
    width: 88px;
    padding: 0.3rem 0.5rem;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
    color: var(--text);
    text-transform: lowercase;
  }
  .color-pick .hex:focus {
    outline: none;
    border-color: var(--accent);
  }

  /* ─── Sliders ─── */
  .slider {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }
  .slider.tight {
    gap: 0.2rem;
  }
  .slider-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.875rem;
  }
  .slider-grid.three {
    grid-template-columns: 1fr 1fr 1fr;
  }
  /* ── Finishing effects ── */
  .fx-stack {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .fx-group {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 0.6rem 0.7rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.03);
  }
  .fx-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    cursor: pointer;
  }
  .fx-toggle input {
    accent-color: var(--accent);
  }
  @media (max-width: 520px) {
    .slider-grid.three {
      grid-template-columns: 1fr;
    }
  }
  .slider-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .slider-head label {
    font-size: 0.8125rem;
    font-weight: 500;
  }
  .slider-head .value {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--muted);
  }
  .slider input[type='range'] {
    width: 100%;
    accent-color: var(--accent);
  }
  .slider-hint {
    display: flex;
    justify-content: space-between;
    font-size: 0.6875rem;
    color: var(--muted);
  }

  /* ─── Layers panel ─── */
  .layers {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--border);
  }
  .layer-group {
    display: flex;
    flex-direction: column;
  }
  .group-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0;
  }
  .expand-btn {
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
    color: var(--muted);
    display: flex;
    align-items: center;
    width: 16px;
    height: 16px;
  }
  .expand-btn :global(svg) {
    transition: transform 0.15s;
  }
  .expand-btn :global(.rotated) {
    transform: rotate(90deg);
  }
  .layer-swatch {
    position: relative;
    width: 24px;
    height: 24px;
    border-radius: 5px;
    border: 1px solid var(--border);
    cursor: pointer;
    overflow: hidden;
    transition: transform 0.1s;
    flex-shrink: 0;
  }
  .layer-swatch.small {
    width: 20px;
    height: 20px;
  }
  .layer-swatch:hover {
    transform: scale(1.08);
  }
  .layer-swatch.hidden {
    cursor: not-allowed;
    background:
      linear-gradient(45deg, #d4d4d8 25%, transparent 25%),
      linear-gradient(-45deg, #d4d4d8 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #d4d4d8 75%),
      linear-gradient(-45deg, transparent 75%, #d4d4d8 75%),
      #fff;
    background-size: 6px 6px;
    background-position: 0 0, 0 3px, 3px -3px, -3px 0, 0 0;
  }
  .layer-swatch.hidden::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(to top right, transparent 47%, #dc2626 48%, #dc2626 52%, transparent 53%);
  }
  .layer-swatch input[type='color'] {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }
  /* ── Gradient controls ─────────────────────────────────────── */
  .grad-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    flex-shrink: 0;
  }
  .grad-toggle:hover:not(:disabled) {
    border-color: var(--accent);
  }
  .grad-toggle:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .grad-toggle.on {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent) inset;
  }
  .grad-chip {
    width: 13px;
    height: 13px;
    border-radius: 3px;
    background: linear-gradient(135deg, #ff6a00, #ee0979);
  }
  .grad-editor {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
    padding: 0.45rem 0.5rem 0.45rem 1.75rem;
  }
  .grad-stop {
    position: relative;
    width: 22px;
    height: 22px;
    border-radius: 5px;
    border: 1px solid var(--border);
    overflow: hidden;
    cursor: pointer;
    flex-shrink: 0;
  }
  .grad-stop input[type='color'] {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }
  .grad-angle-range {
    flex: 1 1 60px;
    min-width: 50px;
    accent-color: var(--accent);
  }
  .grad-angle-range:disabled {
    opacity: 0.35;
  }
  .grad-type {
    display: inline-flex;
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
  }
  .grad-type button {
    padding: 0.2rem 0.4rem;
    font-size: 0.7rem;
    background: transparent;
    color: var(--muted);
    border: none;
    cursor: pointer;
  }
  .grad-type button.on {
    background: var(--accent-bg);
    color: var(--text);
  }
  .grad-presets {
    display: flex;
    gap: 0.3rem;
    flex-wrap: wrap;
    align-items: center;
  }
  .grad-preset {
    width: 20px;
    height: 20px;
    border-radius: 5px;
    border: 1px solid var(--border);
    padding: 0;
    cursor: pointer;
  }
  .grad-preset:hover {
    border-color: var(--accent);
    transform: scale(1.08);
  }
  .grad-preset.saved {
    box-shadow: 0 0 0 1px var(--accent-bg);
  }
  .grad-save {
    width: 20px;
    height: 20px;
    border-radius: 5px;
    border: 1px dashed var(--border);
    background: transparent;
    color: var(--muted);
    font-size: 0.85rem;
    line-height: 1;
    padding: 0;
    cursor: pointer;
  }
  .grad-save:hover {
    border-color: var(--accent);
    color: var(--text);
  }
  .layer-meta {
    flex: 1;
    font-size: 0.8125rem;
    color: var(--text);
  }
  .path-meta {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--muted);
  }
  .layer-hide {
    padding: 0.2rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    transition: background 0.12s, border-color 0.12s, color 0.12s;
  }
  .layer-hide.small {
    padding: 0.15rem 0.4rem;
  }
  .layer-hide:hover {
    border-color: var(--accent);
    color: var(--text);
  }
  .layer-hide.on {
    background: var(--accent);
    color: var(--accent-fg);
    border-color: var(--accent);
  }
  .layer-children {
    list-style: none;
    margin: 0;
    padding: 0 0 0 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }
  .layer-children li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.2rem 0.4rem;
    border-radius: 6px;
    transition: background 0.1s;
  }
  .layer-children li.hovered {
    background: var(--accent-bg);
  }
  .layer-children li.removed .path-meta {
    text-decoration: line-through;
    opacity: 0.6;
  }
  .hint {
    margin: 0.25rem 0 0;
    font-size: 0.6875rem;
    color: var(--muted);
    font-style: italic;
  }
  .muted-hint {
    font-size: 0.8125rem;
    color: var(--muted);
    font-style: italic;
  }

  /* ─── Advanced ─── */
  .advanced {
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
    background: var(--surface);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }
  .advanced summary {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 0.875rem;
    cursor: pointer;
    user-select: none;
    list-style: none;
    font-weight: 500;
    font-size: 0.875rem;
  }
  .advanced summary::-webkit-details-marker {
    display: none;
  }
  .advanced summary :global(.chev) {
    transition: transform 0.15s;
  }
  .advanced[open] summary :global(.chev) {
    transform: rotate(180deg);
  }
  .badge {
    margin-left: auto;
    font-size: 0.6875rem;
    font-weight: 500;
    padding: 0.1rem 0.45rem;
    border-radius: 999px;
    background: var(--accent-bg);
    color: var(--accent);
  }
  .sliders {
    padding: 0.875rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    border-top: 1px solid var(--border);
  }
  .modes {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .advanced-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    padding-top: 0.5rem;
    border-top: 1px solid var(--border);
  }
  .save-preset {
    display: flex;
    gap: 0.25rem;
    margin-left: auto;
  }
  .save-preset input {
    padding: 0.3rem 0.5rem;
    font-family: inherit;
    font-size: 0.8125rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
    color: var(--text);
    min-width: 0;
    width: 130px;
  }
  .save-preset input:focus {
    outline: none;
    border-color: var(--accent);
  }

  /* ─── Toggles row ─── */
  .toggles-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0 0.25rem;
    flex-wrap: wrap;
  }
  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--text);
    cursor: pointer;
    user-select: none;
  }
  .toggle.small {
    font-size: 0.8125rem;
  }
  .toggle input[type='checkbox'] {
    appearance: none;
    -webkit-appearance: none;
    width: 34px;
    height: 18px;
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid var(--border);
    border-radius: 999px;
    position: relative;
    outline: none;
    cursor: pointer;
    transition: background-color 0.2s, border-color 0.2s;
    flex-shrink: 0;
  }
  .toggle input[type='checkbox']::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 12px;
    height: 12px;
    background: #ffffff;
    border-radius: 50%;
    transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .toggle input[type='checkbox']:checked {
    background-color: var(--accent-hover);
    border-color: var(--accent-hover);
  }
  .toggle input[type='checkbox']:checked::after {
    transform: translateX(16px);
    background: var(--accent-fg);
  }
  .toggle input[type='checkbox']:focus-visible {
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.2);
  }

  /* ─── Buttons ─── */
  button.primary,
  button.ghost {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.55rem 1rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-family: inherit;
    cursor: pointer;
    border: 1px solid transparent;
    transition: background 0.15s, border-color 0.15s, opacity 0.15s;
  }
  button.primary {
    background: var(--accent);
    color: var(--accent-fg);
  }
  button.primary:hover:not(:disabled) {
    background: var(--accent-hover);
  }
  button.primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  button.ghost {
    background: transparent;
    border-color: var(--border);
    color: var(--text);
  }
  button.ghost:hover:not(:disabled) {
    border-color: var(--accent);
  }
  button:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
  .tiny-btn {
    padding: 0.25rem 0.55rem !important;
    font-size: 0.75rem !important;
    border-radius: 6px !important;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text);
    font-family: inherit;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }
  .tiny-btn:hover:not(:disabled) {
    border-color: var(--accent);
  }
  .tiny-btn.primary-tiny {
    background: var(--accent);
    color: var(--accent-fg);
    border-color: var(--accent);
  }
  .tiny-btn.primary-tiny:hover:not(:disabled) {
    background: var(--accent-hover);
    border-color: var(--accent-hover);
  }
  .tiny-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :global(.spin) {
    animation: spin 1s linear infinite;
  }
  :global(.muted) {
    color: var(--muted);
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* ─── Error / Placeholder ─── */
  .error {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 0.875rem;
    border-radius: 8px;
    background: #fef2f2;
    color: #991b1b;
    border: 1px solid #fecaca;
    font-size: 0.875rem;
    margin-bottom: 0.75rem;
  }
  .placeholder {
    border: 1px dashed var(--border);
    border-radius: 10px;
    padding: 4rem 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    color: var(--muted);
    font-size: 0.875rem;
    text-align: center;
  }

  /* ─── Result ─── */
  .result {
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }
  .result-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.625rem 0.875rem;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    gap: 0.625rem;
    flex-wrap: wrap;
  }
  .result-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  /* Copy-as disclosure menu (native <details>) */
  .copy-menu {
    position: relative;
  }
  .copy-menu summary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.55rem 1rem;
    border-radius: 8px;
    font-size: 0.875rem;
    cursor: pointer;
    list-style: none;
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text);
    transition: border-color 0.15s, background 0.15s;
  }
  .copy-menu summary::-webkit-details-marker {
    display: none;
  }
  .copy-menu summary:hover {
    border-color: var(--accent);
  }
  .copy-options {
    position: absolute;
    right: 0;
    top: calc(100% + 0.35rem);
    z-index: 10;
    display: flex;
    flex-direction: column;
    min-width: 11rem;
    padding: 0.3rem;
    border-radius: 10px;
    background: #0a3a3b;
    border: 1px solid var(--border);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  }
  .copy-options button {
    text-align: left;
    background: transparent;
    border: none;
    color: var(--text);
    font-family: inherit;
    font-size: 0.85rem;
    padding: 0.5rem 0.6rem;
    border-radius: 6px;
    cursor: pointer;
  }
  .copy-options button:hover {
    background: var(--accent-bg);
  }
  /* ── ASCII view (in the preview area) ── */
  .ascii-view {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .ascii-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .ascii-width {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.78rem;
    color: var(--muted);
  }
  .ascii-width input[type='range'] {
    width: 140px;
    accent-color: var(--accent);
  }
  .ascii-opt {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.78rem;
    color: var(--muted);
  }
  .ascii-opt select {
    appearance: none;
    background: rgba(255, 255, 255, 0.05);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.25rem 0.5rem;
    font-family: inherit;
    font-size: 0.78rem;
    cursor: pointer;
  }
  .ascii-opt option {
    color: #000;
  }
  .ascii-opt input[type='checkbox'] {
    accent-color: var(--accent);
  }
  .ascii-preview {
    margin: 0;
    max-height: 220px;
    overflow: auto;
    padding: 0.6rem;
    border-radius: 6px;
    background: #041e1f;
    color: var(--accent);
    font-family: var(--font-mono);
    font-size: 9px;
    line-height: 1;
    white-space: pre;
    transition: opacity 0.15s;
  }
  /* Big preview: center the art block in the stage. */
  .ascii-preview.big {
    max-height: 64vh;
    width: fit-content;
    max-width: 100%;
    margin: 0 auto;
    font-size: 10px;
    padding: 1rem;
  }
  .ascii-preview.busy {
    opacity: 0.5;
  }
  .ascii-actions {
    display: flex;
    gap: 0.4rem;
  }
  .export-select {
    display: inline-flex;
  }
  .export-select select {
    appearance: none;
    -webkit-appearance: none;
    padding: 0.4rem 0.55rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    cursor: pointer;
  }
  .export-select select:hover {
    border-color: var(--accent);
  }
  .export-select select:focus-visible {
    outline: none;
    border-color: var(--accent);
  }
  .size-compare {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8125rem;
    color: var(--muted);
    flex-wrap: wrap;
  }
  .output-size {
    color: var(--text);
    font-weight: 500;
  }
  .arrow,
  .dot {
    color: var(--muted);
  }
  .duration {
    font-family: var(--font-mono);
    font-size: 0.75rem;
  }
  .svg-view-wrap {
    display: flex;
    flex-direction: column;
  }
  .hide-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.4rem 0.75rem;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    font-size: 0.75rem;
    color: var(--muted);
    gap: 0.5rem;
  }
  .hide-count {
    color: var(--text);
    font-weight: 500;
  }
  .hide-hint {
    font-style: italic;
  }
  .hide-actions {
    display: flex;
    gap: 0.375rem;
  }
  .speckle-count {
    display: inline-block;
    margin-left: 0.35rem;
    padding: 0 0.35rem;
    border-radius: 999px;
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
    font-size: 0.7rem;
    font-weight: 600;
    transition: background 0.15s;
  }
  .speckle-count.active {
    background: #ef4444;
    color: white;
  }
  /* Speckle-preview: paths the slider would remove flash red instead of
     vanishing, so the user can see exactly what they're about to delete. */
  :global(svg path[data-preview-remove='1']) {
    animation: speckle-pulse 0.9s ease-in-out infinite alternate;
  }
  @keyframes speckle-pulse {
    from { opacity: 0.55; }
    to { opacity: 1; }
  }
  .result-preview.clickable :global(path) {
    cursor: pointer;
    transition: opacity 0.1s;
  }
  .result-preview.clickable :global(path:hover),
  .result-preview :global(path[data-hovered='true']) {
    opacity: 0.55;
  }
  .result-preview {
    padding: 1.5rem;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 240px;
    background:
      linear-gradient(45deg, #f0f0f0 25%, transparent 25%),
      linear-gradient(-45deg, #f0f0f0 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #f0f0f0 75%),
      linear-gradient(-45deg, transparent 75%, #f0f0f0 75%);
    background-size: 16px 16px;
    background-position: 0 0, 0 8px, 8px -8px, -8px 0;
  }
  .result-preview.has-bg {
    background: var(--bg-color);
    background-size: auto;
    background-position: 0 0;
    border-radius: var(--bg-radius);
    padding: calc(1.5rem + var(--bg-padding));
  }
  .result-preview.square {
    aspect-ratio: 1 / 1;
    max-height: 560px;
    max-width: 560px;
    margin: 0 auto;
  }
  .result-preview.square :global(svg) {
    max-height: 100%;
    width: 100%;
    height: 100%;
  }
  .result-preview :global(svg) {
    display: block;
    width: 100%;
    height: auto;
    max-width: 100%;
    max-height: 560px;
  }

  /* ─── Editor Toolbar ─── */
  /* ── Image layers strip ── */
  .image-layers {
    padding: 0.6rem 0.75rem;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }
  .layers-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .layer-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.25rem 0.5rem 0.25rem 0.25rem;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: rgba(255, 255, 255, 0.04);
    color: var(--text);
    cursor: pointer;
    font-size: 0.78rem;
    transition: border-color 0.15s, background 0.15s, opacity 0.15s;
  }
  .layer-chip img {
    width: 28px;
    height: 28px;
    object-fit: contain;
    border-radius: 5px;
    background: rgba(255, 255, 255, 0.06);
  }
  .layer-chip.active {
    border-color: var(--accent);
    background: var(--accent-bg);
  }
  .layer-chip.dim {
    opacity: 0.45;
  }
  .add-layer {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.7rem;
    border-radius: 8px;
    border: 1px dashed var(--border);
    color: var(--muted);
    cursor: pointer;
    font-size: 0.78rem;
    transition: border-color 0.15s, color 0.15s;
  }
  .add-layer:hover {
    border-color: var(--accent);
    color: var(--text);
  }
  .layer-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1rem;
    margin-top: 0.55rem;
  }
  .layer-actions {
    display: inline-flex;
    gap: 0.35rem;
  }
  .layer-sliders {
    display: inline-flex;
    gap: 0.85rem;
    flex-wrap: wrap;
  }
  .layer-slider {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.72rem;
    color: var(--muted);
  }
  .layer-slider input[type='range'] {
    width: 92px;
  }
  .editor-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    font-size: 0.75rem;
    gap: 0.75rem;
    flex-wrap: wrap;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }
  .tool-group {
    display: flex;
    align-items: center;
    gap: 2px;
    background: rgba(255, 255, 255, 0.05);
    padding: 2px;
    border-radius: 6px;
    border: 1px solid var(--border);
  }
  .tool-divider {
    width: 1px;
    align-self: stretch;
    margin: 2px 4px;
    background: var(--border);
  }
  .tool-btn.icon-only {
    padding: 0.35rem;
  }
  .tool-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .tool-btn {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.6rem;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--muted);
    font-family: inherit;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
  }
  .tool-btn:hover {
    color: var(--text);
    background: rgba(255, 255, 255, 0.05);
  }
  .tool-btn.active {
    background: var(--accent);
    color: var(--accent-fg);
  }

  /* ─── Popover ─── */
  .popover-backdrop {
    position: fixed;
    inset: 0;
    z-index: 999;
    background: transparent;
  }
  .popover {
    position: fixed;
    z-index: 1000;
    transform: translate(-50%, -100%);
    width: 240px;
    padding: 0.625rem;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
    animation: popover-in 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  }
  @keyframes popover-in {
    from {
      opacity: 0;
      transform: translate(-50%, -90%) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translate(-50%, -100%) scale(1);
    }
  }
  .popover-arrow {
    position: absolute;
    bottom: -6px;
    left: 50%;
    transform: translateX(-50%) rotate(45deg);
    width: 12px;
    height: 12px;
    background: inherit;
    border-right: 1px solid rgba(255, 255, 255, 0.12);
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    z-index: -1;
  }
  .popover-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.25rem;
  }
  .popover-title {
    font-weight: 600;
    font-size: 0.75rem;
    color: var(--text);
  }
  .popover-close {
    border: none;
    background: transparent;
    color: var(--muted);
    font-size: 1rem;
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }
  .popover-close:hover {
    color: var(--text);
  }
  .popover-body {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .popover-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.75rem;
  }
  .popover-row.actions {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
    padding-top: 0.25rem;
    border-top: 1px solid var(--border);
  }
  .popover-label {
    color: var(--muted);
    font-weight: 500;
  }
  .popover-color-hex {
    font-family: var(--font-mono);
    color: var(--text);
  }
  .popover-action-btn {
    flex: 1;
    justify-content: center;
    white-space: nowrap;
    padding: 0.25rem 0.4rem !important;
  }
</style>
