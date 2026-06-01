<script lang="ts">
  import type { BackdropOpts } from '~/lib/backdrop';
  import { backdropCss, backdropVisible } from '~/lib/backdrop';

  interface Props {
    originalUrl: string;
    svg: string;
    backdrop?: BackdropOpts;
    activeTool?: 'select' | 'eraser';
    /** Click handler for path elements inside the SVG layer (per-path edit). */
    onPathClick?: (origIdx: number, event: MouseEvent) => void;
    /** Hover sync hook: called with origIdx | null on path hover changes. */
    onPathHover?: (origIdx: number | null) => void;
    /** Event triggered when a marquee selection is finished in eraser mode. */
    onMarqueeSelect?: (box: { x: number; y: number; w: number; h: number }) => void;
  }

  const {
    originalUrl,
    svg,
    backdrop,
    activeTool = 'select',
    onPathClick,
    onPathHover,
    onMarqueeSelect,
  }: Props = $props();

  const visible = $derived(backdrop ? backdropVisible(backdrop) : false);
  const bg = $derived(backdrop && visible ? backdropCss(backdrop) : null);
  const radius = $derived(backdrop ? `${backdrop.radius}%` : '0');
  const padding = $derived(backdrop ? `${backdrop.padding}%` : '0');
  const square = $derived(backdrop?.aspect === 'square');

  let container = $state<HTMLDivElement | null>(null);
  /**
   * Slider position 0–100.
   * 0 = SVG only (original fully hidden)
   * 100 = Original only (covers the whole SVG)
   * Anywhere between: original visible from the LEFT edge up to `position`%.
   * Default 50 = centered split (original ⟷ result side by side).
   */
  let position = $state(50);
  let dragging = $state(false);

  // Marquee Selection state
  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let currentY = 0;
  let marqueeDragging = $state(false);
  let dragMoveDistance = 0;

  const marqueeBox = $derived.by(() => {
    if (!marqueeDragging) return null;
    const x = Math.min(startX, currentX);
    const y = Math.min(startY, currentY);
    const w = Math.abs(startX - currentX);
    const h = Math.abs(startY - currentY);
    return { x, y, w, h };
  });

  function move(clientX: number) {
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    position = Math.max(0, Math.min(100, x));
  }

  function onPointerDown(e: PointerEvent) {
    dragging = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    move(e.clientX);
  }
  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    move(e.clientX);
  }
  function onPointerUp(e: PointerEvent) {
    dragging = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  }
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') position = Math.max(0, position - 5);
    else if (e.key === 'ArrowRight') position = Math.min(100, position + 5);
    else if (e.key === 'Home') position = 0;
    else if (e.key === 'End') position = 100;
  }

  function onCanvasPointerDown(e: PointerEvent) {
    if (activeTool !== 'eraser') return;
    if (e.button !== 0) return; // Left click only
    if (!container) return;

    const rect = container.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    currentX = startX;
    currentY = startY;
    dragMoveDistance = 0;
    marqueeDragging = true;
    container.setPointerCapture(e.pointerId);
  }

  function onCanvasPointerMove(e: PointerEvent) {
    if (!marqueeDragging) return;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const nextX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const nextY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    dragMoveDistance += Math.hypot(nextX - currentX, nextY - currentY);
    currentX = nextX;
    currentY = nextY;
  }

  function onCanvasPointerUp(e: PointerEvent) {
    if (!marqueeDragging) return;
    marqueeDragging = false;
    if (container) {
      container.releasePointerCapture(e.pointerId);
    }

    if (dragMoveDistance > 5 && marqueeBox) {
      onMarqueeSelect?.(marqueeBox);
    }
  }

  function pathClick(e: MouseEvent) {
    if ((e.target as Element).closest?.('.handle')) return;
    // Prevent single-path click toggle if marquee dragging just completed
    if (activeTool === 'eraser' && dragMoveDistance > 5) return;

    const path = (e.target as Element).closest?.('path') as SVGPathElement | null;
    if (!path) return;
    const idx = parseInt(path.getAttribute('data-orig-idx') ?? '-1', 10);
    if (idx >= 0) onPathClick?.(idx, e);
  }

  function pathHover(e: MouseEvent) {
    if (!onPathHover) return;
    const path = (e.target as Element).closest?.('path') as SVGPathElement | null;
    const idx = path ? parseInt(path.getAttribute('data-orig-idx') ?? '-1', 10) : -1;
    onPathHover(idx >= 0 ? idx : null);
  }
  function pathHoverOut() {
    onPathHover?.(null);
  }
</script>

<div
  class="compare"
  class:has-bg={!!bg}
  class:square={square}
  class:original-visible={position > 0}
  style:--bg-color={bg ?? 'transparent'}
  style:--bg-radius={radius}
  style:--bg-padding={padding}
  bind:this={container}
  onclick={pathClick}
  onmousemove={pathHover}
  onmouseleave={pathHoverOut}
  onpointerdown={onCanvasPointerDown}
  onpointermove={onCanvasPointerMove}
  onpointerup={onCanvasPointerUp}
  role="presentation"
>
  <!-- Backdrop layer (color + radius). Sits BEHIND the SVG. Hidden when
       original overlay covers it. Belongs conceptually to the SVG side. -->
  <div class="backdrop-bg"></div>

  <!-- SVG layer: always full-size, drives container height, click-to-edit. -->
  <div class="svg-layer">
    {@html svg}
  </div>

  <!-- Selection Box Overlay -->
  {#if marqueeBox}
    <div
      class="marquee-selection"
      style:left="{marqueeBox.x}px"
      style:top="{marqueeBox.y}px"
      style:width="{marqueeBox.w}px"
      style:height="{marqueeBox.h}px"
    ></div>
  {/if}

  <!-- Original side: wrapped with its own checker background so backdrop
       doesn't bleed through PNG transparency. Clipped from the RIGHT. -->
  <div
    class="original-side"
    style="clip-path: inset(0 {100 - position}% 0 0);"
  >
    <img class="original-img" src={originalUrl} alt="" draggable="false" />
  </div>

  <div class="labels">
    <span class="label-original" style:opacity={position > 8 ? 1 : 0}>Original</span>
    <span class="label-svg" style:opacity={position < 92 ? 1 : 0}>SVG</span>
  </div>

  <div
    class="handle"
    style="left: {position}%;"
    role="slider"
    tabindex="0"
    aria-label="Drag to overlay the original PNG on top of the SVG"
    aria-valuemin="0"
    aria-valuemax="100"
    aria-valuenow={Math.round(position)}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
    onkeydown={onKeyDown}
  >
    <div class="handle-line" style:opacity={position > 0 ? 1 : 0}></div>
    <div class="handle-knob">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <path d="m9 6-6 6 6 6" />
        <path d="m15 6 6 6-6 6" />
      </svg>
    </div>
  </div>
</div>

<style>
  .compare {
    position: relative;
    width: 100%;
    overflow: hidden;
    user-select: none;
    touch-action: none;
  }
  .compare.square {
    aspect-ratio: 1 / 1;
    max-height: 560px;
    max-width: 560px;
    margin: 0 auto;
  }

  /* Reusable checker pattern */
  .checker {
    background:
      linear-gradient(45deg, #f0f0f0 25%, transparent 25%),
      linear-gradient(-45deg, #f0f0f0 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #f0f0f0 75%),
      linear-gradient(-45deg, transparent 75%, #f0f0f0 75%),
      white;
    background-size: 16px 16px, 16px 16px, 16px 16px, 16px 16px, auto;
    background-position: 0 0, 0 8px, 8px -8px, -8px 0, 0 0;
  }

  /* Backdrop layer — belongs to the SVG side only. */
  .backdrop-bg {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(45deg, #f0f0f0 25%, transparent 25%),
      linear-gradient(-45deg, #f0f0f0 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #f0f0f0 75%),
      linear-gradient(-45deg, transparent 75%, #f0f0f0 75%);
    background-size: 16px 16px;
    background-position: 0 0, 0 8px, 8px -8px, -8px 0;
    pointer-events: none;
  }
  .compare.has-bg .backdrop-bg {
    background: var(--bg-color);
    background-size: auto;
    background-position: 0 0;
    border-radius: var(--bg-radius);
  }

  /* SVG layer drives the container height (block flow). */
  .svg-layer {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 240px;
    z-index: 1;
  }
  .svg-layer :global(svg) {
    display: block;
    width: 100%;
    height: auto;
    max-height: 560px;
  }
  .compare.has-bg .svg-layer {
    padding: var(--bg-padding);
    box-sizing: border-box;
  }
  .compare.square .svg-layer {
    height: 100%;
  }
  .compare.square .svg-layer :global(svg) {
    width: 100%;
    height: 100%;
    max-height: 100%;
  }

  /* Path interactivity */
  .svg-layer :global(path) {
    cursor: pointer;
    transition: opacity 0.1s;
  }
  .svg-layer :global(path:hover) {
    opacity: 0.5;
  }

  /* Original side — wraps the PNG with its own checker background so the
     backdrop never leaks through PNG transparency. */
  .original-side {
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
    background:
      linear-gradient(45deg, #f0f0f0 25%, transparent 25%),
      linear-gradient(-45deg, #f0f0f0 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #f0f0f0 75%),
      linear-gradient(-45deg, transparent 75%, #f0f0f0 75%),
      white;
    background-size: 16px 16px, 16px 16px, 16px 16px, 16px 16px, auto;
    background-position: 0 0, 0 8px, 8px -8px, -8px 0, 0 0;
  }
  .original-img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .labels {
    position: absolute;
    inset: 0;
    pointer-events: none;
    display: flex;
    justify-content: space-between;
    padding: 0.75rem;
    z-index: 3;
  }
  .labels span {
    background: rgba(0, 0, 0, 0.6);
    color: white;
    font-size: 0.75rem;
    font-weight: 500;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    align-self: flex-start;
    height: fit-content;
  }

  .handle {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 28px;
    transform: translateX(-50%);
    cursor: ew-resize;
    display: flex;
    align-items: center;
    justify-content: center;
    outline: none;
    z-index: 2;
  }
  .handle:focus-visible .handle-knob {
    box-shadow: 0 0 0 3px var(--accent);
  }
  .handle-line {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 2px;
    background: white;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.15);
    transform: translateX(-50%);
    pointer-events: none;
  }
  .handle-knob {
    position: relative;
    width: 28px;
    height: 28px;
    border-radius: 999px;
    background: white;
    color: #18181b;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
  }

  /* Marquee selection overlay */
  .marquee-selection {
    position: absolute;
    border: 1px dashed var(--accent);
    background: rgba(172, 234, 206, 0.2);
    pointer-events: none;
    z-index: 10;
  }
</style>
