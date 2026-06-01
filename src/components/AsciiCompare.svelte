<script lang="ts">
  // Before/after wipe for the ASCII view — original image ↔ ASCII art.
  // Same drag mechanic as CompareSlider, minus the SVG path interactions.
  interface Props {
    originalUrl: string;
    ascii: string;
    /** Pre-coloured HTML (spans). When set, it's rendered instead of `ascii`. */
    asciiHtml?: string;
    /** Line-height for the art so the displayed cell matches the terminal's
     *  aspect — makes the preview a WYSIWYG of `cat`. Defaults to 1. */
    lineHeight?: number;
    busy?: boolean;
  }
  const { originalUrl, ascii, asciiHtml, lineHeight = 1, busy = false }: Props = $props();

  let container = $state<HTMLDivElement | null>(null);
  // 0 = ASCII only · 100 = original only · between = original revealed from left.
  // Default 50 = centered split.
  let position = $state(50);
  let dragging = $state(false);

  function move(clientX: number) {
    if (!container) return;
    const rect = container.getBoundingClientRect();
    position = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
  }
  function onPointerDown(e: PointerEvent) {
    dragging = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    move(e.clientX);
  }
  function onPointerMove(e: PointerEvent) {
    if (dragging) move(e.clientX);
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
</script>

<div class="acompare" bind:this={container} role="presentation">
  <!-- ASCII layer drives the height -->
  <div class="ascii-layer">
    {#if asciiHtml}
      <!-- eslint-disable-next-line svelte/no-at-html-tags — markup is built by
           imageToAscii from canvas pixels (glyphs HTML-escaped), never user text -->
      <pre class="art" class:busy style:line-height={lineHeight}>{@html asciiHtml}</pre>
    {:else}
      <pre class="art" class:busy style:line-height={lineHeight}>{ascii || '…'}</pre>
    {/if}
  </div>

  <!-- Original, clipped from the right -->
  <div class="orig-side" style="clip-path: inset(0 {100 - position}% 0 0);">
    <img src={originalUrl} alt="" draggable="false" />
  </div>

  <div class="labels">
    <span style:opacity={position > 8 ? 1 : 0}>Original</span>
    <span style:opacity={position < 92 ? 1 : 0}>ASCII</span>
  </div>

  <div
    class="handle"
    style="left: {position}%;"
    role="slider"
    tabindex="0"
    aria-label="Drag to compare the original image with the ASCII"
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
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="m9 6-6 6 6 6" />
        <path d="m15 6 6 6-6 6" />
      </svg>
    </div>
  </div>
</div>

<style>
  .acompare {
    position: relative;
    width: 100%;
    overflow: hidden;
    user-select: none;
    touch-action: none;
    border-radius: 8px;
    background: #041e1f;
  }
  .ascii-layer {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 240px;
    padding: 1rem;
    box-sizing: border-box;
  }
  .art {
    margin: 0;
    color: var(--accent);
    font-family: var(--font-mono);
    font-size: 10px;
    line-height: 1;
    white-space: pre;
  }
  /* No opacity dip while recomputing — the content just updates in place,
     so dragging the width slider / switching views stays flicker-free. */
  .orig-side {
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
    background:
      linear-gradient(45deg, #f0f0f0 25%, transparent 25%),
      linear-gradient(-45deg, #f0f0f0 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #f0f0f0 75%),
      linear-gradient(-45deg, transparent 75%, #f0f0f0 75%), white;
    background-size:
      16px 16px,
      16px 16px,
      16px 16px,
      16px 16px,
      auto;
    background-position:
      0 0,
      0 8px,
      8px -8px,
      -8px 0,
      0 0;
  }
  .orig-side img {
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
    z-index: 4;
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
</style>
